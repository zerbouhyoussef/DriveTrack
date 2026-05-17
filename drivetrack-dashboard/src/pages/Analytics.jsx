import { useState } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar
} from 'recharts'
import { TrendingUp, DollarSign, Car, Users, Database, Zap, HardDrive } from 'lucide-react'
import HeatmapChart from '../components/HeatmapChart'

const distanceBuckets = [
  { range: '0-2 km', count: 320, revenue: 960, color: '#6366f1' },
  { range: '2-5 km', count: 580, revenue: 3480, color: '#818cf8' },
  { range: '5-10 km', count: 420, revenue: 4200, color: '#a5b4fc' },
  { range: '10-20 km', count: 180, revenue: 3600, color: '#c7d2fe' },
  { range: '20+ km', count: 60, revenue: 2400, color: '#e0e7ff' },
]

const cancellationData = [
  { city: 'Madrid', rate: 8.2, total: 1240, cancelled: 102 },
  { city: 'Barcelona', rate: 11.5, total: 980, cancelled: 113 },
  { city: 'Sevilla', rate: 6.8, total: 756, cancelled: 51 },
  { city: 'Valencia', rate: 9.1, total: 620, cancelled: 56 },
  { city: 'Málaga', rate: 12.3, total: 480, cancelled: 59 },
]

const hourlyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  trips: Math.floor(Math.random() * 40) + (i >= 7 && i <= 20 ? 30 : 5),
  revenue: Math.floor(Math.random() * 500) + (i >= 7 && i <= 20 ? 300 : 50),
}))

const pieData = [
  { name: 'Completed', value: 78, color: '#10b981' },
  { name: 'Cancelled', value: 12, color: '#ef4444' },
  { name: 'Active', value: 7, color: '#6366f1' },
  { name: 'Pending', value: 3, color: '#f59e0b' },
]

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card p-2 text-xs">
      <p className="text-text">{payload[0].name}: {payload[0].value}%</p>
    </div>
  )
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'demand', label: 'Demand' },
    { id: 'databases', label: 'Databases' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Analytics</h1>
          <p className="text-text-muted text-sm mt-1">Deep insights into platform performance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-light border border-border w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab.id
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'text-text-muted hover:text-text'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trip Status Pie */}
            <div className="glass-card p-5">
              <h3 className="font-semibold text-text mb-4">Trip Status Distribution</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {pieData.map(item => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-text-muted">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cancellation Rates */}
            <div className="glass-card p-5 lg:col-span-2">
              <h3 className="font-semibold text-text mb-4">Cancellation Rate by City</h3>
              <div className="space-y-3">
                {cancellationData.map(city => (
                  <div key={city.city} className="flex items-center gap-3">
                    <span className="text-sm text-text w-24">{city.city}</span>
                    <div className="flex-1 h-6 rounded-full bg-surface-lighter overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-danger/80 to-danger/40 transition-all duration-1000"
                        style={{ width: `${city.rate * 5}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-danger w-12 text-right">{city.rate}%</span>
                    <span className="text-xs text-text-muted w-20 text-right">{city.cancelled}/{city.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Heatmap */}
          <HeatmapChart />
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          {/* Distance Buckets */}
          <div className="glass-card p-5">
            <h3 className="font-semibold text-text mb-2">Revenue by Distance Range</h3>
            <p className="text-sm text-text-muted mb-4">How trip distance correlates with revenue</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distanceBuckets} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2a45" />
                  <XAxis dataKey="range" stroke="#9b97b0" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9b97b0" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1e1b2e', border: '1px solid #2e2a45', borderRadius: '12px' }}
                    labelStyle={{ color: '#e2e0ea' }}
                  />
                  <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                    {distanceBuckets.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hourly Revenue */}
          <div className="glass-card p-5">
            <h3 className="font-semibold text-text mb-2">Hourly Revenue Pattern</h3>
            <p className="text-sm text-text-muted mb-4">Revenue distribution across 24 hours</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2a45" />
                  <XAxis dataKey="hour" stroke="#9b97b0" fontSize={10} tickLine={false} axisLine={false} interval={3} />
                  <YAxis stroke="#9b97b0" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1e1b2e', border: '1px solid #2e2a45', borderRadius: '12px' }}
                    labelStyle={{ color: '#e2e0ea' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="trips" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Demand Tab */}
      {activeTab === 'demand' && (
        <div className="space-y-6">
          <HeatmapChart />

          <div className="glass-card p-5">
            <h3 className="font-semibold text-text mb-2">Hourly Trip Volume</h3>
            <p className="text-sm text-text-muted mb-4">Number of trips per hour today</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2a45" />
                  <XAxis dataKey="hour" stroke="#9b97b0" fontSize={10} tickLine={false} axisLine={false} interval={3} />
                  <YAxis stroke="#9b97b0" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1e1b2e', border: '1px solid #2e2a45', borderRadius: '12px' }}
                    labelStyle={{ color: '#e2e0ea' }}
                  />
                  <Bar dataKey="trips" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Databases Tab */}
      {activeTab === 'databases' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* MongoDB */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                  <Database size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-text">MongoDB</h3>
                  <p className="text-xs text-text-muted">Document Store</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Role</span>
                  <span className="text-text">Profiles & Analytics</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Collections</span>
                  <span className="text-text">drivers, trips</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Indexes</span>
                  <span className="text-accent">8 active</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Features</span>
                  <span className="text-text">Aggregation, $geoNear</span>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-xs text-accent">Connected</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Redis */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center">
                  <Zap size={20} className="text-danger" />
                </div>
                <div>
                  <h3 className="font-semibold text-text">Redis</h3>
                  <p className="text-xs text-text-muted">In-Memory Cache</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Role</span>
                  <span className="text-text">Live State & Geo</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Structures</span>
                  <span className="text-text">Geo, Sorted Sets, KV</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Commands</span>
                  <span className="text-danger">GEORADIUS, ZREVRANGE</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Features</span>
                  <span className="text-text">Pipeline, TTL, Pub/Sub</span>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-xs text-accent">Connected</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cassandra */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <HardDrive size={20} className="text-primary-light" />
                </div>
                <div>
                  <h3 className="font-semibold text-text">Cassandra</h3>
                  <p className="text-xs text-text-muted">Wide-Column Store</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Role</span>
                  <span className="text-text">Trip Event Log</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Tables</span>
                  <span className="text-text">trips, trips_by_driver</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Consistency</span>
                  <span className="text-primary-light">LOCAL_QUORUM</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Pattern</span>
                  <span className="text-text">Append-only, Denorm.</span>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-xs text-accent">Connected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Architecture diagram */}
          <div className="glass-card p-6">
            <h3 className="font-semibold text-text mb-4">Data Flow Architecture</h3>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-sm text-primary-light">
                  📱 Passenger App
                </div>
                <span className="text-text-muted">→</span>
                <div className="px-4 py-2 rounded-xl bg-warning/10 border border-warning/30 text-sm text-warning">
                  ⚡ Fastify API
                </div>
                <span className="text-text-muted">→</span>
                <div className="flex flex-col gap-2">
                  <div className="px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger">
                    Redis (Live State)
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary-light">
                    Cassandra (Events)
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-xs text-accent">
                    MongoDB (Analytics)
                  </div>
                </div>
              </div>
              <p className="text-xs text-text-muted text-center mt-2 max-w-md">
                Each database handles what it does best: Redis for real-time geo & sessions,
                Cassandra for immutable trip events, MongoDB for flexible aggregation queries.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
