'use strict'

const fp                          = require('fastify-plugin')
const cassandra                   = require('cassandra-driver')
const { Client, types: { uuid } } = cassandra

// Cassandra Schema 
// All CQL statements executed on startup if tables don't exist

const CQL_CREATE_KEYSPACE = `
  CREATE KEYSPACE IF NOT EXISTS drivetrack
  WITH replication = {
    'class':              'SimpleStrategy',
    'replication_factor': '1'
  }
  AND durable_writes = true
`

const CQL_CREATE_TRIPS_TABLE = `
  CREATE TABLE IF NOT EXISTS drivetrack.trips (
    city          TEXT,
    trip_date     DATE,
    created_at    TIMESTAMP,
    trip_id       UUID,
    driver_id     TEXT,
    passenger_id  TEXT,
    origin_lat    DOUBLE,
    origin_lng    DOUBLE,
    dest_lat      DOUBLE,
    dest_lng      DOUBLE,
    distance_km   FLOAT,
    price         DECIMAL,
    status        TEXT,
    completed_at  TIMESTAMP,
    PRIMARY KEY ((city, trip_date), created_at, trip_id)
  )
  WITH CLUSTERING ORDER BY (created_at DESC, trip_id ASC)
  AND gc_grace_seconds = 864000
`
// Partition key: (city, trip_date) — keeps partitions bounded per day per city
// Clustering: created_at DESC — newest trips first within a partition
// gc_grace_seconds: 10 days — tombstone cleanup window

const CQL_CREATE_TRIPS_BY_DRIVER = `
  CREATE TABLE IF NOT EXISTS drivetrack.trips_by_driver (
    driver_id     TEXT,
    created_at    TIMESTAMP,
    trip_id       UUID,
    city          TEXT,
    passenger_id  TEXT,
    distance_km   FLOAT,
    price         DECIMAL,
    status        TEXT,
    PRIMARY KEY (driver_id, created_at, trip_id)
  )
  WITH CLUSTERING ORDER BY (created_at DESC, trip_id ASC)
`
// Denormalized table — same data, different partition key
// Cassandra pattern: one table per query, not one table per entity
// This enables: SELECT * FROM trips_by_driver WHERE driver_id = ?

const CQL_CREATE_TRIPS_BY_CITY_STATUS = `
  CREATE TABLE IF NOT EXISTS drivetrack.trips_by_city_status (
    city          TEXT,
    status        TEXT,
    trip_date     DATE,
    created_at    TIMESTAMP,
    trip_id       UUID,
    driver_id     TEXT,
    price         DECIMAL,
    distance_km   FLOAT,
    PRIMARY KEY ((city, status), trip_date, created_at, trip_id)
  )
  WITH CLUSTERING ORDER BY (trip_date DESC, created_at DESC, trip_id ASC)
`
// Third table for: "show me all cancelled trips in Sevilla"
// Without this table, we'd need ALLOW FILTERING — never in production

const CQL_HEALTH_CHECK = `SELECT release_version FROM system.local`

async function cassandraPlugin(fastify, opts) {

  // Client configuration 
  const contactPoints = (process.env.CASSANDRA_HOSTS || 'localhost').split(',')
  const localDatacenter = process.env.CASSANDRA_DC || 'datacenter1'

  const client = new Client({
    contactPoints,
    localDataCenter: localDatacenter,

    // Credentials (if auth is enabled)
    ...(process.env.CASSANDRA_USER && {
      credentials: {
        username: process.env.CASSANDRA_USER,
        password: process.env.CASSANDRA_PASSWORD
      }
    }),

    // Connection pool settings
    pooling: {
      coreConnectionsPerHost: {
        [cassandra.types.distance.local]:  2,
        [cassandra.types.distance.remote]: 1
      },
      maxRequestsPerConnection: 1024
    },

    // Query options defaults
    queryOptions: {
      consistency: cassandra.types.consistencies.localQuorum,
      // localQuorum: majority of replicas in local DC must respond
      // Strong consistency — right for financial/trip data
      prepare: true  // auto-prepare all queries
    },

    // Socket options
    socketOptions: {
      connectTimeout: 10000,
      readTimeout:    15000
    },

    // Retry policy
    policies: {
      retry:          new cassandra.policies.retry.RetryPolicy(),
      reconnection:   new cassandra.policies.reconnection.ExponentialReconnectionPolicy(1000, 30000),
      loadBalancing:  new cassandra.policies.loadBalancing.DCAwareRoundRobinPolicy(localDatacenter)
    }
  })

  // Connect 
  try {
    await client.connect()
    fastify.log.info(`[Cassandra] Connected to: ${contactPoints.join(', ')}`)
  } catch (err) {
    fastify.log.error(`[Cassandra] Connection failed: ${err.message}`)
    throw err
  }

  // Health check 
  try {
    const result = await client.execute(CQL_HEALTH_CHECK)
    const version = result.rows[0].release_version
    fastify.log.info(`[Cassandra] Health check passed — version ${version}`)
  } catch (err) {
    fastify.log.error(`[Cassandra] Health check failed: ${err.message}`)
    throw err
  }

  // Schema setup 
  // Create keyspace first (no keyspace context yet)
  await client.execute(CQL_CREATE_KEYSPACE)
  fastify.log.info('[Cassandra] Keyspace drivetrack ready')

  // Switch to keyspace for table creation
  await client.execute('USE drivetrack')

  // Create all tables
  const tables = [
    { name: 'trips',                  cql: CQL_CREATE_TRIPS_TABLE             },
    { name: 'trips_by_driver',        cql: CQL_CREATE_TRIPS_BY_DRIVER         },
    { name: 'trips_by_city_status',   cql: CQL_CREATE_TRIPS_BY_CITY_STATUS    }
  ]

  for (const table of tables) {
    await client.execute(table.cql)
    fastify.log.info(`[Cassandra] Table "${table.name}" ready`)
  }

  // Wrap execute for keyspace safety 

  const originalExecute = client.execute.bind(client)

  const wrappedClient = {
    ...client,
    execute: async (query, params, options) => {
      // Inject keyspace prefix if table name is unqualified
      const qualifiedQuery = query.replace(
        /\b(FROM|INTO|UPDATE|TABLE)\s+(trips(?:_by_driver|_by_city_status)?)\b/gi,
        (match, keyword, table) => `${keyword} drivetrack.${table}`
      )
      return originalExecute(qualifiedQuery, params, options)
    },
    // Expose raw client for advanced use
    _raw: client,
    // Expose uuid generator for trip_id creation
    uuid: () => uuid.random()
  }

  // Decorate Fastify 
  fastify.decorate('cassandra', wrappedClient)

  // Graceful shutdown 
  fastify.addHook('onClose', async () => {
    fastify.log.info('[Cassandra] Shutting down...')
    await client.shutdown()
    fastify.log.info('[Cassandra] Shutdown complete')
  })
}

module.exports = fp(cassandraPlugin, {
  name:    'cassandra',
  fastify: '4.x'
})