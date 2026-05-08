import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatDate } from '../lib/format'
import type { DashboardData } from '../types'

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    window.api.getDashboardData().then(setData)
  }, [])

  if (!data) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>

  const maxMemberSpend = Math.max(...data.spendingByMember.map(m => m.total), 1)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Your expense overview</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value">{formatCurrency(data.totalExpenses)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This Month</div>
          <div className="stat-value">{formatCurrency(data.monthlyExpenses)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Number of Expenses</div>
          <div className="stat-value accent">{data.expenseCount}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Monthly Expenses</h3>
          </div>
          {data.monthlyTrend.some(m => m.expenses > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.monthlyTrend}>
                <defs>
                  <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--inner-border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'var(--accent-subtle)' }}
                  contentStyle={{ background: 'var(--card-bg-strong)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 13, backdropFilter: 'blur(12px)' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                />
                <Bar dataKey="expenses" fill="url(#barFill)" radius={[6, 6, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>No expenses yet</p></div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Spending by Family Member</h3>
          </div>
          {data.spendingByMember.length > 0 ? (
            data.spendingByMember.map(member => (
              <div key={member.name} className="spending-bar-container">
                <div className="spending-bar-header">
                  <span className="spending-bar-name">{member.name}</span>
                  <span className="spending-bar-amount">{formatCurrency(member.total)}</span>
                </div>
                <div className="spending-bar-track">
                  <div
                    className="spending-bar-fill"
                    style={{ width: `${(member.total / maxMemberSpend) * 100}%`, background: member.avatar_color }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state"><p>No family spending data this month</p></div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Expenses</h3>
        </div>
        {data.recentExpenses.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Paid By</th>
                </tr>
              </thead>
              <tbody>
                {data.recentExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td>{exp.name}</td>
                    <td>
                      <span className="amount">
                        {formatCurrency(exp.amount)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(exp.created_at)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{exp.payers || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No expenses yet</h3>
            <p>Add your first expense to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}
