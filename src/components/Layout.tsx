import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Wallet,
  CalendarDays,
  PiggyBank,
  Target,
  TrendingUp,
  Landmark,
  Receipt,
  MessageSquare,
  Settings as SettingsIcon,
} from 'lucide-react'
import { TopBar } from './TopBar'
import { ChatDock } from './ChatDock'
import { ProfileTile } from './ProfileTile'

const railNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/budgets', icon: PiggyBank, label: 'Budgets' },
  { to: '/savings', icon: Landmark, label: 'Savings' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/net-worth', icon: TrendingUp, label: 'Net Worth' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
]

const familyNavItem = { to: '/family', icon: Users, label: 'Family' }
const settingsNavItem = { to: '/settings', icon: SettingsIcon, label: 'Settings' }

export function Layout() {
  const location = useLocation()
  const isChatPage = location.pathname === '/chat'

  const renderRailLink = ({
    to,
    icon: Icon,
    label,
    end,
  }: {
    to: string
    icon: typeof LayoutDashboard
    label: string
    end?: boolean
  }) => (
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
  )

  return (
    <div className="app-layout">
      <div className="app-body">
        <aside className="left-rail">
          <div className="rail-top-spacer" />
          <nav className="left-rail-nav">{railNavItems.map(renderRailLink)}</nav>
          <nav className="left-rail-nav left-rail-nav-bottom">
            {renderRailLink(settingsNavItem)}
            {renderRailLink(familyNavItem)}
            <ProfileTile />
          </nav>
        </aside>
        <div className="main-column">
          <TopBar />
          <div className="main-row">
            <main className="main-content">
              <div className="main-content-body">
                <Outlet />
              </div>
            </main>
            {!isChatPage && <ChatDock />}
          </div>
        </div>
      </div>
    </div>
  )
}
