import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Plus, PiggyBank, TrendingUp, Wallet } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import type { SavingsData } from '../types'
import { ModalOverlay } from '../components/ModalOverlay'

export function Savings() {
  const [data, setData] = useState<SavingsData | null>(null)
  const [contributing, setContributing] = useState<number | null>(null)
  const [form, setForm] = useState({ amount: '', description: '', date: new Date().toISOString().slice(0, 10) })

  const load = () => { window.api.getSavingsData().then(setData) }
  useEffect(load, [])

  const submit = async () => {
    if (!contributing) return
    const amt = parseFloat(form.amount) || 0
    if (amt <= 0) return
    await window.api.addSavingsContribution({
      account_id: contributing,
      amount: amt,
      date: form.date,
      description: form.description || 'Savings contribution',
    })
    setContributing(null)
    setForm({ amount: '', description: '', date: new Date().toISOString().slice(0, 10) })
    load()
  }

  if (!data) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>

  const trendMax = Math.max(1, ...data.trend.map(t => Math.abs(t.saved)))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Savings</h1>
          <p className="page-subtitle">Track money set aside</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label"><PiggyBank size={14} /> Total Saved</div>
          <div className="stat-value accent">{formatCurrency(data.totalSavings)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><TrendingUp size={14} /> Savings Rate (MTD)</div>
          <div className={`stat-value ${data.savingsRate > 0 ? 'positive' : ''}`}>{data.savingsRate.toFixed(1)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Wallet size={14} /> Saved This Month</div>
          <div className={`stat-value ${data.monthSaved >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(data.monthSaved)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Monthly Net Savings</h3>
          <span className="card-meta">Last 6 months · into savings accounts</span>
        </div>
        {data.accounts.length === 0 ? (
          <div className="empty-state">
            <p>Add a savings-type account on the Accounts page to start tracking</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={v => formatCurrency(v).replace('.00', '')} width={80} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="saved" radius={[6, 6, 0, 0]}>
                {data.trend.map((t, i) => (
                  <Cell key={i} fill={t.saved >= 0 ? 'var(--accent)' : 'var(--red)'} fillOpacity={0.3 + 0.7 * (Math.abs(t.saved) / trendMax)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Savings Accounts</h3>
            <span className="card-meta">{data.accounts.length} account{data.accounts.length !== 1 ? 's' : ''}</span>
          </div>
          {data.accounts.length > 0 ? (
            data.accounts.map(a => (
              <div key={a.id} className="networth-row">
                <div>
                  <div className="networth-row-name">{a.name}</div>
                  <div className="networth-row-meta">
                    {a.institution || 'Manual'}{a.owner_name ? ` · ${a.owner_name}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="amount amount-positive">{formatCurrency(a.balance)}</div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setContributing(a.id)}><Plus size={14} /> Add</button>
                </div>
              </div>
            ))
          ) : <div className="empty-state"><p>No savings accounts yet</p></div>}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Activity</h3>
          </div>
          {data.recent.length > 0 ? (
            data.recent.map(t => (
              <div key={t.id} className="networth-row">
                <div>
                  <div className="networth-row-name">{t.description}</div>
                  <div className="networth-row-meta">
                    {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {t.account_name}
                  </div>
                </div>
                <div className={`amount ${t.type === 'income' ? 'amount-positive' : 'amount-negative'}`}>
                  {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                </div>
              </div>
            ))
          ) : <div className="empty-state"><p>No transactions on savings accounts yet</p></div>}
        </div>
      </div>

      <ModalOverlay open={contributing !== null} onClose={() => setContributing(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h2 className="modal-title">Add to Savings</h2>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" step="0.01" placeholder="0.00" autoFocus
                  value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date"
                  value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input className="form-input" placeholder="e.g. Paycheck transfer"
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setContributing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={!form.amount}>Add</button>
            </div>
        </div>
      </ModalOverlay>
    </div>
  )
}
