import { fmtUsd } from './format'

interface Payer { member_id: number; name: string; amount: number | null }
interface Beneficiary { member_id: number; name: string }
interface ExpenseRow {
  id: number
  name: string
  amount: number
  notes: string | null
  created_at: string
  payers: Payer[]
  beneficiaries: Beneficiary[]
}

export function ExpensesListCard({
  result,
}: {
  result: { expenses?: ExpenseRow[]; count?: number; limit?: number }
}) {
  const expenses = result.expenses ?? []
  if (!expenses.length) return <div className="tool-card-empty">No expenses match.</div>

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0)

  return (
    <div>
      <div className="tool-card-stack">
        {expenses.map(e => {
          const payerLabel = e.payers
            .map(p => (p.amount != null ? `${p.name} ${fmtUsd(p.amount)}` : p.name))
            .join(' · ')
          return (
            <div key={e.id} className="tool-expense-row">
              <div className="tool-expense-main">
                <div className="tool-expense-name">{e.name}</div>
                <div className="tool-expense-sub">
                  {payerLabel || '—'}
                  {e.beneficiaries.length > 0 && (
                    <>
                      <span className="tool-dot">•</span>
                      <span className="tool-expense-bens">
                        for {e.beneficiaries.map(b => b.name.split(' ')[0]).join(', ')}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="tool-expense-amount">{fmtUsd(e.amount)}</div>
            </div>
          )
        })}
      </div>
      <div className="tool-card-footer">
        <span className="tool-card-foot-label">{expenses.length} expense{expenses.length === 1 ? '' : 's'}</span>
        <span className="tool-card-foot-total">{fmtUsd(total)}</span>
      </div>
    </div>
  )
}
