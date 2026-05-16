'use strict'

const { ObjectId } = require('mongodb')

module.exports = async function driverRoutes(fastify, opts) {
  const mongo = fastify.mongo.db('drivetrack')
  const redis = fastify.redis
  const drivers = mongo.collection('drivers')

  // SCHEMAS 

  const driverBodySchema = {
    type: 'object',
    required: ['name', 'city', 'vehicle'],
    properties: {
      name:    { type: 'string' },
      city:    { type: 'string' },
      phone:   { type: 'string' },
      rating:  { type: 'number', minimum: 0, maximum: 5, default: 5.0 },
      vehicle: {
        type: 'object',
        required: ['model', 'plate'],
        properties: {
          model: { type: 'string' },
          plate: { type: 'string' },
          color: { type: 'string' }
        }
      }
    }
  }

  const geoUpdateSchema = {
    type: 'object',
    required: ['lat', 'lng'],
    properties: {
      lat: { type: 'number' },
      lng: { type: 'number' }
    }
  }

  const nearbyQuerySchema = {
    type: 'object',
    required: ['lat', 'lng'],
    properties: {
      lat:    { type: 'number' },
      lng:    { type: 'number' },
      radius: { type: 'number', default: 5 },   // km
      count:  { type: 'number', default: 5 }
    }
  }
  
  // CRUD — MongoDB

  // POST /drivers — Create driver
  fastify.post('/drivers', {
    schema: { body: driverBodySchema }
  }, async (req, reply) => {
    const doc = {
      ...req.body,
      rating:      req.body.rating ?? 5.0,
      total_trips: 0,
      status:      'offline',          // offline | online | on_trip
      location:    null,               // set when driver goes online
      joined:      new Date()
    }

    const result = await drivers.insertOne(doc)

    return reply.code(201).send({
      message:   'Driver created',
      driver_id: result.insertedId
    })
  })

  // GET /drivers — List all drivers (with optional city filter)
  fastify.get('/drivers', async (req, reply) => {
    const { city, status } = req.query
    const filter = {}
    if (city)   filter.city   = city
    if (status) filter.status = status

    const result = await drivers.find(filter).limit(100).toArray()
    return { count: result.length, drivers: result }
  })

  // GET /drivers/:id — Get single driver
  fastify.get('/drivers/:id', async (req, reply) => {
    const driver = await drivers.findOne({ _id: new ObjectId(req.params.id) })
    if (!driver) return reply.code(404).send({ error: 'Driver not found' })
    return driver
  })

  // PUT /drivers/:id — Update driver profile
  fastify.put('/drivers/:id', async (req, reply) => {
    const allowed = ['name', 'phone', 'vehicle', 'city']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No valid fields to update' })
    }

    const result = await drivers.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...updates, updated_at: new Date() } }
    )

    if (result.matchedCount === 0) {
      return reply.code(404).send({ error: 'Driver not found' })
    }

    return { message: 'Driver updated' }
  })

  // DELETE /drivers/:id — Remove driver
  fastify.delete('/drivers/:id', async (req, reply) => {
    const result = await drivers.deleteOne({ _id: new ObjectId(req.params.id) })
    if (result.deletedCount === 0) {
      return reply.code(404).send({ error: 'Driver not found' })
    }

    // Also remove from Redis if they were online
    await redis.zrem('drivers:locations', `driver:${req.params.id}`)

    return { message: 'Driver deleted' }
  })

  // GEO — Redis (go online / offline / update location / find nearby)
  
  // POST /drivers/:id/online — Driver goes online, sets location in Redis
  // Redis command: GEOADD drivers:locations <lng> <lat> <member>
  fastify.post('/drivers/:id/online', {
    schema: { body: geoUpdateSchema }
  }, async (req, reply) => {
    const { lat, lng } = req.body
    const driverId = req.params.id
    const member   = `driver:${driverId}`

    // 1. Add to Redis Geo index
    // GEOADD stores as (longitude, latitude) — note the order
    await redis.geoadd('drivers:locations', lng, lat, member)

    // 2. Cache active session info (expires in 1 hour of inactivity)
    await redis.setex(
      `driver:session:${driverId}`,
      3600,
      JSON.stringify({ status: 'online', lat, lng, updated: Date.now() })
    )

    // 3. Update status in MongoDB
    await drivers.updateOne(
      { _id: new ObjectId(driverId) },
      {
        $set: {
          status:   'online',
          location: { type: 'Point', coordinates: [lng, lat] },
          last_seen: new Date()
        }
      }
    )

    // 4. Increment city online counter in Redis
    const driver = await drivers.findOne(
      { _id: new ObjectId(driverId) },
      { projection: { city: 1 } }
    )
    if (driver?.city) {
      await redis.incr(`city:${driver.city.toLowerCase()}:online_drivers`)
    }

    return { message: 'Driver is now online', lat, lng }
  })

  // POST /drivers/:id/offline — Driver goes offline, removed from Redis Geo
  // Redis command: ZREM drivers:locations <member>
  fastify.post('/drivers/:id/offline', async (req, reply) => {
    const driverId = req.params.id
    const member   = `driver:${driverId}`

    // 1. Remove from Redis Geo sorted set
    await redis.zrem('drivers:locations', member)

    // 2. Delete session cache
    await redis.del(`driver:session:${driverId}`)

    // 3. Update MongoDB
    const driver = await drivers.findOneAndUpdate(
      { _id: new ObjectId(driverId) },
      { $set: { status: 'offline', last_seen: new Date() } },
      { returnDocument: 'before' }
    )

    // 4. Decrement city online counter
    if (driver?.city) {
      await redis.decr(`city:${driver.city.toLowerCase()}:online_drivers`)
    }

    return { message: 'Driver is now offline' }
  })

  // PATCH /drivers/:id/location — Update live GPS location
  // Redis command: GEOADD (overwrites existing member)
  fastify.patch('/drivers/:id/location', {
    schema: { body: geoUpdateSchema }
  }, async (req, reply) => {
    const { lat, lng } = req.body
    const member = `driver:${req.params.id}`

    // GEOADD with existing member = update in place
    await redis.geoadd('drivers:locations', lng, lat, member)

    // Refresh session TTL and update coords
    await redis.setex(
      `driver:session:${req.params.id}`,
      3600,
      JSON.stringify({ status: 'online', lat, lng, updated: Date.now() })
    )

    return { message: 'Location updated', lat, lng }
  })

  // GET /drivers/nearby — Find online drivers near a coordinate
  // Redis command: GEORADIUS drivers:locations <lng> <lat> <radius> km ASC COUNT <n>
  fastify.get('/drivers/nearby', {
    schema: { querystring: nearbyQuerySchema }
  }, async (req, reply) => {
    const { lat, lng, radius, count } = req.query

    // GEORADIUS returns members within radius, sorted by distance
    const nearby = await redis.georadius(
      'drivers:locations',
      lng,            // longitude first (Redis convention)
      lat,
      radius,
      'km',
      'WITHCOORD',    // include coordinates in response
      'WITHDIST',     // include distance
      'ASC',          // closest first
      'COUNT', count
    )

    if (!nearby || nearby.length === 0) {
      return { count: 0, drivers: [] }
    }

    // nearby = [ ['driver:abc123', '1.23', ['lng', 'lat']], ... ]
    const enriched = await Promise.all(
      nearby.map(async ([member, distance, [driverLng, driverLat]]) => {
        const id = member.replace('driver:', '')
        const profile = await drivers.findOne(
          { _id: new ObjectId(id) },
          { projection: { name: 1, vehicle: 1, rating: 1, city: 1 } }
        )
        return {
          driver_id:   id,
          name:        profile?.name,
          vehicle:     profile?.vehicle,
          rating:      profile?.rating,
          distance_km: parseFloat(distance),
          coordinates: { lat: parseFloat(driverLat), lng: parseFloat(driverLng) }
        }
      })
    )

    return { count: enriched.length, drivers: enriched }
  })

  // GET /drivers/:id/position — Get exact position of one driver from Redis
  // Redis command: GEOPOS drivers:locations <member>
  fastify.get('/drivers/:id/position', async (req, reply) => {
    const member = `driver:${req.params.id}`
    const pos = await redis.geopos('drivers:locations', member)

    if (!pos || !pos[0]) {
      return reply.code(404).send({ error: 'Driver is offline or not found' })
    }

    const [lng, lat] = pos[0]
    return {
      driver_id: req.params.id,
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    }
  })

  // ANALYTICS — MongoDB Aggregation Pipelines
  
  // GET /drivers/analytics/by-city — Total drivers and avg rating per city
  fastify.get('/drivers/analytics/by-city', async (req, reply) => {
    const result = await drivers.aggregate([
      {
        $group: {
          _id:           '$city',
          total_drivers: { $sum: 1 },
          avg_rating:    { $avg: '$rating' },
          total_trips:   { $sum: '$total_trips' },
          online_now:    {
            $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] }
          }
        }
      },
      { $sort: { total_drivers: -1 } },
      {
        $project: {
          city:          '$_id',
          total_drivers: 1,
          avg_rating:    { $round: ['$avg_rating', 2] },
          total_trips:   1,
          online_now:    1,
          _id:           0
        }
      }
    ]).toArray()

    return { cities: result }
  })

  // GET /drivers/analytics/top — Top drivers by total trips
  fastify.get('/drivers/analytics/top', async (req, reply) => {
    const { limit = 10, city } = req.query
    const match = city ? { $match: { city } } : { $match: {} }

    const result = await drivers.aggregate([
      match,
      { $sort: { total_trips: -1, rating: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          name:        1,
          city:        1,
          rating:      1,
          total_trips: 1,
          vehicle:     1,
          status:      1
        }
      }
    ]).toArray()

    return { top_drivers: result }
  })

  // GET /drivers/analytics/rating-distribution — Histogram of ratings
  fastify.get('/drivers/analytics/rating-distribution', async (req, reply) => {
    const result = await drivers.aggregate([
      {
        $bucket: {
          groupBy:    '$rating',
          boundaries: [0, 2, 3, 4, 4.5, 5.01],
          default:    'Other',
          output: {
            count:   { $sum: 1 },
            drivers: { $push: '$name' }
          }
        }
      }
    ]).toArray()

    return { distribution: result }
  })

  // GET /drivers/analytics/online-stats — Live counters from Redis per city
  // Redis command: GET city:<name>:online_drivers
  fastify.get('/drivers/analytics/online-stats', async (req, reply) => {
    // Get distinct cities from MongoDB
    const cities = await drivers.distinct('city')

    const stats = await Promise.all(
      cities.map(async (city) => {
        const key   = `city:${city.toLowerCase()}:online_drivers`
        const count = await redis.get(key)
        return { city, online_drivers: parseInt(count ?? 0) }
      })
    )

    return { online_stats: stats.sort((a, b) => b.online_drivers - a.online_drivers) }
  })
}