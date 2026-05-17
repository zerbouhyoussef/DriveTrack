'use strict'

// Load .env for local development (Docker passes env vars directly)
try { require('dotenv').config({ path: '../.env' }) } catch (e) { /* optional */ }

const fastify = require('fastify')({
  logger: true
})

async function start(retries = 5) {
  // CORS — allow dashboard to call API
  await fastify.register(require('@fastify/cors'), {
    origin: true,
    credentials: true
  })

  // Database plugins — retry on failure (Cassandra can be slow to start)
  try {
    await fastify.register(require('./db/mongo'))
    await fastify.register(require('./db/redis'))
    await fastify.register(require('./db/cassandra'))
  } catch (err) {
    if (retries > 0) {
      fastify.log.warn(`Database connection failed, retrying in 5s... (${retries} retries left)`)
      await new Promise(resolve => setTimeout(resolve, 5000))
      return start(retries - 1)
    }
    throw err
  }

  // Routes
  await fastify.register(require('./routes/driver'), { prefix: '/' })
  await fastify.register(require('./routes/trips'), { prefix: '/' })
  await fastify.register(require('./routes/analytics'), { prefix: '/' })

  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongo: 'connected',
        redis: 'connected',
        cassandra: 'connected'
      }
    }
  })

  // Start server
  const port = parseInt(process.env.PORT) || 3000
  const host = process.env.HOST || '0.0.0.0'

  try {
    await fastify.listen({ port, host })
    fastify.log.info(`DriveTrack API running on http://${host}:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
