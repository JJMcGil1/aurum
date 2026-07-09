import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

export type CardMenuItem = {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

type Props = {
  items: CardMenuItem[]
  label?: string
  align?: 'left' | 'right'
}

const MENU_WIDTH = 168
const VIEWPORT_GAP = 8

export function CardMenu({ items, label = 'More actions', align = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const top = rect.bottom + 6
    let left = align === 'right' ? rect.right - MENU_WIDTH : rect.left
    const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_GAP
    if (left > maxLeft) left = maxLeft
    if (left < VIEWPORT_GAP) left = VIEWPORT_GAP
    setPos({ top, left })
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onScroll = () => setOpen(false)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const handleItem = (item: CardMenuItem) => {
    if (item.disabled) return
    setOpen(false)
    item.onClick()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`card-menu-trigger${open ? ' is-open' : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={e => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
      >
        <MoreVertical size={16} />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="card-menu-dropdown"
          role="menu"
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          onClick={e => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`card-menu-item${item.danger ? ' is-danger' : ''}`}
              disabled={item.disabled}
              onClick={() => handleItem(item)}
            >
              {item.icon && <span className="card-menu-item-icon">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
