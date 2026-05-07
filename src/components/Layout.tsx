import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Wallet,
  CalendarDays,
  PiggyBank,
  Target,
  TrendingUp,
  Landmark,
  Settings as SettingsIcon,
} from 'lucide-react'
import { TopBar } from './TopBar'
import { ChatDock } from './ChatDock'

const railNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/budgets', icon: PiggyBank, label: 'Budgets' },
  { to: '/savings', icon: Landmark, label: 'Savings' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/net-worth', icon: TrendingUp, label: 'Net Worth' },
  { to: '/family', icon: Users, label: 'Family' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
]

export function Layout() {
  return (
    <div className="app-layout">
      <TopBar />
      <div className="app-body">
        <aside className="left-rail">
          <nav className="left-rail-nav">
            {railNavItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={label}
                aria-label={label}
                className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}
              >
                <Icon />
                <span className="rail-label">{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="main-content">
          <div className="main-content-body">
            <Outlet />
          </div>
        </main>
        <ChatDock />
      </div>
    </div>
  )
}
