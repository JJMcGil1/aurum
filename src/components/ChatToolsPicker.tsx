import { useEffect, useRef, useState } from 'react'
import { Wrench, ChevronDown } from 'lucide-react'
import { presentTool } from '@/lib/aurumToolRegistry'

interface RemoteTool {
  name: string
  description: string
}

interface Props {
  disabled?: boolean
}

export function ChatToolsPicker({ disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [tools, setTools] = useState<RemoteTool[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const wrapRef = useRef<HTMLDivElement>(null)

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Fetch once on first interaction; cache for the session.
  const ensureLoaded = async () => {
    if (tools) return
    try {
      const fetched = await window.claude.listAurumTools()
      setTools(fetched)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load tools')
    }
  }

  useEffect(() => {
    if (!open) return
    ensureLoaded()
    const onMouse = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const count = tools?.length

  return (
    <div className={`tp${open ? ' is-open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="tp-trigger"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Available tools"
        title="Available tools"
      >
        <Wrench size={14} />
      </button>

      {open && (
        <div className="tp-menu" role="dialog" aria-label="Agent tools">
          <div className="tp-menu-head">
            <div className="tp-menu-title">
              <span className="tp-menu-eyebrow">Aurum</span>
              <span className="tp-menu-heading">Available tools</span>
            </div>
            {count != null && <span className="tp-menu-count">{count}</span>}
          </div>

          {!tools && !error && <ToolsSkeleton />}

          {error && (
            <div className="tp-error">
              {error}
              <button
                type="button"
                className="tp-retry"
                onClick={() => {
                  setError(null)
                  setTools(null)
                  ensureLoaded()
                }}
              >
                Retry
              </button>
            </div>
          )}

          {tools && tools.length === 0 && (
            <div className="tp-empty">No tools registered.</div>
          )}

          {tools && tools.length > 0 && (
            <ul className="tp-list">
              {tools.map(t => {
                const meta = presentTool(t.name)
                const Icon = meta.Icon
                const isOpen = expanded.has(t.name)
                return (
                  <li key={t.name} className={`tp-row${isOpen ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="tp-row-head"
                      onClick={() => toggleExpand(t.name)}
                      aria-expanded={isOpen}
                    >
                      <span className="tp-row-icon">
                        <Icon size={14} />
                      </span>
                      <span className="tp-row-name">{meta.label}</span>
                      <ChevronDown size={13} className="tp-row-chev" />
                    </button>
                    {isOpen && t.description && (
                      <div className="tp-row-desc">{t.description}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function ToolsSkeleton() {
  return (
    <ul className="tp-list">
      {[0, 1, 2, 3].map(i => (
        <li key={i} className="tp-row tp-row-skel">
          <span className="tp-row-icon tp-skel-block" />
          <div className="tp-row-body">
            <div className="tp-skel-line" style={{ width: `${50 + (i % 3) * 12}%` }} />
            <div className="tp-skel-line tp-skel-line-sub" style={{ width: `${70 + (i % 2) * 10}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
