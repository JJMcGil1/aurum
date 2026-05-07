export interface ModelOption {
  id: string
  /** Full display name (e.g. "Claude Opus 4.7") */
  label: string
  /** Compact label for tight spaces (e.g. "Opus 4.7") */
  shortLabel: string
  /** Family used for the model brand line */
  family: 'auto' | 'opus' | 'sonnet' | 'haiku'
  description: string
}

export const CLAUDE_MODELS: ModelOption[] = [
  {
    id: 'default',
    label: 'Default',
    shortLabel: 'Default',
    family: 'auto',
    description: 'Let Claude Code pick based on your subscription.',
  },
  {
    id: 'opus',
    label: 'Claude Opus 4.7',
    shortLabel: 'Opus 4.7',
    family: 'opus',
    description: 'Most capable. Best for analysis, planning, complex reasoning.',
  },
  {
    id: 'sonnet',
    label: 'Claude Sonnet 4.6',
    shortLabel: 'Sonnet 4.6',
    family: 'sonnet',
    description: 'Balanced speed and capability. Great everyday default.',
  },
  {
    id: 'haiku',
    label: 'Claude Haiku 4.5',
    shortLabel: 'Haiku 4.5',
    family: 'haiku',
    description: 'Fastest and cheapest. Good for quick lookups and simple Q&A.',
  },
]

const STORAGE_KEY = 'aurum.claudeModel'

export function loadModel(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'default'
  } catch {
    return 'default'
  }
}

export function saveModel(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

export function modelArg(id: string): string | null {
  return id && id !== 'default' ? id : null
}

export function findModel(id: string): ModelOption {
  return CLAUDE_MODELS.find(m => m.id === id) ?? CLAUDE_MODELS[0]
}

export function prettyModelId(raw: string | null): string {
  if (!raw) return 'unknown'
  // strip trailing version suffixes like "[1m]"
  const stripped = raw.replace(/\[.*?\]/g, '')
  if (stripped.startsWith('claude-')) {
    // claude-opus-4-7-20251215 → "Opus 4.7"
    const rest = stripped.slice('claude-'.length).split('-')
    const family = rest[0]
    const major = rest[1]
    const minor = rest[2] && /^\d+$/.test(rest[2]) ? rest[2] : null
    const familyTitled = family.charAt(0).toUpperCase() + family.slice(1)
    return minor ? `${familyTitled} ${major}.${minor}` : `${familyTitled} ${major}`
  }
  return raw
}
