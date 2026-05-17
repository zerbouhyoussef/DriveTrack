import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  Car,
  Users,
  BarChart3,
  MapPin,
  Menu,
  X,
  Zap
} from 'lucide-react'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/trips', icon: Car, label: 'Trips' },
  { path: '/drivers', icon: Users, label: 'Drivers' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/map', icon: MapPin, label: 'Live Map' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface-light text-text"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative z-40 h-screen
          ${collapsed ? 'w-20' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          transition-all duration-300 ease-in-out
          glass border-r border-border flex flex-col
        `}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse-glow">
            <Zap className="text-primary" size={22} />
          </div>
          {!collapsed && (
            <div className="animate-slide-in">
              <h1 className="text-lg font-bold gradient-text">DriveTrack</h1>
              <p className="text-xs text-text-muted">Ride Platform</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl
                transition-all duration-200 group
                ${isActive
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-text-muted hover:text-text hover:bg-surface-lighter/50'
                }
              `}
            >
              <item.icon size={20} className="shrink-0 group-hover:scale-110 transition-transform" />
              {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle (desktop) */}
        <div className="hidden lg:block p-4 border-t border-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                       text-text-muted hover:text-text hover:bg-surface-lighter/50 transition-all text-sm"
          >
            <Menu size={16} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* Status indicator */}
        <div className={`p-4 border-t border-border ${collapsed ? 'text-center' : ''}`}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            {!collapsed && <span className="text-xs text-text-muted">System Online</span>}
          </div>
        </div>
      </aside>
    </>
  )
}
