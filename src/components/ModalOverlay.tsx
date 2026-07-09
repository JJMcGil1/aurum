import { ReactNode, MouseEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const EXIT_MS = 180

type Props = {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function ModalOverlay({ open, onClose, children }: Props) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const cached = useRef<ReactNode>(children)

  if (open) cached.current = children

  useEffect(() => {
    if (open) {
      setMounted(true)
      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        if (raf2) cancelAnimationFrame(raf2)
      }
    }
    setVisible(false)
    const t = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mounted, onClose])

  if (!mounted) return null

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return createPortal(
    <div
      className={`modal-overlay${visible ? ' is-open' : ''}`}
      onClick={handleBackdropClick}
    >
      {cached.current}
    </div>,
    document.body,
  )
}
