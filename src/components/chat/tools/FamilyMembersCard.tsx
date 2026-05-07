import { MemberAvatar } from './MemberAvatar'

interface Member {
  id: number
  name: string
  role: string
  email: string | null
  avatar_color?: string | null
  avatar_image?: string | null
}

export function FamilyMembersCard({ result }: { result: { members?: Member[]; count?: number } }) {
  const members = result.members ?? []
  if (!members.length) return <div className="tool-card-empty">No family members yet.</div>
  return (
    <div className="tool-card-stack">
      {members.map(m => (
        <div key={m.id} className="tool-member-row">
          <MemberAvatar name={m.name} avatarImage={m.avatar_image} avatarColor={m.avatar_color} />
          <div className="tool-member-meta">
            <div className="tool-member-name">{m.name}</div>
            <div className="tool-member-sub">
              <span className="tool-pill">{m.role}</span>
              {m.email && <span className="tool-member-email">{m.email}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
