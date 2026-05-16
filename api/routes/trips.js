'use strict'

const { v4: uuidv4 } = require('uuid')
const { ObjectId }   = require('mongodb')

module.exports = async function tripRoutes(fastify, opts) {
  const mongo   = fastify.mongo.db('drivetrack')
  const redis   = fastify.redis
  const cassandra = fastify.cassandra        // cassandra client attached in app.js
  const drivers = mongo.collection('drivers')
  const tripsCol = mongo.collection('trips') // for analytics only — source of truth is Cassandra

  // CASSANDRA PREPARED STATEMENTS
  // Prepared once at startup — reused on every request
  // This is the correct production pattern (avoid re-preparing per request)

  const INSERT_TRIP = `
    INSERT INTO trips (
      city, trip_date, trip_id,
      driver_id, passenger_id,
      origin_lat, origin_lng,
      dest_lat, dest_lng,
      distance_km, price,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

  const UPDATE_TRIP_STATUS = `
    UPDATE trips
    SET status = ?, completed_at = ?
    WHERE city = ? AND trip_date = ? AND created_at = ? AND trip_id = ?
  `

  const SELECT_TRIPS_BY_CITY_DATE = `
    SELECT * FROM trips
    WHERE city = ? AND trip_date = ?
    LIMIT ?
  `

  const SELECT_TRIPS_BY_DRIVER = `
    SELECT * FROM trips_by_driver
    WHERE driver_id = ?
    LIMIT ?
  `

  const SELECT_TRIP_BY_ID = `
    SELECT * FROM trips
    WHERE city = ? AND trip_date = ? AND trip_id = ?
    ALLOW FILTERING
  `
  // SCHEMAS
  
  const requestTripSchema = {
    type: 'object',
    required: ['passenger_id', 'origin_lat', 'origin_lng', 'dest_lat', 'dest_lng', 'city'],
    properties: {
      passenger_id: { type: 'string' },
      city:         { type: 'string' },
      origin_lat:   { type: 'number' },
      origin_lng:   { type: 'number' },
      dest_lat:     { type: 'number' },
      dest_lng:     { type: 'number' }
    }
  }

  const completeTripSchema = {
    type: 'object',
    required: ['distance_km', 'price'],
    properties: {
      distance_km: { type: 'number' },
      price:       { type: 'number' }
    }
  }

  // HELPERS 

  // Haversine formula — straight-line distance between two GPS points
  function haversineKm(lat1, lng1, lat2, lng2) {
    const R   = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  // Estimate price: base fare + per km rate
  function estimatePrice(distanceKm) {
    const BASE_FARE  = 2.5
    const RATE_PER_KM = 1.2
    return parseFloat((BASE_FARE + distanceKm * RATE_PER_KM).toFixed(2))
  }

  // Today as cassandra DATE string
  function todayStr() {
    return new Date().toISOString().split('T')[0]
  }
 
  // TRIP LIFECYCLE
  
  // POST /trips/request — Passenger requests a trip
  // Finds nearest online driver via Redis GEORADIUS, creates pending session
  fastify.post('/trips/request', {
    schema: { body: requestTripSchema }
  }, async (req, reply) => {
    const { passenger_id, city, origin_lat, origin_lng, dest_lat, dest_lng } = req.body

    // 1. Find nearest available driver via Redis
    // GEORADIUS drivers:locations <lng> <lat> 10 km ASC COUNT 5
    const nearby = await redis.georadius(
      'drivers:locations',
      origin_lng,
      origin_lat,
      10, 'km',
      'WITHDIST', 'ASC', 'COUNT', 5
    )

    if (!nearby || nearby.length === 0) {
      return reply.code(503).send({ error: 'No drivers available nearby' })
    }

    // Filter to only online (not on_trip) drivers
    let assignedDriver = null
    for (const [member, distance] of nearby) {
      const driverId = member.replace('driver:', '')
      const session  = await redis.get(`driver:session:${driverId}`)
      if (!session) continue

      const parsed = JSON.parse(session)
      if (parsed.status === 'online') {
        assignedDriver = { id: driverId, distance_km: parseFloat(distance) }
        break
      }
    }

    if (!assignedDriver) {
      return reply.code(503).send({ error: 'All nearby drivers are currently on a trip' })
    }

    // 2. Estimate distance and price
    const distanceKm = haversineKm(origin_lat, origin_lng, dest_lat, dest_lng)
    const price      = estimatePrice(distanceKm)
    const tripId     = uuidv4()

    // 3. Store pending trip in Redis (TTL 5 min — expires if driver doesn't accept)
    // Key: trip:pending:<tripId>
    await redis.setex(
      `trip:pending:${tripId}`,
      300,
      JSON.stringify({
        trip_id:      tripId,
        driver_id:    assignedDriver.id,
        passenger_id,
        city,
        origin_lat, origin_lng,
        dest_lat, dest_lng,
        distance_km:  parseFloat(distanceKm.toFixed(2)),
        price,
        status:       'pending',
        created_at:   new Date().toISOString()
      })
    )

    // 4. Mark driver as on_trip in their session
    const driverSession = JSON.parse(await redis.get(`driver:session:${assignedDriver.id}`))
    await redis.setex(
      `driver:session:${assignedDriver.id}`,
      3600,
      JSON.stringify({ ...driverSession, status: 'on_trip', trip_id: tripId })
    )

    // 5. Update driver status in MongoDB
    await drivers.updateOne(
      { _id: new ObjectId(assignedDriver.id) },
      { $set: { status: 'on_trip' } }
    )

    return reply.code(201).send({
      message:          'Trip requested — driver assigned',
      trip_id:          tripId,
      driver_id:        assignedDriver.id,
      driver_distance:  `${assignedDriver.distance_km} km away`,
      estimated_distance_km: parseFloat(distanceKm.toFixed(2)),
      estimated_price:  price
    })
  })

  // POST /trips/:id/start — Driver confirms pickup, trip officially starts
  fastify.post('/trips/:id/start', async (req, reply) => {
    const tripId   = req.params.id
    const pending  = await redis.get(`trip:pending:${tripId}`)

    if (!pending) {
      return reply.code(404).send({ error: 'Trip not found or already expired' })
    }

    const trip = JSON.parse(pending)

    // Update status in Redis
    await redis.setex(
      `trip:active:${tripId}`,
      7200,
      JSON.stringify({ ...trip, status: 'active', started_at: new Date().toISOString() })
    )

    // Remove pending key
    await redis.del(`trip:pending:${tripId}`)

    return { message: 'Trip started', trip_id: tripId }
  })

  // POST /trips/:id/complete — Trip ends, write full event to Cassandra
  // Cassandra command: INSERT INTO trips (...)
  fastify.post('/trips/:id/complete', {
    schema: { body: completeTripSchema }
  }, async (req, reply) => {
    const tripId = req.params.id
    const { distance_km, price } = req.body

    // 1. Get active trip from Redis
    const active = await redis.get(`trip:active:${tripId}`)
    if (!active) {
      return reply.code(404).send({ error: 'Active trip not found' })
    }

    const trip      = JSON.parse(active)
    const now       = new Date()
    const tripDate  = todayStr()

    // 2. Write immutable event to Cassandra
    // This is the permanent record — append-only, never updated
    await cassandra.execute(INSERT_TRIP, [
      trip.city,                    // partition key part 1
      tripDate,                     // partition key part 2
      tripId,                       // clustering key
      trip.driver_id,
      trip.passenger_id,
      trip.origin_lat,
      trip.origin_lng,
      trip.dest_lat,
      trip.dest_lng,
      distance_km,
      price,
      'completed',
      now
    ], { prepare: true })

    // 3. Clean up Redis
    await redis.del(`trip:active:${tripId}`)

    // 4. Restore driver to online in Redis session
    const driverSession = await redis.get(`driver:session:${trip.driver_id}`)
    if (driverSession) {
      const parsed = JSON.parse(driverSession)
      delete parsed.trip_id
      await redis.setex(
        `driver:session:${trip.driver_id}`,
        3600,
        JSON.stringify({ ...parsed, status: 'online' })
      )
    }

    // 5. Update MongoDB: driver status + increment total_trips + update avg rating slot
    await drivers.updateOne(
      { _id: new ObjectId(trip.driver_id) },
      {
        $set: { status: 'online' },
        $inc: { total_trips: 1 }
      }
    )

    // 6. Mirror to MongoDB trips collection for aggregation analytics
    await tripsCol.insertOne({
      trip_id:     tripId,
      driver_id:   trip.driver_id,
      passenger_id: trip.passenger_id,
      city:        trip.city,
      distance_km,
      price,
      status:      'completed',
      created_at:  now
    })

    // 7. Increment city trip counter in Redis
    await redis.incr(`city:${trip.city.toLowerCase()}:rides_today`)

    return {
      message:     'Trip completed',
      trip_id:     tripId,
      distance_km,
      price,
      completed_at: now.toISOString()
    }
  })

  // POST /trips/:id/cancel — Cancel a pending or active trip
  fastify.post('/trips/:id/cancel', async (req, reply) => {
    const tripId = req.params.id
    const { reason = 'No reason provided' } = req.body ?? {}

    // Check pending first, then active
    let trip = null
    let source = null

    const pending = await redis.get(`trip:pending:${tripId}`)
    if (pending) { trip = JSON.parse(pending); source = 'pending' }

    if (!trip) {
      const active = await redis.get(`trip:active:${tripId}`)
      if (active) { trip = JSON.parse(active); source = 'active' }
    }

    if (!trip) {
      return reply.code(404).send({ error: 'Trip not found' })
    }

    const now      = new Date()
    const tripDate = todayStr()

    // 1. Write cancelled event to Cassandra
    await cassandra.execute(INSERT_TRIP, [
      trip.city,
      tripDate,
      tripId,
      trip.driver_id,
      trip.passenger_id,
      trip.origin_lat,
      trip.origin_lng,
      trip.dest_lat,
      trip.dest_lng,
      0,        // distance_km = 0 (trip never completed)
      0,        // price = 0
      'cancelled',
      now
    ], { prepare: true })

    // 2. Remove from Redis
    await redis.del(`trip:${source}:${tripId}`)

    // 3. Restore driver to online
    const driverSession = await redis.get(`driver:session:${trip.driver_id}`)
    if (driverSession) {
      const parsed = JSON.parse(driverSession)
      delete parsed.trip_id
      await redis.setex(
        `driver:session:${trip.driver_id}`,
        3600,
        JSON.stringify({ ...parsed, status: 'online' })
      )
    }

    await drivers.updateOne(
      { _id: new ObjectId(trip.driver_id) },
      { $set: { status: 'online' } }
    )

    return { message: 'Trip cancelled', trip_id: tripId, reason }
  })

  // QUERIES — Cassandra reads

  // GET /trips?city=Sevilla&date=2025-05-13&limit=50
  // Cassandra: SELECT * FROM trips WHERE city = ? AND trip_date = ?
  // Uses partition key — extremely fast, no full scan
  fastify.get('/trips', async (req, reply) => {
    const { city, date, limit = 50 } = req.query

    if (!city || !date) {
      return reply.code(400).send({ error: 'city and date are required query params' })
    }

    const result = await cassandra.execute(
      SELECT_TRIPS_BY_CITY_DATE,
      [city, date, parseInt(limit)],
      { prepare: true }
    )

    return {
      city,
      date,
      count: result.rows.length,
      trips: result.rows
    }
  })

  // GET /trips/driver/:driverId — All trips for a specific driver
  // Uses secondary Cassandra table: trips_by_driver
  fastify.get('/trips/driver/:driverId', async (req, reply) => {
    const { limit = 20 } = req.query

    const result = await cassandra.execute(
      SELECT_TRIPS_BY_DRIVER,
      [req.params.driverId, parseInt(limit)],
      { prepare: true }
    )

    return {
      driver_id: req.params.driverId,
      count:     result.rows.length,
      trips:     result.rows
    }
  })

  // GET /trips/active — All currently active trips from Redis
  // Redis command: KEYS trip:active:* (scan in production)
  fastify.get('/trips/active', async (req, reply) => {
    // Use SCAN instead of KEYS in production to avoid blocking
    const keys = await redis.keys('trip:active:*')

    if (keys.length === 0) return { count: 0, trips: [] }

    const trips = await Promise.all(
      keys.map(async (key) => {
        const raw = await redis.get(key)
        return raw ? JSON.parse(raw) : null
      })
    )

    return {
      count: trips.filter(Boolean).length,
      trips: trips.filter(Boolean)
    }
  })

  // GET /trips/:id/status — Check a trip's current status (Redis first, Cassandra fallback)
  fastify.get('/trips/:id/status', async (req, reply) => {
    const tripId = req.params.id

    // Check Redis first (live state)
    for (const state of ['pending', 'active']) {
      const raw = await redis.get(`trip:${state}:${tripId}`)
      if (raw) {
        const trip = JSON.parse(raw)
        return { trip_id: tripId, status: trip.status, source: 'redis', trip }
      }
    }

    // Fall back to Cassandra (completed/cancelled)
    return reply.code(404).send({
      error:  'Trip not found in live state — may be completed or expired',
      hint:   'Query GET /trips?city=<city>&date=<date> to find completed trips'
    })
  })

  // ANALYTICS — MongoDB Aggregation Pipelines 

  // GET /trips/analytics/revenue — Total revenue grouped by city
  fastify.get('/trips/analytics/revenue', async (req, reply) => {
    const result = await tripsCol.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id:           '$city',
          total_revenue: { $sum: '$price' },
          total_trips:   { $sum: 1 },
          avg_price:     { $avg: '$price' },
          avg_distance:  { $avg: '$distance_km' }
        }
      },
      { $sort: { total_revenue: -1 } },
      {
        $project: {
          city:          '$_id',
          total_revenue: { $round: ['$total_revenue', 2] },
          total_trips:   1,
          avg_price:     { $round: ['$avg_price', 2] },
          avg_distance:  { $round: ['$avg_distance', 2] },
          _id:           0
        }
      }
    ]).toArray()

    return { revenue_by_city: result }
  })

  // GET /trips/analytics/hourly — Trips per hour (busiest hours of the day)
  fastify.get('/trips/analytics/hourly', async (req, reply) => {
    const { city } = req.query
    const match = city ? { $match: { city, status: 'completed' } } : { $match: { status: 'completed' } }

    const result = await tripsCol.aggregate([
      match,
      {
        $group: {
          _id:         { $hour: '$created_at' },
          total_trips: { $sum: 1 },
          avg_price:   { $avg: '$price' }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          hour:        '$_id',
          total_trips: 1,
          avg_price:   { $round: ['$avg_price', 2] },
          _id:         0
        }
      }
    ]).toArray()

    return { hourly_distribution: result }
  })

  // GET /trips/analytics/live-counters — Redis live stats per city
  // Redis command: GET city:<name>:rides_today
  fastify.get('/trips/analytics/live-counters', async (req, reply) => {
    const cities = await drivers.distinct('city')

    const counters = await Promise.all(
      cities.map(async (city) => {
        const ridesKey   = `city:${city.toLowerCase()}:rides_today`
        const onlineKey  = `city:${city.toLowerCase()}:online_drivers`
        const rides  = await redis.get(ridesKey)
        const online = await redis.get(onlineKey)
        return {
          city,
          rides_today:    parseInt(rides  ?? 0),
          online_drivers: parseInt(online ?? 0)
        }
      })
    )

    return { live_counters: counters.sort((a, b) => b.rides_today - a.rides_today) }
  })
}