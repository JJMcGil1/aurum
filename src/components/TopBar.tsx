import { Link } from 'react-router-dom'
import { Search, Bell, Sun, Moon } from 'lucide-react'
import aurumLogo from '../assets/aurum-logo.svg'
import { useTheme } from '../lib/theme'

export function TopBar() {
  const [theme, toggleTheme] = useTheme()
  const isDark = theme === 'dark'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link to="/" className="topbar-brand no-drag" title="Home">
          <img src={aurumLogo} alt="Aurum" className="topbar-logo" />
        </Link>
      </div>
      <div className="topbar-right no-drag">
        <button className="topbar-icon-btn" aria-label="Search">
          <Search />
        </button>
        <button className="topbar-icon-btn" aria-label="Notifications">
          <Bell />
        </button>
        <button
          className="topbar-icon-btn"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
          onClick={toggleTheme}
        >
          {isDark ? <Sun /> : <Moon />}
        </button>
      </div>
    </header>
  )
}
