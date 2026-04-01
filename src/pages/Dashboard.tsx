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
          <div className="stat-value negative">{formatCurrency(data.totalExpenses)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This Month</div>
          <div className="stat-value negative">{formatCurrency(data.monthlyExpenses)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Number of Expenses</div>
          <div className="stat-value accent">{data.expenseCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average Expense</div>
          <div className="stat-value negative">{formatCurrency(data.averageExpense)}</div>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 12 }} />
                <YAxis tick={{ fill: '#666', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 13 }}
                  labelStyle={{ color: '#a0a0a0' }}
                />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
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
                      <span className="amount amount-negative">
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
