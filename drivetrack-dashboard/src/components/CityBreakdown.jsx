import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const data = [
  { city: 'Madrid', trips: 1240, revenue: 15800, drivers: 89 },
  { city: 'Barcelona', trips: 980, revenue: 12400, drivers: 72 },
  { city: 'Sevilla', trips: 756, revenue: 9200, drivers: 54 },
  { city: 'Valencia', trips: 620, revenue: 7800, drivers: 45 },
  { city: 'Málaga', trips: 480, revenue: 5900, drivers: 33 },
]

const colors = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const item = data.find(d => d.city === label)
  return (
    <div className="glass-card p-3 text-sm">
      <p className="font-semibold text-text mb-1">{label}</p>
      <p className="text-primary-light">Trips: {item?.trips}</p>
      <p className="text-accent">Revenue: €{item?.revenue}</p>
      <p className="text-warning">Drivers: {item?.drivers}</p>
    </div>
  )
}

export default function CityBreakdown() {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-text">City Performance</h3>
          <p className="text-sm text-text-muted mt-0.5">Trips by city</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <XAxis dataKey="city" stroke="#9b97b0" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9b97b0" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
            <Bar dataKey="trips" radius={[8, 8, 0, 0]}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* City list */}
      <div className="mt-4 space-y-2">
        {data.map((city, i) => (
          <div key={city.city} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-lighter/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
              <span className="text-sm text-text">{city.city}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span>{city.drivers} drivers</span>
              <span className="font-medium text-text">€{city.revenue.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
