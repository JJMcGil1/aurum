import { fmtUsd, monthLabel } from './format'
import { MemberAvatar } from './MemberAvatar'

interface Row {
  member_id: number
  name: string
  family_role: string
  total: number
  expense_count: number
  avatar_color?: string | null
  avatar_image?: string | null
}

export function SpendingByMemberCard({
  result,
}: {
  result: { window: string; by_member: Row[] }
}) {
  const rows = result.by_member ?? []
  if (!rows.length) {
    return <div className="tool-card-empty">No spending recorded for this window.</div>
  }
  const max = Math.max(...rows.map(r => r.total), 1)
  const total = rows.reduce((s, r) => s + r.total, 0)
  const windowLabel = result.window === 'all_time' ? 'all time' : monthLabel(result.window)

  return (
    <div>
      <div className="tool-card-meta">
        Total {fmtUsd(total)} · {windowLabel}
      </div>
      <div className="tool-card-stack">
        {rows.map(r => {
          const pct = (r.total / max) * 100
          const share = total > 0 ? Math.round((r.total / total) * 100) : 0
          return (
            <div key={r.member_id} className="tool-bar-row">
              <div className="tool-bar-head">
                <MemberAvatar
                  name={r.name}
                  avatarImage={r.avatar_image}
                  avatarColor={r.avatar_color}
                  size="sm"
                />
                <div className="tool-bar-name">
                  <span>{r.name}</span>
                  <span className="tool-bar-sub">{r.expense_count} expense{r.expense_count === 1 ? '' : 's'}</span>
                </div>
                <div className="tool-bar-amount">
                  <span className="tool-bar-total">{fmtUsd(r.total)}</span>
                  <span className="tool-bar-share">{share}%</span>
                </div>
              </div>
              <div className="tool-bar-track">
                <div className="tool-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
