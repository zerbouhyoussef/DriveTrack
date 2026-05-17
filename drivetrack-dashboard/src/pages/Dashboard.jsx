import { Car, Users, DollarSign, TrendingUp, Activity, MapPin } from 'lucide-react'
import StatCard from '../components/StatCard'
import RevenueChart from '../components/RevenueChart'
import ActivityFeed from '../components/ActivityFeed'
import Leaderboard from '../components/Leaderboard'
import CityBreakdown from '../components/CityBreakdown'

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-text-muted text-sm mt-1">Real-time platform overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 border border-accent/30">
            <Activity size={14} className="text-accent" />
            <span className="text-xs font-medium text-accent">Live Mode</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-surface-lighter text-xs text-text-muted">
            Last updated: just now
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Trips"
          value={24}
          icon={Car}
          trend="12%"
          trendUp={true}
          variant="blue"
          delay={0}
        />
        <StatCard
          title="Online Drivers"
          value={156}
          icon={Users}
          trend="8%"
          trendUp={true}
          variant="green"
          delay={100}
        />
        <StatCard
          title="Revenue Today"
          value="€4,280"
          icon={DollarSign}
          trend="23%"
          trendUp={true}
          variant="yellow"
          delay={200}
        />
        <StatCard
          title="Trips Today"
          value={342}
          icon={TrendingUp}
          trend="5%"
          trendUp={false}
          variant="red"
          delay={300}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart />
        <CityBreakdown />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Leaderboard />
        <ActivityFeed />
      </div>
    </div>
  )
}
