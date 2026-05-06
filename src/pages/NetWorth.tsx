import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { Camera } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import type { NetWorthData } from '../types'

const TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  investment: 'Investments',
  cash: 'Cash',
  credit_card: 'Credit Cards',
  loan: 'Loans',
}

const ASSET_TYPES = ['checking', 'savings', 'investment', 'cash']

export function NetWorth() {
  const [data, setData] = useState<NetWorthData | null>(null)

  const load = () => { window.api.getNetWorth().then(setData) }
  useEffect(load, [])

  const snapshot = async () => {
    await window.api.takeNetWorthSnapshot()
    load()
  }

  if (!data) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>

  const assetBreakdown = data.breakdown.filter(b => ASSET_TYPES.includes(b.type))
  const liabilityBreakdown = data.breakdown.filter(b => !ASSET_TYPES.includes(b.type))

  const chartData = data.history.map(h => ({
    date: new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    netWorth: h.net_worth,
    assets: h.assets,
    liabilities: h.liabilities,
  }))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Net Worth</h1>
          <p className="page-subtitle">Assets minus liabilities</p>
        </div>
        <button className="btn btn-primary" onClick={snapshot}><Camera size={16} /> Take Snapshot</button>
      </div>

      <div className="networth-hero card">
        <div className="networth-hero-label">Current Net Worth</div>
        <div className={`networth-hero-value ${data.netWorth >= 0 ? 'positive' : 'negative'}`}>
          {formatCurrency(data.netWorth)}
        </div>
        <div className="networth-hero-split">
          <div>
            <div className="stat-label">Assets</div>
            <div className="amount amount-positive">{formatCurrency(data.assets)}</div>
          </div>
          <div className="networth-hero-divider" />
          <div>
            <div className="stat-label">Liabilities</div>
            <div className="amount amount-negative">{formatCurrency(data.liabilities)}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Trend</h3>
        </div>
        {chartData.length === 0 ? (
          <div className="empty-state">
            <p>No history yet — take a snapshot to start tracking</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={v => formatCurrency(v).replace('.00', '')} width={80} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Area type="monotone" dataKey="netWorth" stroke="var(--accent)" strokeWidth={2} fill="url(#nwGrad)" name="Net Worth" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Assets</h3></div>
          {assetBreakdown.length > 0 ? (
            assetBreakdown.map(b => (
              <div key={b.type} className="networth-row">
                <div>
                  <div className="networth-row-name">{TYPE_LABELS[b.type] || b.type}</div>
                  <div className="networth-row-meta">{b.count} account{b.count !== 1 ? 's' : ''}</div>
                </div>
                <div className="amount amount-positive">{formatCurrency(b.total)}</div>
              </div>
            ))
          ) : <div className="empty-state"><p>No asset accounts</p></div>}
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Liabilities</h3></div>
          {liabilityBreakdown.length > 0 ? (
            liabilityBreakdown.map(b => (
              <div key={b.type} className="networth-row">
                <div>
                  <div className="networth-row-name">{TYPE_LABELS[b.type] || b.type}</div>
                  <div className="networth-row-meta">{b.count} account{b.count !== 1 ? 's' : ''}</div>
                </div>
                <div className="amount amount-negative">{formatCurrency(Math.abs(b.total))}</div>
              </div>
            ))
          ) : <div className="empty-state"><p>No liability accounts</p></div>}
        </div>
      </div>
    </div>
  )
}
