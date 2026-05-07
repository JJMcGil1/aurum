export const fmtUsd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

export const fmtUsdCompact = (n: number) => {
  if (Math.abs(n) >= 1000) return fmtUsd(n)
  return fmtUsd(n)
}

export const monthLabel = (label: string) => {
  // "2026-04" → "Apr 2026"
  const m = /^(\d{4})-(\d{2})$/.exec(label)
  if (!m) return label
  const date = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
