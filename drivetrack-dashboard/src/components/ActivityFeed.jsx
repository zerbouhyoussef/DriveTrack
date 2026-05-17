import { Car, CheckCircle, XCircle, MapPin, Clock } from 'lucide-react'

const activities = [
  { id: 1, type: 'completed', driver: 'Carlos M.', city: 'Sevilla', price: '€12.50', time: '2 min ago' },
  { id: 2, type: 'requested', driver: 'Ana R.', city: 'Madrid', price: '€8.30', time: '4 min ago' },
  { id: 3, type: 'cancelled', driver: 'Pedro L.', city: 'Barcelona', price: '€0', time: '5 min ago' },
  { id: 4, type: 'completed', driver: 'María G.', city: 'Valencia', price: '€15.80', time: '7 min ago' },
  { id: 5, type: 'completed', driver: 'Juan P.', city: 'Sevilla', price: '€9.20', time: '10 min ago' },
  { id: 6, type: 'requested', driver: 'Laura S.', city: 'Málaga', price: '€11.00', time: '12 min ago' },
  { id: 7, type: 'completed', driver: 'Diego F.', city: 'Madrid', price: '€22.40', time: '15 min ago' },
]

const typeConfig = {
  completed: { icon: CheckCircle, color: 'text-accent', bg: 'bg-accent/10', label: 'Completed' },
  requested: { icon: Car, color: 'text-primary-light', bg: 'bg-primary/10', label: 'Requested' },
  cancelled: { icon: XCircle, color: 'text-danger', bg: 'bg-danger/10', label: 'Cancelled' },
}

export default function ActivityFeed() {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text">Live Activity</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs text-text-muted">Real-time</span>
        </div>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {activities.map((activity, i) => {
          const config = typeConfig[activity.type]
          const Icon = config.icon
          return (
            <div
              key={activity.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface/30 hover:bg-surface-lighter/40 transition-all animate-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                <Icon size={16} className={config.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text truncate">{activity.driver}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <MapPin size={11} className="text-text-muted" />
                  <span className="text-xs text-text-muted">{activity.city}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-text">{activity.price}</p>
                <div className="flex items-center gap-1 justify-end">
                  <Clock size={10} className="text-text-muted" />
                  <span className="text-xs text-text-muted">{activity.time}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
