import { Trophy, Star, TrendingUp } from 'lucide-react'

const drivers = [
  { rank: 1, name: 'Carlos Martínez', city: 'Madrid', trips: 47, rating: 4.9, earned: '€580' },
  { rank: 2, name: 'Ana Rodríguez', city: 'Barcelona', trips: 42, rating: 4.8, earned: '€520' },
  { rank: 3, name: 'Pedro López', city: 'Sevilla', trips: 38, rating: 4.9, earned: '€470' },
  { rank: 4, name: 'María García', city: 'Valencia', trips: 35, rating: 4.7, earned: '€430' },
  { rank: 5, name: 'Juan Pérez', city: 'Madrid', trips: 33, rating: 4.8, earned: '€410' },
]

const rankColors = {
  1: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/40',
  2: 'from-gray-300/15 to-gray-400/5 border-gray-400/30',
  3: 'from-amber-700/15 to-amber-800/5 border-amber-700/30',
}

export default function Leaderboard() {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-warning" />
          <h3 className="font-semibold text-text">Top Drivers Today</h3>
        </div>
        <span className="text-xs text-text-muted px-2 py-1 rounded-full bg-surface-lighter/50">
          Live ranking
        </span>
      </div>

      <div className="space-y-2">
        {drivers.map((driver, i) => (
          <div
            key={driver.rank}
            className={`
              flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]
              ${rankColors[driver.rank]
                ? `bg-gradient-to-r ${rankColors[driver.rank]} border`
                : 'bg-surface/30 border border-transparent hover:border-border'
              }
              animate-fade-in
            `}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Rank */}
            <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
              ${driver.rank <= 3 ? 'bg-white/10 text-warning' : 'bg-surface-lighter text-text-muted'}
            `}>
              {driver.rank}
            </div>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-light">
                {driver.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">{driver.name}</p>
              <p className="text-xs text-text-muted">{driver.city}</p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-right">
              <div className="hidden sm:block">
                <div className="flex items-center gap-1">
                  <Star size={11} className="text-warning fill-warning" />
                  <span className="text-xs text-text">{driver.rating}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <TrendingUp size={11} className="text-accent" />
                  <span className="text-xs text-text">{driver.trips}</span>
                </div>
              </div>
              <div className="min-w-[50px]">
                <span className="text-sm font-semibold text-accent">{driver.earned}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
