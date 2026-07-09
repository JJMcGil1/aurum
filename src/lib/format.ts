export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const RECURRENCE_LABELS: Record<string, string> = {
  once: 'One-time',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

export function recurrenceLabel(recurrence: string | null | undefined): string {
  if (!recurrence) return 'One-time'
  return RECURRENCE_LABELS[recurrence] || recurrence
}

/**
 * Compute the next occurrence on or after `from` for a recurring schedule
 * anchored at `anchorISO` with the given recurrence. Returns null if the
 * schedule has ended (past `endISO`) or is one-time and already in the past.
 */
export function nextOccurrence(
  anchorISO: string | null,
  recurrence: string | null | undefined,
  endISO: string | null | undefined,
  fromISO: string = todayISO(),
): string | null {
  if (!anchorISO) return null
  const anchor = new Date(anchorISO + 'T00:00:00')
  const from = new Date(fromISO + 'T00:00:00')
  const end = endISO ? new Date(endISO + 'T00:00:00') : null

  if (!recurrence || recurrence === 'once') {
    return anchor >= from ? toISO(anchor) : null
  }

  // Walk forward from anchor until we land on/after `from`
  const next = new Date(anchor)
  const step = () => {
    switch (recurrence) {
      case 'weekly':    next.setDate(next.getDate() + 7); break
      case 'biweekly':  next.setDate(next.getDate() + 14); break
      case 'monthly':   next.setMonth(next.getMonth() + 1); break
      case 'quarterly': next.setMonth(next.getMonth() + 3); break
      case 'yearly':    next.setFullYear(next.getFullYear() + 1); break
      default:          next.setMonth(next.getMonth() + 1)
    }
  }
  // Cap iterations to prevent runaway loops on bad data
  let guard = 0
  while (next < from && guard++ < 5000) step()
  if (end && next > end) return null
  return toISO(next)
}

/**
 * Expand a recurring schedule into all occurrence dates within [fromISO, toISO].
 * For one-time / null recurrence, returns [anchorISO] if it falls in range, else [].
 * Returns dates in ascending order.
 */
export function expandOccurrences(
  anchorISO: string | null,
  recurrence: string | null | undefined,
  endISO: string | null | undefined,
  fromISO: string,
  toISODate: string,
): string[] {
  if (!anchorISO) return []
  const anchor = new Date(anchorISO + 'T00:00:00')
  const from = new Date(fromISO + 'T00:00:00')
  const to = new Date(toISODate + 'T00:00:00')
  const end = endISO ? new Date(endISO + 'T00:00:00') : null
  const hardStop = end && end < to ? end : to

  if (!recurrence || recurrence === 'once') {
    if (anchor >= from && anchor <= hardStop) return [toISO(anchor)]
    return []
  }

  const step = (d: Date) => {
    switch (recurrence) {
      case 'weekly':    d.setDate(d.getDate() + 7); break
      case 'biweekly':  d.setDate(d.getDate() + 14); break
      case 'monthly':   d.setMonth(d.getMonth() + 1); break
      case 'quarterly': d.setMonth(d.getMonth() + 3); break
      case 'yearly':    d.setFullYear(d.getFullYear() + 1); break
      default:          d.setMonth(d.getMonth() + 1)
    }
  }

  const cursor = new Date(anchor)
  let guard = 0
  while (cursor < from && guard++ < 20000) step(cursor)

  const out: string[] = []
  while (cursor <= hardStop && guard++ < 20000) {
    out.push(toISO(cursor))
    step(cursor)
  }
  return out
}
