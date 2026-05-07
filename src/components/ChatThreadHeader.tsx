import { useEffect, useRef, useState } from 'react'
import { MessageSquarePlus, History, Trash2, MessageSquare } from 'lucide-react'
import type { ChatThreadSummary } from '@/types'

interface Props {
  threads: ChatThreadSummary[]
  activeThreadId: string | null
  activeTitle: string | null
  streaming: boolean
  onNewChat: () => void
  onSelectThread: (id: string) => void
  onDeleteThread: (id: string) => void
}

export function ChatThreadHeader({
  threads,
  activeThreadId,
  activeTitle,
  streaming,
  onNewChat,
  onSelectThread,
  onDeleteThread,
}: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouse = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const title = activeThreadId ? activeTitle ?? 'Untitled chat' : 'New chat'

  return (
    <div className="cth">
      <div className="cth-title-wrap">
        <span className="cth-eyebrow">Aurum</span>
        <span className="cth-title">{title}</span>
      </div>

      <div className="cth-actions">
        <button
          type="button"
          className="cth-btn cth-btn-primary"
          onClick={onNewChat}
          disabled={streaming || !activeThreadId && threads.length === 0}
          title="Start a new chat"
        >
          <MessageSquarePlus size={14} />
          <span>New chat</span>
        </button>

        <div className="cth-menu-wrap" ref={wrapRef}>
          <button
            type="button"
            className={`cth-btn${open ? ' is-open' : ''}`}
            onClick={() => setOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            title="Recent chats"
          >
            <History size={14} />
            <span>History</span>
            {threads.length > 0 && <span className="cth-count">{threads.length}</span>}
          </button>

          {open && (
            <div className="cth-menu" role="menu">
              <div className="cth-menu-head">
                <span className="cth-menu-eyebrow">Recent</span>
                <span className="cth-menu-count">{threads.length}</span>
              </div>
              {threads.length === 0 ? (
                <div className="cth-menu-empty">No saved chats yet.</div>
              ) : (
                <ul className="cth-list">
                  {threads.map(t => {
                    const active = t.id === activeThreadId
                    return (
                      <li key={t.id} className={`cth-row${active ? ' is-active' : ''}`}>
                        <button
                          type="button"
                          className="cth-row-main"
                          onClick={() => {
                            onSelectThread(t.id)
                            setOpen(false)
                          }}
                          disabled={streaming}
                        >
                          <span className="cth-row-icon">
                            <MessageSquare size={13} />
                          </span>
                          <span className="cth-row-body">
                            <span className="cth-row-title">{t.title || 'Untitled'}</span>
                            <span className="cth-row-meta">{relTime(t.updated_at)} · {t.message_count} msg</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="cth-row-del"
                          aria-label={`Delete ${t.title}`}
                          title="Delete chat"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`Delete "${t.title || 'Untitled'}"?`)) onDeleteThread(t.id)
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function relTime(iso: string): string {
  const d = new Date(iso.replace(' ', 'T') + 'Z')
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
