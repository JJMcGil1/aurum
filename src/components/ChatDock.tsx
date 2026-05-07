import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { Chat } from '@/pages/Chat'

// Memoized so ChatDock's open/width state changes don't re-render the
// entire Chat tree (messages, textarea, login state, model picker).
const MemoChat = memo(Chat)

const STORAGE_OPEN = 'aurum.chatDockOpen'
const STORAGE_WIDTH = 'aurum.chatDockWidth'
const MIN_W = 320
const MAX_W = 720
const DEFAULT_W = 400

function loadOpen(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_OPEN)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

function loadWidth(): number {
  try {
    const v = parseInt(localStorage.getItem(STORAGE_WIDTH) || '', 10)
    if (!Number.isFinite(v)) return DEFAULT_W
    return Math.min(MAX_W, Math.max(MIN_W, v))
  } catch {
    return DEFAULT_W
  }
}

export function ChatDock() {
  const [open, setOpen] = useState<boolean>(() => loadOpen())
  const [width, setWidth] = useState<number>(() => loadWidth())
  // Always-mounted: keeping <Chat /> alive across toggle preserves messages/draft.
  // Drag + animation bypass React entirely and write classes/styles via ref.
  const dockRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startW: number; rafId: number; pending: number | null } | null>(null)

  // Persist open state immediately (cheap, infrequent).
  useEffect(() => {
    try { localStorage.setItem(STORAGE_OPEN, open ? '1' : '0') } catch {}
  }, [open])

  const toggle = useCallback((next: boolean) => {
    // Add is-animating directly to the DOM so React doesn't have to render
    // twice per toggle. Class is removed on transitionend below.
    dockRef.current?.classList.add('is-animating')
    setOpen(next)
  }, [])

  const onTransitionEnd = useCallback((e: React.TransitionEvent<HTMLElement>) => {
    if (e.target !== dockRef.current) return
    if (e.propertyName !== 'width') return
    dockRef.current?.classList.remove('is-animating')
  }, [])

  const onMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current
    if (!drag) return
    drag.pending = e.clientX
    if (drag.rafId) return
    drag.rafId = requestAnimationFrame(() => {
      drag.rafId = 0
      if (drag.pending == null || !dockRef.current) return
      const dx = drag.startX - drag.pending
      const next = Math.min(MAX_W, Math.max(MIN_W, drag.startW + dx))
      // Direct DOM write — no React re-render during drag.
      dockRef.current.style.width = `${next}px`
      drag.pending = null
    })
  }, [])

  const onMouseUp = useCallback(() => {
    const drag = dragRef.current
    if (drag?.rafId) cancelAnimationFrame(drag.rafId)
    dragRef.current = null
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (dockRef.current) {
      dockRef.current.classList.remove('is-dragging')
      const finalW = dockRef.current.offsetWidth
      // Single React commit + single localStorage write per drag.
      setWidth(finalW)
      try { localStorage.setItem(STORAGE_WIDTH, String(finalW)) } catch {}
    }
  }, [onMouseMove])

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!dockRef.current) return
    dragRef.current = { startX: e.clientX, startW: dockRef.current.offsetWidth, rafId: 0, pending: null }
    dockRef.current.classList.add('is-dragging')
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Cleanup safety net.
  useEffect(() => () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [onMouseMove, onMouseUp])

  return (
    <>
      <aside
        ref={dockRef}
        className={`chat-dock${open ? '' : ' is-closed'}`}
        style={{ width: open ? width : 0 }}
        onTransitionEnd={onTransitionEnd}
        aria-label="Chat panel"
        aria-hidden={!open}
      >
        <div
          className="chat-dock-resizer"
          onMouseDown={onMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat panel"
        />
        <header className="chat-dock-header">
          <div className="chat-dock-title">
            <MessageSquare size={14} />
            <span>Chat</span>
          </div>
          <button
            type="button"
            className="chat-dock-close"
            onClick={() => toggle(false)}
            aria-label="Close chat"
            title="Close chat"
            tabIndex={open ? 0 : -1}
          >
            <X size={14} />
          </button>
        </header>
        <div className="chat-dock-body">
          <MemoChat />
        </div>
      </aside>

      <button
        type="button"
        className={`chat-fab${open ? ' is-hidden' : ''}`}
        onClick={() => toggle(true)}
        aria-label="Open chat"
        title="Open chat"
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
      >
        <MessageSquare />
      </button>
    </>
  )
}
