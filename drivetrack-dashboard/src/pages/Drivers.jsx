import { useState } from 'react'
import { Search, Star, MapPin, Car, Wifi, WifiOff, Phone, ChevronDown } from 'lucide-react'

const mockDrivers = [
  { id: '1', name: 'Carlos Martínez', city: 'Madrid', status: 'online', rating: 4.9, trips: 1240, vehicle: { model: 'Toyota Corolla', plate: '1234-ABC', color: 'White' }, phone: '+34 612 345 678' },
  { id: '2', name: 'Ana Rodríguez', city: 'Barcelona', status: 'on_trip', rating: 4.8, trips: 980, vehicle: { model: 'Seat León', plate: '5678-DEF', color: 'Black' }, phone: '+34 623 456 789' },
  { id: '3', name: 'Pedro López', city: 'Sevilla', status: 'online', rating: 4.9, trips: 756, vehicle: { model: 'Hyundai Tucson', plate: '9012-GHI', color: 'Blue' }, phone: '+34 634 567 890' },
  { id: '4', name: 'María García', city: 'Valencia', status: 'offline', rating: 4.7, trips: 620, vehicle: { model: 'Renault Clio', plate: '3456-JKL', color: 'Red' }, phone: '+34 645 678 901' },
  { id: '5', name: 'Juan Pérez', city: 'Madrid', status: 'online', rating: 4.8, trips: 480, vehicle: { model: 'VW Golf', plate: '7890-MNO', color: 'Gray' }, phone: '+34 656 789 012' },
  { id: '6', name: 'Laura Sánchez', city: 'Málaga', status: 'on_trip', rating: 4.6, trips: 390, vehicle: { model: 'Ford Focus', plate: '1234-PQR', color: 'Silver' }, phone: '+34 667 890 123' },
  { id: '7', name: 'Diego Fernández', city: 'Madrid', status: 'online', rating: 4.9, trips: 1100, vehicle: { model: 'BMW 320', plate: '5678-STU', color: 'Black' }, phone: '+34 678 901 234' },
  { id: '8', name: 'Sofia Torres', city: 'Barcelona', status: 'offline', rating: 4.5, trips: 280, vehicle: { model: 'Peugeot 208', plate: '9012-VWX', color: 'White' }, phone: '+34 689 012 345' },
]

const statusConfig = {
  online: { label: 'Online', color: 'text-accent', bg: 'bg-accent/10', dot: 'bg-accent' },
  on_trip: { label: 'On Trip', color: 'text-primary-light', bg: 'bg-primary/10', dot: 'bg-primary' },
  offline: { label: 'Offline', color: 'text-text-muted', bg: 'bg-surface-lighter', dot: 'bg-text-muted' },
}

export default function Drivers() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedDriver, setSelectedDriver] = useState(null)

  const filtered = mockDrivers.filter(driver => {
    const matchSearch = driver.name.toLowerCase().includes(search.toLowerCase()) ||
                        driver.city.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || driver.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: mockDrivers.length,
    online: mockDrivers.filter(d => d.status === 'online').length,
    onTrip: mockDrivers.filter(d => d.status === 'on_trip').length,
    offline: mockDrivers.filter(d => d.status === 'offline').length,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Drivers</h1>
          <p className="text-text-muted text-sm mt-1">Manage your driver fleet</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-text">{stats.total}</p>
          <p className="text-xs text-text-muted mt-1">Total</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-accent">{stats.online}</p>
          <p className="text-xs text-text-muted mt-1">Online</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-primary-light">{stats.onTrip}</p>
          <p className="text-xs text-text-muted mt-1">On Trip</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-text-muted">{stats.offline}</p>
          <p className="text-xs text-text-muted mt-1">Offline</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search drivers by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-light border border-border
                       text-text text-sm placeholder:text-text-muted
                       focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                       transition-all"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 rounded-xl bg-surface-light border border-border
                       text-text text-sm focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="on_trip">On Trip</option>
            <option value="offline">Offline</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
      </div>

      {/* Driver Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((driver, i) => {
          const config = statusConfig[driver.status]
          const isSelected = selectedDriver?.id === driver.id

          return (
            <div
              key={driver.id}
              onClick={() => setSelectedDriver(isSelected ? null : driver)}
              className={`
                glass-card p-5 cursor-pointer animate-fade-in
                ${isSelected ? 'border-primary/40' : ''}
              `}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold text-primary-light">
                    {driver.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-text truncate">{driver.name}</h3>
                    <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${config.bg} ${config.color}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${config.dot} ${driver.status === 'online' ? 'animate-pulse' : ''}`} />
                      {config.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} />
                      <span>{driver.city}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-warning fill-warning" />
                      <span>{driver.rating}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Car size={12} />
                      <span>{driver.trips} trips</span>
                    </div>
                  </div>

                  {/* Vehicle */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                    <span className="px-2 py-0.5 rounded bg-surface-lighter">{driver.vehicle.model}</span>
                    <span className="px-2 py-0.5 rounded bg-surface-lighter">{driver.vehicle.plate}</span>
                    <span className="px-2 py-0.5 rounded bg-surface-lighter">{driver.vehicle.color}</span>
                  </div>
                </div>
              </div>

              {/* Expanded */}
              {isSelected && (
                <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-text-muted">Phone</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Phone size={12} className="text-primary-light" />
                        <span className="text-sm text-text">{driver.phone}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Total Trips</p>
                      <p className="text-sm text-text mt-1 font-semibold">{driver.trips.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button className="flex-1 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                      View History
                    </button>
                    <button className="flex-1 py-2 rounded-lg bg-surface-lighter text-text-muted text-xs font-medium hover:bg-surface-lighter/80 transition-colors">
                      Send Message
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-text-muted/30 mb-3" />
          <p className="text-text-muted">No drivers found</p>
        </div>
      )}
    </div>
  )
}
