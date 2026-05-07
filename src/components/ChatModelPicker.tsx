import { useEffect, useRef, useState } from 'react'
import { CLAUDE_MODELS, findModel, type ModelOption } from '@/lib/claudeModels'

interface Props {
  model: string
  onChange: (id: string) => void
  cliVersion?: string | null
  connected: boolean
  disabled?: boolean
}

const TIER: Record<ModelOption['family'], number> = {
  auto: 0,
  haiku: 1,
  sonnet: 2,
  opus: 3,
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
    <div className={`mp${open ? ' is-open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="mp-trigger"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`mp-dot ${connected ? 'is-on' : 'is-off'}`} aria-hidden />
        <span className="mp-trigger-name">{active.shortLabel}</span>
      </button>

      {open && (
        <div className="mp-menu" role="listbox">
          <div className="mp-menu-head">
            <span className="mp-menu-eyebrow">Model</span>
            <span className="mp-menu-status">
              <span className={`mp-dot ${connected ? 'is-on' : 'is-off'}`} aria-hidden />
              <span className="mp-menu-version">{cliVersion ?? 'offline'}</span>
            </span>
          </div>
          <ul className="mp-list">
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
          </ul>
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
  const tier = TIER[option.family]
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={active}
        className={`mp-row${active ? ' is-active' : ''}`}
        onClick={onSelect}
      >
        <span className="mp-row-bar" aria-hidden />
        <span className="mp-row-main">
          <span className="mp-row-name">{option.label}</span>
          <span className="mp-row-tag">
            {option.family === 'auto' ? 'AUTO' : option.family.toUpperCase()}
          </span>
        </span>
        <TierGauge tier={tier} family={option.family} />
      </button>
    </li>
  )
}

function TierGauge({ tier, family }: { tier: number; family: ModelOption['family'] }) {
  if (family === 'auto') {
    return <span className="mp-tier mp-tier-auto" aria-label="Auto">AUTO</span>
  }
  return (
    <span className="mp-tier" aria-label={`Tier ${tier}`}>
      {[1, 2, 3].map(i => (
        <span key={i} className={`mp-tier-tick${i <= tier ? ' is-on' : ''}`} />
      ))}
    </span>
  )
}
