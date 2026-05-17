import { useState } from 'react'
import { MapPin, Navigation, Car, Users, Locate, ZoomIn, ZoomOut, Layers } from 'lucide-react'

const mockDriverLocations = [
  { id: '1', name: 'Carlos M.', status: 'online', lat: 37.389, lng: -5.984, city: 'Sevilla' },
  { id: '2', name: 'Ana R.', status: 'on_trip', lat: 37.392, lng: -5.990, city: 'Sevilla' },
  { id: '3', name: 'Pedro L.', status: 'online', lat: 37.385, lng: -5.978, city: 'Sevilla' },
  { id: '4', name: 'María G.', status: 'online', lat: 37.395, lng: -5.982, city: 'Sevilla' },
  { id: '5', name: 'Juan P.', status: 'on_trip', lat: 37.388, lng: -5.995, city: 'Sevilla' },
  { id: '6', name: 'Laura S.', status: 'online', lat: 37.380, lng: -5.970, city: 'Sevilla' },
  { id: '7', name: 'Diego F.', status: 'online', lat: 37.398, lng: -5.988, city: 'Sevilla' },
  { id: '8', name: 'Sofia T.', status: 'on_trip', lat: 37.383, lng: -5.992, city: 'Sevilla' },
]

export default function LiveMap() {
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [zoom, setZoom] = useState(14)

  const onlineCount = mockDriverLocations.filter(d => d.status === 'online').length
  const onTripCount = mockDriverLocations.filter(d => d.status === 'on_trip').length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Live Map</h1>
          <p className="text-text-muted text-sm mt-1">Real-time driver positions via Redis GEORADIUS</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 border border-accent/30">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-medium text-accent">{onlineCount} Online</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs font-medium text-primary-light">{onTripCount} On Trip</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Area */}
        <div className="lg:col-span-3 glass-card p-0 overflow-hidden relative" style={{ minHeight: '500px' }}>
          {/* Simulated Map Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-light to-surface-lighter">
            {/* Grid lines to simulate map */}
            <div className="absolute inset-0 opacity-10">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={`h-${i}`} className="absolute w-full h-px bg-primary" style={{ top: `${i * 5}%` }} />
              ))}
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={`v-${i}`} className="absolute h-full w-px bg-primary" style={{ left: `${i * 5}%` }} />
              ))}
            </div>

            {/* Road-like lines */}
            <div className="absolute top-1/4 left-0 right-0 h-0.5 bg-text-muted/20" />
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-text-muted/20" />
            <div className="absolute top-3/4 left-0 right-0 h-0.5 bg-text-muted/20" />
            <div className="absolute left-1/4 top-0 bottom-0 w-0.5 bg-text-muted/20" />
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-text-muted/20" />
            <div className="absolute left-3/4 top-0 bottom-0 w-0.5 bg-text-muted/20" />

            {/* Diagonal roads */}
            <div className="absolute top-0 left-0 w-full h-full">
              <div className="absolute w-[141%] h-0.5 bg-text-muted/15 origin-top-left rotate-45" style={{ top: '20%' }} />
              <div className="absolute w-[141%] h-0.5 bg-text-muted/15 origin-top-left -rotate-30" style={{ top: '60%' }} />
            </div>

            {/* Driver markers */}
            {mockDriverLocations.map((driver) => {
              const x = ((driver.lng + 6.0) / 0.04) * 100
              const y = ((37.4 - driver.lat) / 0.025) * 100
              const isSelected = selectedDriver?.id === driver.id
              const isOnTrip = driver.status === 'on_trip'

              return (
                <button
                  key={driver.id}
                  onClick={() => setSelectedDriver(isSelected ? null : driver)}
                  className={`
                    absolute transform -translate-x-1/2 -translate-y-1/2
                    transition-all duration-300 z-10
                    ${isSelected ? 'scale-150 z-20' : 'hover:scale-125'}
                  `}
                  style={{ left: `${Math.min(90, Math.max(10, x))}%`, top: `${Math.min(85, Math.max(10, y))}%` }}
                  title={`${driver.name} - ${driver.status}`}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    ${isOnTrip ? 'bg-primary shadow-lg shadow-primary/40' : 'bg-accent shadow-lg shadow-accent/40'}
                    ${isSelected ? 'ring-2 ring-white/50' : ''}
                  `}>
                    <Car size={14} className="text-white" />
                  </div>
                  {isSelected && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap
                                    glass-card px-3 py-2 text-xs animate-fade-in z-30">
                      <p className="font-semibold text-text">{driver.name}</p>
                      <p className="text-text-muted">{driver.status === 'on_trip' ? 'On Trip' : 'Available'}</p>
                    </div>
                  )}
                  {/* Pulse ring for online drivers */}
                  {!isOnTrip && (
                    <div className="absolute inset-0 rounded-full bg-accent/30 animate-ping" />
                  )}
                </button>
              )
            })}

            {/* City label */}
            <div className="absolute bottom-4 left-4 glass px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-primary-light" />
                <span className="text-sm text-text font-medium">Sevilla, Spain</span>
              </div>
            </div>
          </div>

          {/* Map Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <button
              onClick={() => setZoom(Math.min(zoom + 1, 18))}
              className="w-9 h-9 rounded-lg glass flex items-center justify-center hover:bg-surface-lighter transition-colors"
            >
              <ZoomIn size={16} className="text-text" />
            </button>
            <button
              onClick={() => setZoom(Math.max(zoom - 1, 10))}
              className="w-9 h-9 rounded-lg glass flex items-center justify-center hover:bg-surface-lighter transition-colors"
            >
              <ZoomOut size={16} className="text-text" />
            </button>
            <button className="w-9 h-9 rounded-lg glass flex items-center justify-center hover:bg-surface-lighter transition-colors">
              <Locate size={16} className="text-text" />
            </button>
            <button className="w-9 h-9 rounded-lg glass flex items-center justify-center hover:bg-surface-lighter transition-colors">
              <Layers size={16} className="text-text" />
            </button>
          </div>

          {/* Zoom indicator */}
          <div className="absolute top-4 left-4 glass px-3 py-1.5 rounded-lg">
            <span className="text-xs text-text-muted">Zoom: {zoom}x</span>
          </div>
        </div>

        {/* Sidebar - Driver List */}
        <div className="glass-card p-4 max-h-[560px] overflow-y-auto">
          <h3 className="font-semibold text-text mb-3 flex items-center gap-2">
            <Navigation size={16} className="text-primary-light" />
            Nearby Drivers
          </h3>
          <p className="text-xs text-text-muted mb-4">
            Redis GEORADIUS — 10km radius
          </p>

          <div className="space-y-2">
            {mockDriverLocations.map((driver) => {
              const isSelected = selectedDriver?.id === driver.id
              const isOnTrip = driver.status === 'on_trip'

              return (
                <button
                  key={driver.id}
                  onClick={() => setSelectedDriver(isSelected ? null : driver)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all
                    ${isSelected
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-surface/30 border border-transparent hover:bg-surface-lighter/40 hover:border-border'
                    }
                  `}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center shrink-0
                    ${isOnTrip ? 'bg-primary/20' : 'bg-accent/20'}
                  `}>
                    <Car size={14} className={isOnTrip ? 'text-primary-light' : 'text-accent'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{driver.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${isOnTrip ? 'bg-primary' : 'bg-accent animate-pulse'}`} />
                      <span className="text-xs text-text-muted">
                        {isOnTrip ? 'On Trip' : 'Available'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-text-muted">
                    {(Math.random() * 3 + 0.5).toFixed(1)} km
                  </span>
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <p className="text-xs text-text-muted font-medium">Legend</p>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-accent" />
              <span className="text-xs text-text-muted">Online / Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary" />
              <span className="text-xs text-text-muted">On Trip</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
