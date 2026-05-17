import { useState } from 'react'
import { Search, Filter, Car, CheckCircle, XCircle, Clock, MapPin, ChevronDown } from 'lucide-react'

const mockTrips = [
  { id: 'trip-001', driver: 'Carlos M.', passenger: 'User_A1', city: 'Madrid', status: 'completed', price: 12.50, distance: 5.2, time: '14:32', date: '2025-05-17' },
  { id: 'trip-002', driver: 'Ana R.', passenger: 'User_B2', city: 'Barcelona', status: 'active', price: 8.30, distance: 3.4, time: '14:45', date: '2025-05-17' },
  { id: 'trip-003', driver: 'Pedro L.', passenger: 'User_C3', city: 'Sevilla', status: 'cancelled', price: 0, distance: 0, time: '14:20', date: '2025-05-17' },
  { id: 'trip-004', driver: 'María G.', passenger: 'User_D4', city: 'Valencia', status: 'completed', price: 15.80, distance: 7.1, time: '13:55', date: '2025-05-17' },
  { id: 'trip-005', driver: 'Juan P.', passenger: 'User_E5', city: 'Madrid', status: 'completed', price: 9.20, distance: 4.0, time: '13:40', date: '2025-05-17' },
  { id: 'trip-006', driver: 'Laura S.', passenger: 'User_F6', city: 'Málaga', status: 'pending', price: 11.00, distance: 4.8, time: '14:50', date: '2025-05-17' },
  { id: 'trip-007', driver: 'Diego F.', passenger: 'User_G7', city: 'Madrid', status: 'completed', price: 22.40, distance: 12.3, time: '12:15', date: '2025-05-17' },
  { id: 'trip-008', driver: 'Sofia T.', passenger: 'User_H8', city: 'Barcelona', status: 'active', price: 14.60, distance: 6.5, time: '14:55', date: '2025-05-17' },
  { id: 'trip-009', driver: 'Miguel A.', passenger: 'User_I9', city: 'Sevilla', status: 'completed', price: 7.80, distance: 3.1, time: '11:30', date: '2025-05-17' },
  { id: 'trip-010', driver: 'Elena V.', passenger: 'User_J0', city: 'Valencia', status: 'completed', price: 18.90, distance: 9.2, time: '10:45', date: '2025-05-17' },
]

const statusConfig = {
  completed: { icon: CheckCircle, color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/30' },
  active: { icon: Car, color: 'text-primary-light', bg: 'bg-primary/10', border: 'border-primary/30' },
  cancelled: { icon: XCircle, color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/30' },
  pending: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
}

export default function Trips() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedTrip, setSelectedTrip] = useState(null)

  const filtered = mockTrips.filter(trip => {
    const matchSearch = trip.driver.toLowerCase().includes(search.toLowerCase()) ||
                        trip.city.toLowerCase().includes(search.toLowerCase()) ||
                        trip.id.includes(search)
    const matchStatus = statusFilter === 'all' || trip.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Trips</h1>
          <p className="text-text-muted text-sm mt-1">Manage and monitor all trips</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted bg-surface-lighter px-3 py-1.5 rounded-lg">
            {filtered.length} trips
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by driver, city, or trip ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-light border border-border
                       text-text text-sm placeholder:text-text-muted
                       focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                       transition-all"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-9 pr-10 py-2.5 rounded-xl bg-surface-light border border-border
                       text-text text-sm focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
      </div>

      {/* Trip List */}
      <div className="space-y-2">
        {filtered.map((trip, i) => {
          const config = statusConfig[trip.status]
          const Icon = config.icon
          const isSelected = selectedTrip?.id === trip.id

          return (
            <div
              key={trip.id}
              onClick={() => setSelectedTrip(isSelected ? null : trip)}
              className={`
                glass-card p-4 cursor-pointer transition-all animate-fade-in
                ${isSelected ? 'border-primary/40 bg-primary/5' : ''}
              `}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-4">
                {/* Status icon */}
                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
                  <Icon size={18} className={config.color} />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 items-center">
                  <div>
                    <p className="text-sm font-medium text-text">{trip.driver}</p>
                    <p className="text-xs text-text-muted">{trip.id}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-text-muted" />
                    <span className="text-sm text-text-muted">{trip.city}</span>
                  </div>
                  <div className="text-sm text-text-muted">
                    {trip.distance > 0 ? `${trip.distance} km` : '—'}
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className={`text-xs px-2 py-1 rounded-lg ${config.bg} ${config.color} border ${config.border}`}>
                      {trip.status}
                    </span>
                    <span className="text-sm font-semibold text-text">
                      {trip.price > 0 ? `€${trip.price.toFixed(2)}` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {isSelected && (
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in">
                  <div>
                    <p className="text-xs text-text-muted">Passenger</p>
                    <p className="text-sm text-text mt-0.5">{trip.passenger}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Time</p>
                    <p className="text-sm text-text mt-0.5">{trip.time}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Date</p>
                    <p className="text-sm text-text mt-0.5">{trip.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Distance</p>
                    <p className="text-sm text-text mt-0.5">{trip.distance} km</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Car size={48} className="mx-auto text-text-muted/30 mb-3" />
          <p className="text-text-muted">No trips found</p>
        </div>
      )}
    </div>
  )
}
