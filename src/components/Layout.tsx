import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Receipt, Users } from 'lucide-react'
import aurumLogo from '../assets/aurum-logo.svg'

const topNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
]

const bottomNavItems = [
  { to: '/family', icon: Users, label: 'Family' },
]

export function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={aurumLogo} alt="Aurum" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-nav-top">
            {topNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon />
                {label}
              </NavLink>
            ))}
          </div>
          <div className="sidebar-nav-bottom">
            {bottomNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
