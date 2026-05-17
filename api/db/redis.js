// db/redis.js — Redis connection plugin
// Registers ioredis client as fastify.redis
// Covers: connection, retry strategy, health check, graceful shutdown

'use strict'

const fp    = require('fastify-plugin')
const Redis = require('ioredis')

async function redisPlugin(fastify, opts) {

  const client = new Redis({
    host:     process.env.REDIS_HOST     || 'localhost',
    port:     parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db:       0,

    // Retry strategy — exponential backoff, give up after 10 attempts
    retryStrategy(times) {
      if (times > 10) {
        fastify.log.error('[Redis] Max retry attempts reached — giving up')
        return null // stop retrying
      }
      const delay = Math.min(times * 200, 3000) // max 3s between retries
      fastify.log.warn(`[Redis] Retrying connection... attempt ${times} (delay: ${delay}ms)`)
      return delay
    },

    // Reconnect on specific errors
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED']
      return targetErrors.some(e => err.message.includes(e))
    },

    // Connection options
    connectTimeout:      10000,  // 10s to establish connection
    commandTimeout:      5000,   // 5s per command
    enableOfflineQueue:  true,   // queue commands while reconnecting
    maxRetriesPerRequest: 3,
    lazyConnect:         false   // connect immediately on startup
  })

  // ── Event listeners ──────────────────────────────────────
  client.on('connect',       ()    => fastify.log.info('[Redis] Connected'))
  client.on('ready',         ()    => fastify.log.info('[Redis] Ready to accept commands'))
  client.on('error',         (err) => fastify.log.error(`[Redis] Error: ${err.message}`))
  client.on('close',         ()    => fastify.log.warn('[Redis] Connection closed'))
  client.on('reconnecting',  (ms)  => fastify.log.warn(`[Redis] Reconnecting in ${ms}ms`))
  client.on('end',           ()    => fastify.log.warn('[Redis] Connection ended'))

  // ── Health check ─────────────────────────────────────────
  // PING command — confirms Redis is alive and responding
  try {
    const pong = await client.ping()
    if (pong !== 'PONG') throw new Error('Unexpected PING response')
    fastify.log.info('[Redis] Health check passed')
  } catch (err) {
    fastify.log.error(`[Redis] Health check failed: ${err.message}`)
    throw err // crash fast on startup if Redis is unavailable
  }

  // ── Ensure required indexes / structures exist ────────────
  // Leaderboard sorted set TTL (set if not already present)
  const leaderboardExists = await client.exists('leaderboard:drivers:today')
  if (!leaderboardExists) {
    // Initialize empty sorted set with 24h TTL
    // ZADD returns 0 on empty, so we just set expiry placeholder
    await client.set('leaderboard:drivers:today:init', '1', 'EX', 86400)
    fastify.log.info('[Redis] Leaderboard key initialized')
  }

  // ── Decorate Fastify ──────────────────────────────────────
  // Accessible as fastify.redis in all routes
  fastify.decorate('redis', client)

  // ── Graceful shutdown ─────────────────────────────────────
  fastify.addHook('onClose', async (instance) => {
    fastify.log.info('[Redis] Closing connection...')
    await client.quit()  // QUIT command — clean disconnect
    fastify.log.info('[Redis] Connection closed gracefully')
  })
}

module.exports = fp(redisPlugin, {
  name:       'redis',
  fastify:    '4.x',
  decorators: { fastify: [] }
})