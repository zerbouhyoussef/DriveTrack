import { useEffect, useState } from 'react'

export default function StatCard({ title, value, icon: Icon, trend, trendUp, variant = 'blue', delay = 0 }) {
  const [visible, setVisible] = useState(false)
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  useEffect(() => {
    if (!visible) return
    const numValue = typeof value === 'number' ? value : parseInt(value) || 0
    if (numValue === 0) { setDisplayValue(value); return }

    let start = 0
    const duration = 1000
    const step = numValue / (duration / 16)
    const interval = setInterval(() => {
      start += step
      if (start >= numValue) {
        setDisplayValue(typeof value === 'string' ? value : numValue)
        clearInterval(interval)
      } else {
        setDisplayValue(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(interval)
  }, [visible, value])

  const variantClass = {
    blue: 'stat-card-blue',
    green: 'stat-card-green',
    yellow: 'stat-card-yellow',
    red: 'stat-card-red',
  }[variant]

  if (!visible) return <div className="h-32 rounded-2xl bg-surface/50 animate-pulse" />

  return (
    <div className={`${variantClass} rounded-2xl p-5 animate-fade-in transition-all hover:scale-[1.02] cursor-default`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-muted text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-text mt-1 animate-count-up">
            {displayValue}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <Icon size={20} className="text-text-muted" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          <span className={`text-xs font-medium ${trendUp ? 'text-accent' : 'text-danger'}`}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
          <span className="text-xs text-text-muted">vs last week</span>
        </div>
      )}
    </div>
  )
}
