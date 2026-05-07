import { fmtUsd, monthLabel } from './format'

interface Summary {
  lifetime_total: number
  expense_count: number
  average_expense: number
  current_month: { label: string; total: number }
  previous_month: { label: string; total: number }
}

export function ExpenseSummaryCard({ result }: { result: Summary }) {
  const delta = result.current_month.total - result.previous_month.total
  const deltaPct =
    result.previous_month.total > 0
      ? Math.round((delta / result.previous_month.total) * 100)
      : null

  return (
    <div className="tool-stat-grid">
      <div className="tool-stat">
        <div className="tool-stat-label">Lifetime</div>
        <div className="tool-stat-value">{fmtUsd(result.lifetime_total)}</div>
        <div className="tool-stat-sub">
          {result.expense_count} expense{result.expense_count === 1 ? '' : 's'} · avg {fmtUsd(result.average_expense)}
        </div>
      </div>
      <div className="tool-stat">
        <div className="tool-stat-label">{monthLabel(result.current_month.label)}</div>
        <div className="tool-stat-value">{fmtUsd(result.current_month.total)}</div>
        <div className={`tool-stat-sub ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`}>
          {deltaPct == null
            ? 'no prior data'
            : `${delta >= 0 ? '+' : ''}${fmtUsd(delta)} (${deltaPct >= 0 ? '+' : ''}${deltaPct}%) vs ${monthLabel(result.previous_month.label)}`}
        </div>
      </div>
      <div className="tool-stat">
        <div className="tool-stat-label">{monthLabel(result.previous_month.label)}</div>
        <div className="tool-stat-value">{fmtUsd(result.previous_month.total)}</div>
      </div>
    </div>
  )
}
