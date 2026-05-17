const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hours = Array.from({ length: 24 }, (_, i) => i)

// Generate mock heatmap data
const heatmapData = days.map((day, dayIdx) =>
  hours.map((hour) => {
    let base = 0
    // Peak hours: 7-9 AM and 5-8 PM on weekdays
    if (dayIdx >= 1 && dayIdx <= 5) {
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)) base = 70
      else if (hour >= 10 && hour <= 16) base = 40
      else base = 10
    } else {
      // Weekends: peak at noon-evening
      if (hour >= 11 && hour <= 22) base = 50
      else base = 15
    }
    return base + Math.floor(Math.random() * 30)
  })
)

function getColor(value) {
  if (value >= 80) return 'bg-primary opacity-100'
  if (value >= 60) return 'bg-primary opacity-70'
  if (value >= 40) return 'bg-primary opacity-45'
  if (value >= 20) return 'bg-primary opacity-25'
  return 'bg-primary opacity-10'
}

export default function HeatmapChart() {
  return (
    <div className="glass-card p-5">
      <div className="mb-5">
        <h3 className="font-semibold text-text">Demand Heatmap</h3>
        <p className="text-sm text-text-muted mt-0.5">Trip requests by hour & day</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="flex mb-2 ml-12">
            {hours.filter((_, i) => i % 3 === 0).map(h => (
              <div key={h} className="flex-1 text-xs text-text-muted text-center">
                {h}:00
              </div>
            ))}
          </div>

          {/* Grid */}
          {days.map((day, dayIdx) => (
            <div key={day} className="flex items-center gap-2 mb-1">
              <span className="w-10 text-xs text-text-muted text-right">{day}</span>
              <div className="flex-1 flex gap-0.5">
                {heatmapData[dayIdx].map((value, hourIdx) => (
                  <div
                    key={hourIdx}
                    className={`flex-1 h-6 rounded-sm ${getColor(value)} transition-all hover:scale-y-125 cursor-default`}
                    title={`${day} ${hourIdx}:00 — ${value} trips`}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-xs text-text-muted">Less</span>
            <div className="flex gap-0.5">
              {[10, 25, 45, 70, 100].map((opacity) => (
                <div
                  key={opacity}
                  className="w-4 h-4 rounded-sm bg-primary"
                  style={{ opacity: opacity / 100 }}
                />
              ))}
            </div>
            <span className="text-xs text-text-muted">More</span>
          </div>
        </div>
      </div>
    </div>
  )
}
