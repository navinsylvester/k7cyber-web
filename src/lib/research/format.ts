const pad = (n: number) => String(n).padStart(2, '0')

/** Tables use DD-MM-YYYY (requirements). */
export const dmy = (d?: string | Date | null): string => {
  if (!d) return ''
  const x = new Date(d)
  return `${pad(x.getUTCDate())}-${pad(x.getUTCMonth() + 1)}-${x.getUTCFullYear()}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Bylines read "25 Sep 2026". */
export const byline = (d?: string | Date | null): string => {
  if (!d) return ''
  const x = new Date(d)
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`
}

export const iso = (d?: string | Date | null): string => (d ? new Date(d).toISOString().slice(0, 10) : '')

export const daysAgo = (d?: string | Date | null): number => {
  if (!d) return Infinity
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return Math.round((today.getTime() - x.getTime()) / 864e5)
}

export const agoLabel = (days: number): string => (days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`)

export const bytes = (n?: number | null): string => {
  if (!n) return ''
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export const readingTime = (text?: string | null): string => {
  const words = (text ?? '').split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.round(words / 220))} min read`
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
