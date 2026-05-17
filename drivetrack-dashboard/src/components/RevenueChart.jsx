import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const data = [
  { day: 'Mon', revenue: 2400, trips: 145 },
  { day: 'Tue', revenue: 3200, trips: 198 },
  { day: 'Wed', revenue: 2800, trips: 167 },
  { day: 'Thu', revenue: 3600, trips: 210 },
  { day: 'Fri', revenue: 4200, trips: 256 },
  { day: 'Sat', revenue: 5100, trips: 312 },
  { day: 'Sun', revenue: 4600, trips: 289 },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card p-3 text-sm">
      <p className="font-semibold text-text mb-1">{label}</p>
      <p className="text-primary-light">Revenue: €{payload[0].value}</p>
      <p className="text-accent">Trips: {payload[1]?.value}</p>
    </div>
  )
}

export default function RevenueChart() {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-text">Revenue Overview</h3>
          <p className="text-sm text-text-muted mt-0.5">Weekly performance</p>
        </div>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-text-muted">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <span className="text-text-muted">Trips</span>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2e2a45" />
            <XAxis dataKey="day" stroke="#9b97b0" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9b97b0" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#colorRevenue)"
            />
            <Area
              type="monotone"
              dataKey="trips"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#colorTrips)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
