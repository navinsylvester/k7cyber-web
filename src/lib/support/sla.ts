/* The portal's SLA engine: pure functions over timestamps and the configured targets (09-portal-guide.md §4c).
   Dataverse's own SLA columns on the case are not meaningful on this org (every row reads "In Progress"), and its KPI instances
   cover a fraction of cases, so the manager view computes compliance itself from the configured targets and business hours,
   and shows the CRM's KPI instance beside it as evidence when one exists. Everything here is unit-tested without a tenant. */

export type BusinessHours = {
  mode: 'business' | 'always'
  /** HH:MM, local to `timeZone`. */
  start: string
  end: string
  /** 0 = Sunday … 6 = Saturday. */
  days: number[]
  timeZone: string
}

export const DEFAULT_HOURS: BusinessHours = { mode: 'business', start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5, 6], timeZone: 'Asia/Kolkata' }

const MIN = 60_000
const DAY = 24 * 60 * MIN
const MAX_DAYS = 800

const hm = (s: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return 0
  return Math.min(24 * 60, Number(m[1]) * 60 + Number(m[2]))
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()
const formatter = (tz: string): Intl.DateTimeFormat => {
  let f = fmtCache.get(tz)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      f = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
    fmtCache.set(tz, f)
  }
  return f
}

/** The zone's offset from UTC in minutes at a given instant (handles zones with DST by asking per instant). */
export const zoneOffsetMinutes = (t: number, tz: string): number => {
  const parts = formatter(tz).formatToParts(new Date(t))
  const g = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'))
  return Math.round((asUtc - Math.floor(t / 1000) * 1000) / MIN)
}

/** Midnight (local) of the day containing `t`, as an instant, plus the local weekday. */
const localDay = (t: number, tz: string): { dayStart: number; weekday: number; offset: number } => {
  const offset = zoneOffsetMinutes(t, tz)
  const shifted = new Date(t + offset * MIN)
  const dayStartShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
  return { dayStart: dayStartShifted - offset * MIN, weekday: shifted.getUTCDay(), offset }
}

/** The working window of the local day that contains `t`: [open, close] instants, or null on a non-working day. */
const windowOf = (t: number, bh: BusinessHours): { open: number; close: number; next: number } => {
  const { dayStart, weekday } = localDay(t, bh.timeZone)
  const next = dayStart + DAY + 60 * MIN // land safely inside the next local day; realigned on the next call
  const open = dayStart + hm(bh.start) * MIN
  const close = dayStart + Math.max(hm(bh.start), hm(bh.end)) * MIN
  if (!bh.days.includes(weekday) || close <= open) return { open: 0, close: 0, next }
  return { open, close, next }
}

/** Working minutes between two instants under the business hours (never negative). */
export const workingMinutesBetween = (from: Date | string | number, to: Date | string | number, bh: BusinessHours): number => {
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0
  if (bh.mode === 'always') return (b - a) / MIN
  let total = 0
  let cursor = a
  for (let i = 0; i < MAX_DAYS && cursor < b; i++) {
    const w = windowOf(cursor, bh)
    if (w.close > 0) {
      const lo = Math.max(a, w.open, cursor)
      const hi = Math.min(b, w.close)
      if (hi > lo) total += (hi - lo) / MIN
    }
    const { dayStart } = localDay(cursor, bh.timeZone)
    cursor = Math.max(w.next, dayStart + DAY)
    // Realign to the exact next local midnight so DST shifts do not skip or double a day.
    cursor = localDay(cursor, bh.timeZone).dayStart
    if (cursor <= a && i > 0) break
  }
  return total
}

/** The instant `minutes` working minutes after `from`. */
export const addWorkingMinutes = (from: Date | string | number, minutes: number, bh: BusinessHours): Date => {
  const a = new Date(from).getTime()
  if (bh.mode === 'always' || minutes <= 0) return new Date(a + Math.max(0, minutes) * MIN)
  let left = minutes
  let cursor = a
  for (let i = 0; i < MAX_DAYS; i++) {
    const w = windowOf(cursor, bh)
    if (w.close > 0 && cursor < w.close) {
      const start = Math.max(cursor, w.open)
      const capacity = (w.close - start) / MIN
      if (left <= capacity) return new Date(start + left * MIN)
      left -= capacity
    }
    const { dayStart } = localDay(cursor, bh.timeZone)
    cursor = localDay(dayStart + DAY + 60 * MIN, bh.timeZone).dayStart
  }
  return new Date(cursor)
}

export type SlaState = 'ok' | 'at-risk' | 'breached' | 'met' | 'paused' | 'none'

export type SlaReading = {
  state: SlaState
  /** Working minutes used so far (or until it was met). */
  elapsed: number
  /** The target in working minutes. */
  target: number
  /** Working minutes left (negative when breached). */
  left: number
  /** 0..∞ share of the target used. */
  ratio: number
  /** Wall-clock deadline for display. */
  deadline: Date | null
}

export type ReadingInput = {
  start: Date | string
  /** When the clock stopped (resolved / responded); null while still running. */
  end?: Date | string | null
  now: Date
  targetMinutes: number
  warnAtPercent: number
  hours: BusinessHours
  /** Minutes to subtract from the elapsed time (Dataverse on-hold). */
  holdMinutes?: number
  paused?: boolean
}

/** One SLA clock: how far along a case is against its target. */
export const readSla = (i: ReadingInput): SlaReading => {
  const target = Math.max(1, i.targetMinutes)
  const end = i.end ? new Date(i.end) : null
  const until = end ?? i.now
  const elapsed = Math.max(0, workingMinutesBetween(i.start, until, i.hours) - Math.max(0, i.holdMinutes ?? 0))
  const ratio = elapsed / target
  const deadline = addWorkingMinutes(i.start, target + Math.max(0, i.holdMinutes ?? 0), i.hours)
  const left = target - elapsed
  if (end) return { state: elapsed <= target ? 'met' : 'breached', elapsed, target, left, ratio, deadline }
  if (i.paused) return { state: 'paused', elapsed, target, left, ratio, deadline }
  const state: SlaState = ratio >= 1 ? 'breached' : ratio >= i.warnAtPercent / 100 ? 'at-risk' : 'ok'
  return { state, elapsed, target, left, ratio, deadline }
}

export const NO_READING: SlaReading = { state: 'none', elapsed: 0, target: 0, left: 0, ratio: 0, deadline: null }

/** Working minutes as a short mono string: "45 min", "3 h 20 m", "52 h". */
export const fmtMinutes = (m: number): string => {
  const n = Math.round(Math.abs(m))
  if (n < 60) return `${n} min`
  const h = Math.floor(n / 60)
  const r = n % 60
  if (h >= 48) return `${h} h`
  return r ? `${h} h ${String(r).padStart(2, '0')} m` : `${h} h`
}

/** "1 h 20 m left" / "overdue 3 h" / "met in 25 min". */
export const fmtLeft = (r: SlaReading): string => {
  if (r.state === 'none') return ''
  if (r.state === 'met') return `met in ${fmtMinutes(r.elapsed)}`
  if (r.state === 'paused') return `paused · ${fmtMinutes(r.left)} left`
  if (r.left < 0) return `overdue ${fmtMinutes(-r.left)}`
  return `${fmtMinutes(r.left)} left`
}

/** Dataverse slakpiinstance.status → the portal's words. 0 In progress, 1 Noncompliant, 2 Nearing noncompliance, 3 Paused, 4 Succeeded. */
export const crmKpiState = (status: number | null | undefined): SlaState => {
  switch (status) {
    case 0:
      return 'ok'
    case 1:
      return 'breached'
    case 2:
      return 'at-risk'
    case 3:
      return 'paused'
    case 4:
      return 'met'
  }
  return 'none'
}

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

export const percentile = (xs: number[], p: number): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))
  return s[idx]!
}

export const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)

/** Working days in a period, for throughput per working day. */
export const workingDaysBetween = (from: Date, to: Date, bh: BusinessHours): number => {
  if (bh.mode === 'always') return Math.max(1, (to.getTime() - from.getTime()) / DAY)
  let n = 0
  let cursor = localDay(from.getTime(), bh.timeZone).dayStart
  const end = to.getTime()
  for (let i = 0; i < MAX_DAYS && cursor < end; i++) {
    if (bh.days.includes(localDay(cursor + 12 * 60 * MIN, bh.timeZone).weekday)) n++
    cursor = localDay(cursor + DAY + 60 * MIN, bh.timeZone).dayStart
  }
  return Math.max(1, n)
}
