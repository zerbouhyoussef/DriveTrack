'use strict'

/**
 * Seed script — populates MongoDB, Redis, and Cassandra with sample data.
 * Run once via: docker-compose run seed
 */

const { MongoClient } = require('mongodb')
const Redis = require('ioredis')
const cassandra = require('cassandra-driver')
const { v4: uuidv4 } = require('uuid')

// ─── Config ──────────────────────────────────────────────────

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const REDIS_HOST = process.env.REDIS_HOST || 'localhost'
const REDIS_PORT = parseInt(process.env.REDIS_PORT) || 6379
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined
const CASSANDRA_HOSTS = (process.env.CASSANDRA_HOSTS || 'localhost').split(',')
const CASSANDRA_DC = process.env.CASSANDRA_DC || 'datacenter1'

// ─── Sample Data ─────────────────────────────────────────────

const cities = ['Madrid', 'Barcelona', 'Sevilla', 'Valencia', 'Málaga']

const cityCoords = {
  Madrid:    { lat: 40.4168, lng: -3.7038 },
  Barcelona: { lat: 41.3874, lng: 2.1686 },
  Sevilla:   { lat: 37.3891, lng: -5.9845 },
  Valencia:  { lat: 39.4699, lng: -0.3763 },
  Málaga:    { lat: 36.7213, lng: -4.4214 },
}

const firstNames = ['Carlos', 'Ana', 'Pedro', 'María', 'Juan', 'Laura', 'Diego', 'Sofia', 'Miguel', 'Elena', 'Javier', 'Carmen', 'Pablo', 'Lucía', 'Andrés']
const lastNames = ['Martínez', 'Rodríguez', 'López', 'García', 'Pérez', 'Sánchez', 'Fernández', 'Torres', 'Álvarez', 'Vega']
const carModels = ['Toyota Corolla', 'Seat León', 'Hyundai Tucson', 'Renault Clio', 'VW Golf', 'Ford Focus', 'BMW 320', 'Peugeot 208', 'Opel Astra', 'Kia Sportage']
const colors = ['White', 'Black', 'Silver', 'Blue', 'Red', 'Gray', 'Green']

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randomFloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(4)) }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function generatePlate() {
  const nums = randomInt(1000, 9999)
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  const l = letters[randomInt(0, letters.length - 1)] + letters[randomInt(0, letters.length - 1)] + letters[randomInt(0, letters.length - 1)]
  return `${nums}-${l}`
}

// ─── Main ────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Starting DriveTrack seed...\n')

  // ─── MongoDB ───────────────────────────────────────────────
  console.log('📦 Connecting to MongoDB...')
  const mongoClient = new MongoClient(MONGO_URL)
  await mongoClient.connect()
  const db = mongoClient.db('drivetrack')

  // Clear existing data
  await db.collection('drivers').deleteMany({})
  await db.collection('trips').deleteMany({})
  console.log('   Cleared existing data')

  // Create drivers
  const driverDocs = []
  for (let i = 0; i < 50; i++) {
    const city = randomItem(cities)
    const coords = cityCoords[city]
    const status = randomItem(['online', 'online', 'online', 'on_trip', 'offline'])

    driverDocs.push({
      name: `${randomItem(firstNames)} ${randomItem(lastNames)}`,
      city,
      phone: `+34 6${randomInt(10, 99)} ${randomInt(100, 999)} ${randomInt(100, 999)}`,
      rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
      total_trips: randomInt(50, 1500),
      status,
      vehicle: {
        model: randomItem(carModels),
        plate: generatePlate(),
        color: randomItem(colors)
      },
      location: status !== 'offline' ? {
        type: 'Point',
        coordinates: [
          coords.lng + randomFloat(-0.02, 0.02),
          coords.lat + randomFloat(-0.02, 0.02)
        ]
      } : null,
      joined: new Date(Date.now() - randomInt(30, 365) * 86400000)
    })
  }

  const insertResult = await db.collection('drivers').insertMany(driverDocs)
  const driverIds = Object.values(insertResult.insertedIds).map(id => id.toString())
  console.log(`   ✓ Created ${driverIds.length} drivers`)

  // Create indexes
  await db.collection('drivers').createIndex({ location: '2dsphere' }, { sparse: true })
  await db.collection('drivers').createIndex({ city: 1 })
  await db.collection('drivers').createIndex({ status: 1, city: 1 })
  await db.collection('drivers').createIndex({ rating: -1 })
  await db.collection('trips').createIndex({ city: 1, created_at: -1 })
  await db.collection('trips').createIndex({ driver_id: 1, created_at: -1 })
  await db.collection('trips').createIndex({ status: 1 })
  console.log('   ✓ Indexes created')

  // Create trips in MongoDB (for aggregation analytics)
  const tripDocs = []
  for (let i = 0; i < 200; i++) {
    const city = randomItem(cities)
    const status = Math.random() > 0.15 ? 'completed' : 'cancelled'
    const distance = parseFloat((Math.random() * 20 + 1).toFixed(2))
    const price = status === 'completed' ? parseFloat((2.5 + distance * 1.2).toFixed(2)) : 0
    const daysAgo = randomInt(0, 7)

    tripDocs.push({
      trip_id: uuidv4(),
      driver_id: randomItem(driverIds),
      passenger_id: `passenger_${randomInt(100, 999)}`,
      city,
      distance_km: distance,
      price,
      status,
      created_at: new Date(Date.now() - daysAgo * 86400000 - randomInt(0, 86400000))
    })
  }

  await db.collection('trips').insertMany(tripDocs)
  console.log(`   ✓ Created ${tripDocs.length} trips`)

  // ─── Redis ─────────────────────────────────────────────────
  console.log('\n⚡ Connecting to Redis...')
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: 3
  })

  await redis.flushdb()
  console.log('   Cleared existing data')

  // Add online drivers to geo index
  const onlineDrivers = driverDocs.filter(d => d.status !== 'offline' && d.location)
  for (let i = 0; i < onlineDrivers.length; i++) {
    const driver = onlineDrivers[i]
    const driverId = driverIds[driverDocs.indexOf(driver)]
    const [lng, lat] = driver.location.coordinates

    await redis.geoadd('drivers:locations', lng, lat, `driver:${driverId}`)
    await redis.setex(
      `driver:session:${driverId}`,
      3600,
      JSON.stringify({ status: driver.status, lat, lng, updated: Date.now() })
    )
  }
  console.log(`   ✓ Added ${onlineDrivers.length} drivers to geo index`)

  // Set city counters
  for (const city of cities) {
    const cityKey = city.toLowerCase()
    const online = driverDocs.filter(d => d.city === city && d.status === 'online').length
    const rides = randomInt(20, 150)

    await redis.set(`city:${cityKey}:online_drivers`, online)
    await redis.set(`city:${cityKey}:rides_today`, rides)
  }
  console.log('   ✓ City counters set')

  // Leaderboard
  const topDrivers = driverDocs
    .filter(d => d.status !== 'offline')
    .slice(0, 15)
  for (let i = 0; i < topDrivers.length; i++) {
    const driverId = driverIds[driverDocs.indexOf(topDrivers[i])]
    await redis.zadd('leaderboard:drivers:today', randomInt(5, 50), `driver:${driverId}`)
  }
  await redis.expire('leaderboard:drivers:today', 86400)
  console.log('   ✓ Leaderboard populated')

  // ─── Cassandra ─────────────────────────────────────────────
  console.log('\n🗄️  Connecting to Cassandra...')
  const cassClient = new cassandra.Client({
    contactPoints: CASSANDRA_HOSTS,
    localDataCenter: CASSANDRA_DC,
    socketOptions: { connectTimeout: 30000, readTimeout: 30000 }
  })

  await cassClient.connect()
  console.log('   Connected')

  // Create keyspace
  await cassClient.execute(`
    CREATE KEYSPACE IF NOT EXISTS drivetrack
    WITH replication = { 'class': 'SimpleStrategy', 'replication_factor': '1' }
  `)

  // Create tables using fully qualified names (avoids USE keyspace connection-pool race)
  await cassClient.execute(`
    CREATE TABLE IF NOT EXISTS drivetrack.trips (
      city TEXT, trip_date DATE, created_at TIMESTAMP, trip_id UUID,
      driver_id TEXT, passenger_id TEXT,
      origin_lat DOUBLE, origin_lng DOUBLE, dest_lat DOUBLE, dest_lng DOUBLE,
      distance_km FLOAT, price DECIMAL, status TEXT, completed_at TIMESTAMP,
      PRIMARY KEY ((city, trip_date), created_at, trip_id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, trip_id ASC)
  `)

  await cassClient.execute(`
    CREATE TABLE IF NOT EXISTS drivetrack.trips_by_driver (
      driver_id TEXT, created_at TIMESTAMP, trip_id UUID,
      city TEXT, passenger_id TEXT, distance_km FLOAT, price DECIMAL, status TEXT,
      PRIMARY KEY (driver_id, created_at, trip_id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, trip_id ASC)
  `)

  await cassClient.execute(`
    CREATE TABLE IF NOT EXISTS drivetrack.trips_by_city_status (
      city TEXT, status TEXT, trip_date DATE, created_at TIMESTAMP, trip_id UUID,
      driver_id TEXT, price DECIMAL, distance_km FLOAT,
      PRIMARY KEY ((city, status), trip_date, created_at, trip_id)
    ) WITH CLUSTERING ORDER BY (trip_date DESC, created_at DESC, trip_id ASC)
  `)
  console.log('   ✓ Tables created')

  // Insert trip events
  const INSERT_TRIP = `
    INSERT INTO drivetrack.trips (city, trip_date, trip_id, driver_id, passenger_id,
      origin_lat, origin_lng, dest_lat, dest_lng, distance_km, price, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

  const INSERT_TRIP_BY_DRIVER = `
    INSERT INTO drivetrack.trips_by_driver (driver_id, created_at, trip_id, city, passenger_id, distance_km, price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `

  let cassandraTrips = 0
  for (const trip of tripDocs) {
    const coords = cityCoords[trip.city]
    const tripDate = trip.created_at.toISOString().split('T')[0]
    const tripUuid = cassandra.types.Uuid.random()

    await cassClient.execute(INSERT_TRIP, [
      trip.city, tripDate, tripUuid,
      trip.driver_id, trip.passenger_id,
      coords.lat + randomFloat(-0.01, 0.01),
      coords.lng + randomFloat(-0.01, 0.01),
      coords.lat + randomFloat(-0.02, 0.02),
      coords.lng + randomFloat(-0.02, 0.02),
      trip.distance_km, trip.price, trip.status, trip.created_at
    ], { prepare: true })

    await cassClient.execute(INSERT_TRIP_BY_DRIVER, [
      trip.driver_id, trip.created_at, tripUuid,
      trip.city, trip.passenger_id, trip.distance_km, trip.price, trip.status
    ], { prepare: true })

    cassandraTrips++
  }
  console.log(`   ✓ Inserted ${cassandraTrips} trip events`)

  // ─── Done ──────────────────────────────────────────────────
  console.log('\n✅ Seed complete!')
  console.log(`   • ${driverIds.length} drivers (MongoDB + Redis geo)`)
  console.log(`   • ${tripDocs.length} trips (MongoDB + Cassandra)`)
  console.log(`   • ${cities.length} city counters (Redis)`)
  console.log(`   • Leaderboard with ${topDrivers.length} drivers (Redis sorted set)`)

  await redis.quit()
  await cassClient.shutdown()
  await mongoClient.close()
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
