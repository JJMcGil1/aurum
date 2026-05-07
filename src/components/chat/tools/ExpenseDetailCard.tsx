import { fmtUsd } from './format'

interface Detail {
  id: number
  name: string
  amount: number
  notes: string | null
  created_at: string
  payers: { name: string; amount: number | null }[]
  beneficiaries: { name: string }[]
}

export function ExpenseDetailCard({ result }: { result: { expense?: Detail; error?: string } }) {
  if (result.error) return <div className="tool-card-empty">{result.error}</div>
  const e = result.expense
  if (!e) return <div className="tool-card-empty">Not found.</div>
  return (
    <div>
      <div className="tool-detail-head">
        <div>
          <div className="tool-detail-name">{e.name}</div>
          <div className="tool-detail-date">{e.created_at}</div>
        </div>
        <div className="tool-detail-amount">{fmtUsd(e.amount)}</div>
      </div>
      <div className="tool-detail-rows">
        <div className="tool-detail-row">
          <div className="tool-detail-label">Paid by</div>
          <div className="tool-detail-val">
            {e.payers.map(p => (
              <span key={p.name} className="tool-pill">
                {p.name}{p.amount != null ? ` · ${fmtUsd(p.amount)}` : ''}
              </span>
            ))}
          </div>
        </div>
        <div className="tool-detail-row">
          <div className="tool-detail-label">For</div>
          <div className="tool-detail-val">
            {e.beneficiaries.map(b => (
              <span key={b.name} className="tool-pill">{b.name}</span>
            ))}
          </div>
        </div>
        {e.notes && (
          <div className="tool-detail-row">
            <div className="tool-detail-label">Notes</div>
            <div className="tool-detail-val tool-detail-notes">{e.notes}</div>
          </div>
        )}
      </div>
    </div>
  )
}
