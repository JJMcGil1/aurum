import { ExpensesListCard } from './ExpensesListCard'
import { fmtUsd, monthLabel } from './format'

interface Result {
  window: string
  member_query: string
  total: number
  expense_count: number
  expenses: any[]
}

export function SpendingForMemberCard({ result }: { result: Result }) {
  const windowLabel = result.window === 'all_time' ? 'all time' : monthLabel(result.window)
  return (
    <div>
      <div className="tool-stat-grid">
        <div className="tool-stat">
          <div className="tool-stat-label">Spent on {result.member_query}</div>
          <div className="tool-stat-value">{fmtUsd(result.total)}</div>
          <div className="tool-stat-sub">
            {result.expense_count} expense{result.expense_count === 1 ? '' : 's'} · {windowLabel}
          </div>
        </div>
      </div>
      {result.expenses?.length > 0 && (
        <div className="tool-card-section">
          <ExpensesListCard result={{ expenses: result.expenses, count: result.expenses.length }} />
        </div>
      )}
    </div>
  )
}
