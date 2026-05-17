'use strict'

module.exports = async function analyticsRoutes(fastify, opts) {
  const mongo     = fastify.mongo.db('drivetrack')
  const redis     = fastify.redis
  const cassandra = fastify.cassandra

  const drivers = mongo.collection('drivers')
  const trips   = mongo.collection('trips')

  // CASSANDRA QUERIES
  
  // GET /analytics/cassandra/trips-by-city
  // Shows partition key efficiency — no ALLOW FILTERING
  // Exam point: "Cassandra is optimized for this exact access pattern"
  fastify.get('/analytics/cassandra/trips-by-city', async (req, reply) => {
    const { city, date, limit = 100 } = req.query

    if (!city || !date) {
      return reply.code(400).send({ error: 'city and date query params are required' })
    }

    // Cassandra: SELECT using full partition key (city + trip_date)
    // This is O(1) — goes directly to the right node, no scatter/gather
    const result = await cassandra.execute(
      `SELECT
        trip_id, driver_id, passenger_id,
        origin_lat, origin_lng, dest_lat, dest_lng,
        distance_km, price, status, created_at
       FROM trips
       WHERE city = ? AND trip_date = ?
       LIMIT ?`,
      [city, date, parseInt(limit)],
      { prepare: true }
    )

    const rows       = result.rows
    const completed  = rows.filter(r => r.status === 'completed')
    const cancelled  = rows.filter(r => r.status === 'cancelled')
    const totalRev   = completed.reduce((sum, r) => sum + parseFloat(r.price ?? 0), 0)
    const avgDist    = completed.length
      ? completed.reduce((sum, r) => sum + parseFloat(r.distance_km ?? 0), 0) / completed.length
      : 0

    return {
      city,
      date,
      summary: {
        total_trips:      rows.length,
        completed:        completed.length,
        cancelled:        cancelled.length,
        total_revenue:    parseFloat(totalRev.toFixed(2)),
        avg_distance_km:  parseFloat(avgDist.toFixed(2))
      },
      trips: rows
    }
  })

  // GET /analytics/cassandra/driver-history
  // Uses trips_by_driver materialized view / secondary table
  // Exam point: "Cassandra requires denormalization — we model per query, not per entity"
  fastify.get('/analytics/cassandra/driver-history', async (req, reply) => {
    const { driver_id, limit = 50 } = req.query

    if (!driver_id) {
      return reply.code(400).send({ error: 'driver_id is required' })
    }

    const result = await cassandra.execute(
      `SELECT *
       FROM trips_by_driver
       WHERE driver_id = ?
       LIMIT ?`,
      [driver_id, parseInt(limit)],
      { prepare: true }
    )

    const rows     = result.rows
    const earned   = rows
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + parseFloat(r.price ?? 0), 0)

    return {
      driver_id,
      total_trips_found: rows.length,
      total_earned:      parseFloat(earned.toFixed(2)),
      trips:             rows
    }
  })

  // GET /analytics/cassandra/time-window
  // Range query on clustering column (created_at)
  // Exam point: "Clustering columns allow range queries within a partition"
  fastify.get('/analytics/cassandra/time-window', async (req, reply) => {
    const { city, date, from, to } = req.query

    if (!city || !date || !from || !to) {
      return reply.code(400).send({
        error: 'city, date, from, and to are required',
        example: '?city=Sevilla&date=2025-05-13&from=08:00&to=12:00'
      })
    }

    // Build full ISO timestamps from date + time strings
    const fromTs = new Date(`${date}T${from}:00.000Z`)
    const toTs   = new Date(`${date}T${to}:00.000Z`)

    // Cassandra range query on clustering key
    // Works because PRIMARY KEY ((city, trip_date), created_at, trip_id)
    const result = await cassandra.execute(
      `SELECT trip_id, driver_id, price, distance_km, status, created_at
       FROM trips
       WHERE city = ?
         AND trip_date = ?
         AND created_at >= ?
         AND created_at <= ?`,
      [city, date, fromTs, toTs],
      { prepare: true }
    )

    return {
      city,
      date,
      window: { from, to },
      count:  result.rows.length,
      trips:  result.rows
    }
  })

  // GET /analytics/cassandra/multi-day
  // Queries across multiple date partitions by iterating
  // Exam point: "Cassandra doesn't do cross-partition queries efficiently,
  //              so we issue one query per partition and merge in application layer"
  fastify.get('/analytics/cassandra/multi-day', async (req, reply) => {
    const { city, days = 7 } = req.query

    if (!city) return reply.code(400).send({ error: 'city is required' })

    const results   = []
    const today     = new Date()

    // Issue one Cassandra query per day partition — this is intentional
    // It demonstrates understanding of Cassandra's partition model
    await Promise.all(
      Array.from({ length: parseInt(days) }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        return d.toISOString().split('T')[0]
      }).map(async (dateStr) => {
        const r = await cassandra.execute(
          `SELECT status, price, distance_km
           FROM trips
           WHERE city = ? AND trip_date = ?`,
          [city, dateStr],
          { prepare: true }
        )
        const completed = r.rows.filter(row => row.status === 'completed')
        results.push({
          date:         dateStr,
          total_trips:  r.rows.length,
          completed:    completed.length,
          revenue:      parseFloat(
            completed.reduce((s, row) => s + parseFloat(row.price ?? 0), 0).toFixed(2)
          )
        })
      })
    )

    results.sort((a, b) => a.date.localeCompare(b.date))

    return { city, days_queried: parseInt(days), daily_stats: results }
  })

  // MONGODB ANALYTICS — Aggregation Pipelines

  // GET /analytics/mongo/revenue-by-city
  // $group + $sort + $project pipeline
  // Exam point: "MongoDB aggregation pipeline processes documents stage by stage"
  fastify.get('/analytics/mongo/revenue-by-city', async (req, reply) => {
    const result = await trips.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id:           '$city',
          total_revenue: { $sum: '$price' },
          total_trips:   { $sum: 1 },
          avg_fare:      { $avg: '$price' },
          avg_distance:  { $avg: '$distance_km' },
          max_fare:      { $max: '$price' },
          min_fare:      { $min: '$price' }
        }
      },
      { $sort: { total_revenue: -1 } },
      {
        $project: {
          _id:           0,
          city:          '$_id',
          total_revenue: { $round: ['$total_revenue', 2] },
          total_trips:   1,
          avg_fare:      { $round: ['$avg_fare',      2] },
          avg_distance:  { $round: ['$avg_distance',  2] },
          max_fare:      { $round: ['$max_fare',       2] },
          min_fare:      { $round: ['$min_fare',       2] }
        }
      }
    ]).toArray()

    return { revenue_by_city: result }
  })

  // GET /analytics/mongo/top-drivers
  // $lookup to join drivers + trips collections
  // Exam point: "$lookup is MongoDB's equivalent of a SQL JOIN"
  fastify.get('/analytics/mongo/top-drivers', async (req, reply) => {
    const { limit = 10, city } = req.query
    const matchStage = city
      ? { $match: { city, status: 'completed' } }
      : { $match: { status: 'completed' } }

    const result = await trips.aggregate([
      matchStage,
      {
        $group: {
          _id:          '$driver_id',
          total_trips:  { $sum: 1 },
          total_earned: { $sum: '$price' },
          avg_distance: { $avg: '$distance_km' }
        }
      },
      { $sort: { total_trips: -1 } },
      { $limit: parseInt(limit) },
      {
        // $lookup — join with drivers collection to get name/vehicle
        $lookup: {
          from:         'drivers',
          localField:   '_id',
          foreignField: '_id',
          as:           'driver_info'
        }
      },
      { $unwind: { path: '$driver_info', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id:          0,
          driver_id:    '$_id',
          name:         '$driver_info.name',
          city:         '$driver_info.city',
          vehicle:      '$driver_info.vehicle',
          rating:       '$driver_info.rating',
          total_trips:  1,
          total_earned: { $round: ['$total_earned', 2] },
          avg_distance: { $round: ['$avg_distance', 2] }
        }
      }
    ]).toArray()

    return { top_drivers: result }
  })

  // GET /analytics/mongo/hourly-heatmap
  // $group by hour + day of week → heatmap data
  // Exam point: "MongoDB date operators extract time components from ISODate fields"
  fastify.get('/analytics/mongo/hourly-heatmap', async (req, reply) => {
    const { city } = req.query
    const match = city
      ? { $match: { city, status: 'completed' } }
      : { $match: { status: 'completed' } }

    const result = await trips.aggregate([
      match,
      {
        $group: {
          _id: {
            day_of_week: { $dayOfWeek: '$created_at' }, // 1=Sun ... 7=Sat
            hour:        { $hour:      '$created_at' }
          },
          trip_count: { $sum: 1 },
          avg_fare:   { $avg: '$price' }
        }
      },
      { $sort: { '_id.day_of_week': 1, '_id.hour': 1 } },
      {
        $project: {
          _id:        0,
          day_of_week: '$_id.day_of_week',
          hour:        '$_id.hour',
          trip_count:  1,
          avg_fare:    { $round: ['$avg_fare', 2] }
        }
      }
    ]).toArray()

    return { heatmap: result }
  })

  // GET /analytics/mongo/distance-buckets
  // $bucket — classify trips by distance range
  // Exam point: "$bucket replaces multiple $cond statements for range classification"
  fastify.get('/analytics/mongo/distance-buckets', async (req, reply) => {
    const result = await trips.aggregate([
      { $match: { status: 'completed' } },
      {
        $bucket: {
          groupBy:    '$distance_km',
          boundaries: [0, 2, 5, 10, 20, 50],
          default:    '50km+',
          output: {
            count:       { $sum: 1 },
            avg_price:   { $avg: '$price' },
            total_revenue: { $sum: '$price' }
          }
        }
      },
      {
        $project: {
          range:         '$_id',
          count:         1,
          avg_price:     { $round: ['$avg_price',     2] },
          total_revenue: { $round: ['$total_revenue', 2] },
          _id:           0
        }
      }
    ]).toArray()

    return { distance_buckets: result }
  })

  // GET /analytics/mongo/geo-drivers
  // $geoNear — find drivers within radius, show distribution
  // Exam point: "$geoNear must be first stage in pipeline, requires 2dsphere index"
  fastify.get('/analytics/mongo/geo-drivers', async (req, reply) => {
    const { lat, lng, radius = 10000 } = req.query

    if (!lat || !lng) {
      return reply.code(400).send({ error: 'lat and lng are required' })
    }

    // Requires: db.drivers.createIndex({ location: "2dsphere" })
    const result = await drivers.aggregate([
      {
        $geoNear: {
          near:          { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          distanceField: 'distance_m',
          maxDistance:   parseInt(radius),   // meters
          spherical:     true,
          query:         { status: { $in: ['online', 'on_trip'] } }
        }
      },
      {
        $project: {
          name:       1,
          city:       1,
          status:     1,
          rating:     1,
          vehicle:    1,
          distance_km: { $round: [{ $divide: ['$distance_m', 1000] }, 2] }
        }
      },
      { $sort: { distance_km: 1 } }
    ]).toArray()

    return {
      center:    { lat: parseFloat(lat), lng: parseFloat(lng) },
      radius_km: parseInt(radius) / 1000,
      count:     result.length,
      drivers:   result
    }
  })

  // GET /analytics/mongo/cancellation-rate
  // $facet — multiple sub-pipelines in one query
  // Exam point: "$facet runs parallel aggregation branches in a single pass"
  fastify.get('/analytics/mongo/cancellation-rate', async (req, reply) => {
    const result = await trips.aggregate([
      {
        $facet: {
          by_city: [
            {
              $group: {
                _id:        '$city',
                total:      { $sum: 1 },
                cancelled:  { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
                completed:  { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
              }
            },
            {
              $project: {
                city:              '$_id',
                total:             1,
                cancelled:         1,
                completed:         1,
                cancellation_rate: {
                  $round: [
                    { $multiply: [{ $divide: ['$cancelled', { $max: ['$total', 1] }] }, 100] },
                    1
                  ]
                },
                _id: 0
              }
            },
            { $sort: { cancellation_rate: -1 } }
          ],
          overall: [
            {
              $group: {
                _id:       null,
                total:     { $sum: 1 },
                cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
              }
            },
            {
              $project: {
                _id:               0,
                total_trips:       '$total',
                total_cancelled:   '$cancelled',
                global_cancel_rate: {
                  $round: [
                    { $multiply: [{ $divide: ['$cancelled', { $max: ['$total', 1] }] }, 100] },
                    1
                  ]
                }
              }
            }
          ]
        }
      }
    ]).toArray()

    return {
      overall:     result[0].overall[0],
      by_city:     result[0].by_city
    }
  })

  // REDIS ANALYTICS — Live counters + leaderboard
  
  // GET /analytics/redis/live-dashboard
  // Combines multiple Redis reads into one snapshot
  // Exam point: "Redis pipeline batches commands — reduces round trips"
  fastify.get('/analytics/redis/live-dashboard', async (req, reply) => {
    const cities = await drivers.distinct('city')

    // Use Redis pipeline to batch all reads in one round trip
    // pipeline() queues commands and sends them all at once
    const pipeline = redis.pipeline()

    for (const city of cities) {
      const key = city.toLowerCase()
      pipeline.get(`city:${key}:rides_today`)
      pipeline.get(`city:${key}:online_drivers`)
    }

    const responses = await pipeline.exec()
    // responses = [[null, value], [null, value], ...] (err, result) pairs

    const cityStats = cities.map((city, i) => ({
      city,
      rides_today:    parseInt(responses[i * 2][1]     ?? 0),
      online_drivers: parseInt(responses[i * 2 + 1][1] ?? 0)
    }))

    // Global active trips count
    const activeKeys   = await redis.keys('trip:active:*')
    const pendingKeys  = await redis.keys('trip:pending:*')

    return {
      snapshot_at:    new Date().toISOString(),
      active_trips:   activeKeys.length,
      pending_trips:  pendingKeys.length,
      city_stats:     cityStats.sort((a, b) => b.rides_today - a.rides_today)
    }
  })

  // GET /analytics/redis/leaderboard
  // Redis Sorted Set — top drivers by trips today
  // Exam point: "ZREVRANGE returns members sorted by score descending — O(log N)"
  fastify.get('/analytics/redis/leaderboard', async (req, reply) => {
    const { limit = 10 } = req.query

    // ZREVRANGE leaderboard:drivers:today 0 <limit-1> WITHSCORES
    const raw = await redis.zrevrange(
      'leaderboard:drivers:today',
      0,
      parseInt(limit) - 1,
      'WITHSCORES'
    )

    // raw = ['driver:abc', '12', 'driver:xyz', '9', ...]
    // Pair up members and scores
    const leaderboard = []
    for (let i = 0; i < raw.length; i += 2) {
      const driverId = raw[i].replace('driver:', '')
      const score    = parseInt(raw[i + 1])

      const profile = await drivers.findOne(
        { _id: driverId },
        { projection: { name: 1, city: 1, rating: 1 } }
      )

      leaderboard.push({
        rank:       leaderboard.length + 1,
        driver_id:  driverId,
        name:       profile?.name ?? 'Unknown',
        city:       profile?.city,
        rating:     profile?.rating,
        trips_today: score
      })
    }

    return { leaderboard }
  })

  // POST /analytics/redis/leaderboard/increment
  // ZINCRBY — increment a driver's score
  // Exam point: "ZINCRBY is atomic — safe under concurrent requests"
  fastify.post('/analytics/redis/leaderboard/increment', async (req, reply) => {
    const { driver_id } = req.body

    if (!driver_id) return reply.code(400).send({ error: 'driver_id is required' })

    // ZINCRBY leaderboard:drivers:today 1 driver:<id>
    const newScore = await redis.zincrby(
      'leaderboard:drivers:today',
      1,
      `driver:${driver_id}`
    )

    // Set expiry on the leaderboard key at end of day (86400s = 24h)
    await redis.expire('leaderboard:drivers:today', 86400)

    const rank = await redis.zrevrank('leaderboard:drivers:today', `driver:${driver_id}`)

    return {
      driver_id,
      new_score: parseInt(newScore),
      rank:      rank + 1
    }
  })
  
  // CROSS-DB COMBINED REPORT

  // GET /analytics/report — Full platform summary combining all 3 databases
  // Exam showpiece: demonstrate all 3 databases working together
  fastify.get('/analytics/report', async (req, reply) => {
    const today    = new Date().toISOString().split('T')[0]
    const cities   = await drivers.distinct('city')

    // --- Redis: live counters (pipeline) ---
    const pipeline = redis.pipeline()
    for (const city of cities) {
      pipeline.get(`city:${city.toLowerCase()}:rides_today`)
      pipeline.get(`city:${city.toLowerCase()}:online_drivers`)
    }
    const redisResponses = await pipeline.exec()

    const liveStats = cities.map((city, i) => ({
      city,
      rides_today:    parseInt(redisResponses[i * 2][1]     ?? 0),
      online_drivers: parseInt(redisResponses[i * 2 + 1][1] ?? 0)
    }))

    // --- Cassandra: today's completed trips per city ---
    const cassandraStats = await Promise.all(
      cities.map(async (city) => {
        const r = await cassandra.execute(
          `SELECT status, price FROM trips WHERE city = ? AND trip_date = ?`,
          [city, today],
          { prepare: true }
        )
        const completed = r.rows.filter(row => row.status === 'completed')
        return {
          city,
          cassandra_trips_today: r.rows.length,
          cassandra_revenue_today: parseFloat(
            completed.reduce((s, row) => s + parseFloat(row.price ?? 0), 0).toFixed(2)
          )
        }
      })
    )

    // --- MongoDB: overall platform totals ---
    const [mongoTotals] = await trips.aggregate([
      {
        $group: {
          _id:           null,
          total_trips:   { $sum: 1 },
          total_revenue: { $sum: '$price' },
          avg_fare:      { $avg: '$price' },
          total_drivers: { $addToSet: '$driver_id' }
        }
      },
      {
        $project: {
          _id:            0,
          total_trips:    1,
          total_revenue:  { $round: ['$total_revenue', 2] },
          avg_fare:       { $round: ['$avg_fare', 2] },
          active_drivers: { $size: '$total_drivers' }
        }
      }
    ]).toArray()

    // --- Merge all sources ---
    const cityReport = cities.map((city) => {
      const live     = liveStats.find(s => s.city === city) ?? {}
      const cassData = cassandraStats.find(s => s.city === city) ?? {}
      return { city, ...live, ...cassData }
    })

    return {
      generated_at: new Date().toISOString(),
      platform_totals: mongoTotals ?? {},
      city_breakdown:  cityReport,
      data_sources: {
        redis:     'Live counters — rides_today, online_drivers',
        cassandra: 'Today\'s trip events — append-only log',
        mongodb:   'All-time aggregated totals and driver profiles'
      }
    }
  })
}