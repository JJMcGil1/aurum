import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Wallet,
  CalendarDays,
  PiggyBank,
  Target,
  TrendingUp,
  Landmark,
} from 'lucide-react'
import { TopBar } from './TopBar'

const railNavItems = [
  { to: '/', icon: MessageSquare, label: 'Chat', end: true },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/budgets', icon: PiggyBank, label: 'Budgets' },
  { to: '/savings', icon: Landmark, label: 'Savings' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/net-worth', icon: TrendingUp, label: 'Net Worth' },
  { to: '/family', icon: Users, label: 'Family' },
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
      </div>
    </div>
  )
}
