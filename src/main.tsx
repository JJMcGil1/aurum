import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { initTheme } from './lib/theme'
import { Layout } from './components/Layout'

initTheme()
import { Dashboard } from './pages/Dashboard'
import { Expenses } from './pages/Expenses'
import { Family } from './pages/Family'
import { Accounts } from './pages/Accounts'
import { Calendar } from './pages/Calendar'
import { Budgets } from './pages/Budgets'
import { Goals } from './pages/Goals'
import { NetWorth } from './pages/NetWorth'
import { Savings } from './pages/Savings'
import { Settings } from './pages/Settings'
import { UpdateToast } from './components/UpdateToast'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/net-worth" element={<NetWorth />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/family" element={<Family />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
    <UpdateToast />
  </React.StrictMode>
)
