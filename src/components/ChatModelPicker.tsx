import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { CLAUDE_MODELS, findModel, type ModelOption } from '@/lib/claudeModels'

interface Props {
  model: string
  onChange: (id: string) => void
  cliVersion?: string | null
  connected: boolean
  disabled?: boolean
}

export function ChatModelPicker({ model, onChange, cliVersion, connected, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
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
  }, [open])

  const active = findModel(model)

  return (
    <div className="model-picker" ref={wrapRef}>
      <button
        type="button"
        className="model-picker-trigger"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ClaudeMark size={14} />
        <span className="model-picker-trigger-label">{active.shortLabel}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="model-picker-menu" role="listbox">
          <div className="model-picker-header">
            <ClaudeMark size={16} />
            <span className="model-picker-header-name">Claude Code</span>
            {cliVersion && <span className="model-picker-header-version">{cliVersion}</span>}
            <span
              className={`model-picker-status-dot${connected ? ' is-connected' : ''}`}
              title={connected ? 'Connected' : 'Not connected'}
            />
          </div>
          <div className="model-picker-divider" />
          {CLAUDE_MODELS.map(opt => (
            <ModelRow
              key={opt.id}
              option={opt}
              active={opt.id === model}
              onSelect={() => {
                onChange(opt.id)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ModelRow({
  option,
  active,
  onSelect,
}: {
  option: ModelOption
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      className={`model-picker-row${active ? ' is-active' : ''}`}
      onClick={onSelect}
    >
      <ClaudeMark size={14} className="model-picker-row-icon" />
      <div className="model-picker-row-body">
        <div className="model-picker-row-label">{option.label}</div>
        <div className="model-picker-row-desc">{option.description}</div>
      </div>
      {active && <Check size={14} className="model-picker-row-check" />}
    </button>
  )
}

/**
 * Claude brand sparkle mark. Stylized 4-point star matching the Anthropic
 * Claude visual identity.
 */
export function ClaudeMark({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`claude-mark${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <path
        d="M12 2.5 C 12.4 8.4 14.6 11.6 21.5 12 C 14.6 12.4 12.4 15.6 12 21.5 C 11.6 15.6 9.4 12.4 2.5 12 C 9.4 11.6 11.6 8.4 12 2.5 Z"
        fill="currentColor"
      />
    </svg>
  )
}
