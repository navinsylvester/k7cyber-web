/* The portal's SLA engine: pure functions over timestamps and the configured targets (09-portal-guide.md §4c).
   Dataverse's own SLA columns on the case are not meaningful on this org (every row reads "In Progress"), and its KPI instances
   cover a fraction of cases, so the manager view computes compliance itself from the configured targets and business hours,
   and shows the CRM's KPI instance beside it as evidence when one exists. Everything here is unit-tested without a tenant. */

/** A shift: the hours one group of engineers works, on the weekdays it starts. An overnight shift ends after midnight
    (`end` at or before `start`) and counts into the next morning. `members` are work emails: who is "on shift" for a
    notification (notify-model.ts); empty means the shift counts for the clock but names nobody. */
export type Shift = {
  key: string
  name: string
  /** HH:MM, local to the desk's `timeZone`. */
  start: string
  end: string
  /** 0 = Sunday … 6 = Saturday: the days the shift starts on. */
  days: number[]
  members: string[]
}

/** The desk's working time: the union of its shifts (09-portal-guide.md §4c). Every SLA clock counts only these minutes. */
export type BusinessHours = {
  mode: 'business' | 'always'
  timeZone: string
  shifts: Shift[]
}

export const DEFAULT_SHIFT: Shift = { key: 'day', name: 'Day', start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5, 6], members: [] }
export const DEFAULT_HOURS: BusinessHours = { mode: 'business', timeZone: 'Asia/Kolkata', shifts: [DEFAULT_SHIFT] }

/** One working window a day (the partner portal's approval clock, and the support desk before shifts): `start`–`end` on `days`. */
export type WindowHours = { mode: 'business' | 'always'; start: string; end: string; days: number[]; timeZone: string }
export const DEFAULT_WINDOW: WindowHours = { mode: 'business', start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5, 6], timeZone: 'Asia/Kolkata' }
/** A single window as the engine's hours: one shift. */
export const windowHours = (w: WindowHours): BusinessHours => ({ mode: w.mode, timeZone: w.timeZone, shifts: [{ key: 'day', name: 'Day', start: w.start, end: w.end, days: w.days, members: [] }] })

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

/** The local midnight after the one at `dayStart` (exact across DST changes). */
const nextDayStart = (dayStart: number, tz: string): number => localDay(dayStart + DAY + 60 * MIN, tz).dayStart

/** The local calendar date of an instant, YYYY-MM-DD: the key a once-a-day notification is filed under. */
export const localDate = (t: Date | number, tz: string): string => {
  const { dayStart, offset } = localDay(new Date(t).getTime(), tz)
  return new Date(dayStart + offset * MIN).toISOString().slice(0, 10)
}

export type ShiftWindow = { shift: Shift; open: number; close: number }

/** The windows of the shifts that start on the local day beginning at `dayStart` (an overnight one closes the next day). */
const windowsStarting = (dayStart: number, bh: BusinessHours): ShiftWindow[] => {
  const { weekday } = localDay(dayStart + 12 * 60 * MIN, bh.timeZone)
  const out: ShiftWindow[] = []
  for (const shift of bh.shifts) {
    if (!shift.days.includes(weekday)) continue
    const a = hm(shift.start)
    const b = hm(shift.end)
    const open = dayStart + a * MIN
    const close = b > a ? dayStart + b * MIN : nextDayStart(dayStart, bh.timeZone) + b * MIN
    if (close > open) out.push({ shift, open, close })
  }
  return out.sort((x, y) => x.open - y.open)
}

/** Every shift window that is open at some point at or after `from`, in order of opening, starting with the day before
    (an overnight shift from yesterday may still be open). Bounded by MAX_DAYS. */
function* shiftWindows(from: number, bh: BusinessHours): Generator<ShiftWindow> {
  if (!bh.shifts.some((s) => s.days.length)) return
  let day = localDay(localDay(from, bh.timeZone).dayStart - 12 * 60 * MIN, bh.timeZone).dayStart
  for (let i = 0; i < MAX_DAYS; i++) {
    for (const w of windowsStarting(day, bh)) if (w.close > from) yield w
    day = nextDayStart(day, bh.timeZone)
  }
}

/** The working time from `from` on as merged intervals: overlapping shifts count once. */
function* workingIntervals(from: number, bh: BusinessHours): Generator<[number, number]> {
  let cur: [number, number] | null = null
  for (const w of shiftWindows(from, bh)) {
    if (cur && w.open <= cur[1]) cur[1] = Math.max(cur[1], w.close)
    else {
      if (cur) yield cur
      cur = [w.open, w.close]
    }
  }
  if (cur) yield cur
}

/** Working minutes between two instants under the desk's shifts (never negative). */
export const workingMinutesBetween = (from: Date | string | number, to: Date | string | number, bh: BusinessHours): number => {
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0
  if (bh.mode === 'always') return (b - a) / MIN
  let total = 0
  for (const [open, close] of workingIntervals(a, bh)) {
    if (open >= b) break
    const lo = Math.max(a, open)
    const hi = Math.min(b, close)
    if (hi > lo) total += (hi - lo) / MIN
  }
  return total
}

/** The instant `minutes` working minutes after `from`. */
export const addWorkingMinutes = (from: Date | string | number, minutes: number, bh: BusinessHours): Date => {
  const a = new Date(from).getTime()
  if (bh.mode === 'always' || minutes <= 0) return new Date(a + Math.max(0, minutes) * MIN)
  let left = minutes
  let last = a
  for (const [open, close] of workingIntervals(a, bh)) {
    const start = Math.max(a, open)
    const capacity = (close - start) / MIN
    if (left <= capacity) return new Date(start + left * MIN)
    left -= capacity
    last = close
  }
  return new Date(last)
}

/** The shifts working at `t` (a shift that has just closed is not on). Around the clock, every shift is on. */
export const shiftsOn = (t: Date | number, bh: BusinessHours): Shift[] => {
  const x = new Date(t).getTime()
  if (bh.mode === 'always') return bh.shifts
  const on: Shift[] = []
  for (const w of shiftWindows(x, bh)) {
    if (w.open > x) break
    if (w.open <= x && x < w.close && !on.includes(w.shift)) on.push(w.shift)
  }
  return on
}

/** The shifts working at `t`; when none is (a night, a holiday), the shifts that open next: who "on shift" means for a
    notification that cannot wait for a person. */
export const shiftsOnOrNext = (t: Date | number, bh: BusinessHours): Shift[] => {
  const on = shiftsOn(t, bh)
  if (on.length || bh.mode === 'always') return on
  const x = new Date(t).getTime()
  let first: number | null = null
  const next: Shift[] = []
  for (const w of shiftWindows(x, bh)) {
    if (w.open <= x) continue
    if (first === null) first = w.open
    if (w.open !== first) break
    if (!next.includes(w.shift)) next.push(w.shift)
  }
  return next
}

/** The shifts that closed in (from, to], with the instant each closed, the local date it opened and whether it was the last
    shift of that date to close: what the shift-end pass (KPI reports, digests) works through. */
export const shiftEndsBetween = (from: Date | number, to: Date | number, bh: BusinessHours): { shift: Shift; close: Date; date: string; lastOfDay: boolean }[] => {
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  const out: { shift: Shift; close: Date; date: string; lastOfDay: boolean }[] = []
  if (!(b > a) || bh.mode === 'always') return out
  for (const w of shiftWindows(a, bh)) {
    if (w.open > b) break
    if (w.close > a && w.close <= b) {
      const day = localDay(w.open, bh.timeZone).dayStart
      const lastOfDay = Math.max(...windowsStarting(day, bh).map((x) => x.close)) === w.close
      out.push({ shift: w.shift, close: new Date(w.close), date: localDate(w.open, bh.timeZone), lastOfDay })
    }
  }
  return out.sort((x, y) => x.close.getTime() - y.close.getTime())
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
  if (r.left < 0) return Math.round(-r.left) < 1 ? 'just overdue' : `overdue ${fmtMinutes(-r.left)}`
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

/** The working minutes of an average working day under the shifts: what "every N working days" means in minutes. */
export const minutesPerWorkingDay = (bh: BusinessHours): number => {
  if (bh.mode === 'always') return 24 * 60
  const days = new Set(bh.shifts.flatMap((x) => x.days)).size
  if (!days) return 540
  const from = Date.UTC(2026, 0, 4, 12) // a reference week, Sunday noon UTC to the next
  return Math.max(60, Math.round(workingMinutesBetween(from, from + 7 * DAY, bh) / days))
}

/** Working days in a period (days on which a shift starts), for throughput per working day. */
export const workingDaysBetween = (from: Date, to: Date, bh: BusinessHours): number => {
  if (bh.mode === 'always') return Math.max(1, (to.getTime() - from.getTime()) / DAY)
  const days = new Set(bh.shifts.flatMap((s) => s.days))
  let n = 0
  let cursor = localDay(from.getTime(), bh.timeZone).dayStart
  const end = to.getTime()
  for (let i = 0; i < MAX_DAYS && cursor < end; i++) {
    if (days.has(localDay(cursor + 12 * 60 * MIN, bh.timeZone).weekday)) n++
    cursor = nextDayStart(cursor, bh.timeZone)
  }
  return Math.max(1, n)
}
