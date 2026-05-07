import { fmtUsd, monthLabel } from './format'

interface TrendPoint { month: string; total: number; count: number }

export function MonthlyTrendCard({ result }: { result: { trend: TrendPoint[] } }) {
  const points = result.trend ?? []
  if (!points.length) return <div className="tool-card-empty">No trend data.</div>
  const max = Math.max(...points.map(p => p.total), 1)
  const peak = points.reduce((p, c) => (c.total > p.total ? c : p), points[0])

  return (
    <div>
      <div className="tool-card-meta">
        Peak {monthLabel(peak.month)} · {fmtUsd(peak.total)}
      </div>
      <div className="tool-trend-chart">
        {points.map(p => {
          const h = (p.total / max) * 100
          return (
            <div key={p.month} className="tool-trend-col" title={`${monthLabel(p.month)}: ${fmtUsd(p.total)}`}>
              <div className="tool-trend-bar" style={{ height: `${Math.max(h, 2)}%` }} />
              <div className="tool-trend-label">{p.month.slice(5)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
