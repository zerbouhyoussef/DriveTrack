'use strict'

const fp                       = require('fastify-plugin')
const { MongoClient, ObjectId } = require('mongodb')

async function mongoPlugin(fastify, opts) {

  const uri = process.env.MONGO_URL || 'mongodb://localhost:27017'

  const client = new MongoClient(uri, {
    // Connection pool
    maxPoolSize:          10,   // max simultaneous connections
    minPoolSize:          2,    // keep 2 connections alive always
    maxIdleTimeMS:        30000, // close idle connections after 30s

    // Timeouts
    connectTimeoutMS:     10000,
    socketTimeoutMS:      45000,
    serverSelectionTimeoutMS: 5000,

    // Write concern: majority of nodes must acknowledge writes
    writeConcern: { w: 'majority', j: true },

    // Read preference: read from primary by default
    readPreference: 'primaryPreferred',

    // Auto-reconnect is handled by MongoClient internally
    retryWrites: true,
    retryReads:  true
  })

  //  Connect ─
  try {
    await client.connect()
    fastify.log.info('[MongoDB] Connected')
  } catch (err) {
    fastify.log.error(`[MongoDB] Connection failed: ${err.message}`)
    throw err
  }

  const db = client.db('drivetrack')

  //  Health check 
  // db.command({ ping: 1 }) — official recommended health check
  try {
    const result = await db.command({ ping: 1 })
    if (result.ok !== 1) throw new Error('Ping returned non-ok')
    fastify.log.info('[MongoDB] Health check passed')
  } catch (err) {
    fastify.log.error(`[MongoDB] Health check failed: ${err.message}`)
    throw err
  }

  //  Collections ─
  const drivers = db.collection('drivers')
  const trips   = db.collection('trips')

  //  Index creation
  // createIndex is idempotent — safe to call on every startup
  // No custom names: lets MongoDB use auto-generated names so startup is
  // always idempotent regardless of whether the seed already ran first.
  fastify.log.info('[MongoDB] Creating indexes...')

  // drivers collection
  await drivers.createIndex({ location: '2dsphere' }, { sparse: true })
  await drivers.createIndex({ city: 1 })
  await drivers.createIndex({ status: 1, city: 1 })
  await drivers.createIndex({ rating: -1 })

  // trips collection
  await trips.createIndex({ city: 1, created_at: -1 })
  await trips.createIndex({ driver_id: 1, created_at: -1 })
  await trips.createIndex({ status: 1 })
  await trips.createIndex({ created_at: -1 })

  fastify.log.info('[MongoDB] All indexes ready')

  //  Decorate Fastify 
  // fastify.mongo.db('drivetrack') — used in routes
  // fastify.mongo.client            — raw client if needed
  // fastify.mongo.ObjectId          — for _id conversions

  fastify.decorate('mongo', {
    client,
    db:       (name) => client.db(name ?? 'drivetrack'),
    ObjectId
  })

  // Shortcut decorators used across routes
  fastify.decorate('drivers', drivers)
  fastify.decorate('trips',   trips)

  //  Graceful shutdown ─
  fastify.addHook('onClose', async () => {
    fastify.log.info('[MongoDB] Closing connection...')
    await client.close()
    fastify.log.info('[MongoDB] Connection closed')
  })
}

module.exports = fp(mongoPlugin, {
  name:    'mongodb',
  fastify: '4.x'
})