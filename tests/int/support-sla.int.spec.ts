import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS, DEFAULT_TARGETS, normaliseSettings, normaliseShifts, periodBounds, resolveTarget } from '@/lib/support/kpi-model'
import { addWorkingMinutes, crmKpiState, DEFAULT_HOURS, fmtLeft, fmtMinutes, localDate, median, minutesPerWorkingDay, readSla, shiftEndsBetween, shiftsOn, shiftsOnOrNext, workingDaysBetween, workingMinutesBetween, type BusinessHours, type Shift } from '@/lib/support/sla'

/* The portal's SLA engine and KPI model, without a tenant (09-portal-guide.md §4c). IST business hours 09:00–18:00 Mon–Sat. */

const IST: BusinessHours = DEFAULT_HOURS
const ALWAYS: BusinessHours = { ...DEFAULT_HOURS, mode: 'always' }
// 2026-10-13 is a Tuesday. 09:00 IST = 03:30Z.
const tue0900 = '2026-10-13T03:30:00Z'
const tue1200 = '2026-10-13T06:30:00Z'
const tue1800 = '2026-10-13T12:30:00Z'
const tue2000 = '2026-10-13T14:30:00Z'
const wed1000 = '2026-10-14T04:30:00Z'
const sat1700 = '2026-10-17T11:30:00Z'
const mon0930 = '2026-10-19T04:00:00Z'

describe('business hours', () => {
  it('counts only the working window', () => {
    expect(workingMinutesBetween(tue0900, tue1200, IST)).toBe(180)
    expect(workingMinutesBetween(tue0900, tue1800, IST)).toBe(540)
    expect(workingMinutesBetween(tue1800, tue2000, IST)).toBe(0)
    expect(workingMinutesBetween(tue1200, wed1000, IST)).toBe(360 + 60)
  })
  it('skips Sunday and never goes negative', () => {
    expect(workingMinutesBetween(sat1700, mon0930, IST)).toBe(60 + 30)
    expect(workingMinutesBetween(tue1200, tue0900, IST)).toBe(0)
  })
  it('around the clock is plain elapsed time', () => {
    expect(workingMinutesBetween(tue1800, tue2000, ALWAYS)).toBe(120)
  })
  it('adds working minutes across the close of day and the weekend', () => {
    expect(addWorkingMinutes(tue1200, 60, IST).getTime()).toBe(Date.parse('2026-10-13T07:30:00Z'))
    // 6 h left on Tuesday, so 420 minutes lands at 10:00 on Wednesday.
    expect(addWorkingMinutes(tue1200, 420, IST).getTime()).toBe(Date.parse(wed1000))
    // Saturday 17:00 + 90 minutes: 60 to the close, then 30 into Monday.
    expect(addWorkingMinutes(sat1700, 90, IST).getTime()).toBe(Date.parse(mon0930))
    // Out of hours starts count from the next opening.
    expect(addWorkingMinutes(tue2000, 30, IST).getTime()).toBe(Date.parse('2026-10-14T04:00:00Z'))
  })
  it('counts working days', () => {
    expect(workingDaysBetween(new Date(tue0900), new Date(mon0930), IST)).toBe(6)
  })
})

describe('shifts', () => {
  // Morning 06:00–14:00 and evening 14:00–22:00 Monday to Saturday, a night shift 22:00–06:00 Monday to Friday nights.
  const MORNING: Shift = { key: 'morning', name: 'Morning', start: '06:00', end: '14:00', days: [1, 2, 3, 4, 5, 6], members: ['a@k7.com'] }
  const EVENING: Shift = { key: 'evening', name: 'Evening', start: '14:00', end: '22:00', days: [1, 2, 3, 4, 5, 6], members: ['b@k7.com'] }
  const NIGHT: Shift = { key: 'night', name: 'Night', start: '22:00', end: '06:00', days: [1, 2, 3, 4, 5], members: ['c@k7.com'] }
  const TWO: BusinessHours = { mode: 'business', timeZone: 'Asia/Kolkata', shifts: [MORNING, EVENING] }
  const THREE: BusinessHours = { ...TWO, shifts: [MORNING, EVENING, NIGHT] }
  const ist = (d: string, hm: string) => new Date(`${d}T${hm}:00+05:30`)

  it('counts the union of the shifts once', () => {
    // Tue 12:00 → 16:00 spans the handover: four hours, not eight.
    expect(workingMinutesBetween(ist('2026-10-13', '12:00'), ist('2026-10-13', '16:00'), TWO)).toBe(240)
    // Overlapping shifts count once.
    const overlap: BusinessHours = { ...TWO, shifts: [MORNING, { ...EVENING, start: '13:00' }] }
    expect(workingMinutesBetween(ist('2026-10-13', '12:00'), ist('2026-10-13', '16:00'), overlap)).toBe(240)
    // 22:00 to 06:00 is closed with two shifts and open with the night shift.
    expect(workingMinutesBetween(ist('2026-10-13', '21:00'), ist('2026-10-14', '07:00'), TWO)).toBe(120)
    expect(workingMinutesBetween(ist('2026-10-13', '21:00'), ist('2026-10-14', '07:00'), THREE)).toBe(600)
  })
  it('runs an overnight shift into the next morning, on the days it starts', () => {
    // Friday night's shift runs into Saturday 06:00; there is no Saturday night shift, so Sunday is closed until Monday 06:00.
    expect(workingMinutesBetween(ist('2026-10-17', '05:00'), ist('2026-10-17', '07:00'), THREE)).toBe(120)
    expect(workingMinutesBetween(ist('2026-10-17', '23:00'), ist('2026-10-19', '05:00'), THREE)).toBe(0)
    // Adding 30 working minutes at Saturday 21:50 lands at Monday 06:20.
    expect(addWorkingMinutes(ist('2026-10-17', '21:50'), 30, THREE).getTime()).toBe(ist('2026-10-19', '06:20').getTime())
  })
  it('knows who is on shift, or opens next', () => {
    expect(shiftsOn(ist('2026-10-13', '15:00'), THREE).map((x) => x.key)).toEqual(['evening'])
    expect(shiftsOn(ist('2026-10-14', '03:00'), THREE).map((x) => x.key)).toEqual(['night'])
    expect(shiftsOn(ist('2026-10-14', '03:00'), TWO)).toEqual([])
    expect(shiftsOnOrNext(ist('2026-10-14', '03:00'), TWO).map((x) => x.key)).toEqual(['morning'])
    // Sunday: the next shift is Monday's morning.
    expect(shiftsOnOrNext(ist('2026-10-18', '12:00'), TWO).map((x) => x.key)).toEqual(['morning'])
  })
  it('lists the shift ends in a window, and which one ends the day', () => {
    const ends = shiftEndsBetween(ist('2026-10-13', '13:00'), ist('2026-10-13', '23:00'), TWO)
    expect(ends.map((e) => [e.shift.key, e.date, e.lastOfDay])).toEqual([
      ['morning', '2026-10-13', false],
      ['evening', '2026-10-13', true],
    ])
    // The night shift that opened on Tuesday closes on Wednesday morning and is filed under Tuesday.
    const night = shiftEndsBetween(ist('2026-10-14', '05:00'), ist('2026-10-14', '07:00'), THREE)
    expect(night.map((e) => [e.shift.key, e.date, e.lastOfDay])).toEqual([['night', '2026-10-13', true]])
    expect(localDate(ist('2026-10-14', '03:00'), 'Asia/Kolkata')).toBe('2026-10-14')
  })
  it('derives the length of a working day', () => {
    expect(minutesPerWorkingDay(IST)).toBe(540)
    expect(minutesPerWorkingDay(TWO)).toBe(960)
  })
  it('reads normalised shifts from a stored document', () => {
    const shifts = normaliseShifts({ shifts: [{ name: 'Night', start: '22:00', end: '6:00', days: ['1', '1', '9'], members: 'C@K7.com\nnot-an-email' }, { name: 'Night', start: '09:00', end: '09:00', days: ['2'] }] })
    expect(shifts).toEqual([{ key: 'night', name: 'Night', start: '22:00', end: '06:00', days: [1], members: ['c@k7.com'] }])
  })
})

describe('readings', () => {
  const now = new Date(tue1200)
  it('classifies running cases by the share of target used', () => {
    expect(readSla({ start: tue0900, now, targetMinutes: 240, warnAtPercent: 75, hours: IST }).state).toBe('at-risk') // 180/240
    expect(readSla({ start: tue0900, now, targetMinutes: 480, warnAtPercent: 75, hours: IST }).state).toBe('ok')
    const b = readSla({ start: tue0900, now, targetMinutes: 120, warnAtPercent: 75, hours: IST })
    expect(b.state).toBe('breached')
    expect(b.left).toBe(-60)
    expect(fmtLeft(b)).toBe('overdue 1 h')
    // Under half a minute past the deadline it is just overdue, never "overdue 0 min".
    expect(fmtLeft(readSla({ start: tue0900, now: new Date(Date.parse(tue0900) + 60_000 * 60 + 20_000), targetMinutes: 60, warnAtPercent: 75, hours: IST }))).toBe('just overdue')
  })
  it('stops the clock at the end and reports met or breached', () => {
    expect(readSla({ start: tue0900, end: tue1200, now: new Date(wed1000), targetMinutes: 240, warnAtPercent: 75, hours: IST }).state).toBe('met')
    expect(readSla({ start: tue0900, end: wed1000, now: new Date(wed1000), targetMinutes: 240, warnAtPercent: 75, hours: IST }).state).toBe('breached')
  })
  it('subtracts hold time and honours pauses', () => {
    const r = readSla({ start: tue0900, now, targetMinutes: 240, warnAtPercent: 75, hours: IST, holdMinutes: 120 })
    expect(r.elapsed).toBe(60)
    expect(r.state).toBe('ok')
    expect(readSla({ start: tue0900, now, targetMinutes: 60, warnAtPercent: 75, hours: IST, paused: true }).state).toBe('paused')
  })
  it('formats durations and maps the CRM statuses', () => {
    expect(fmtMinutes(45)).toBe('45 min')
    expect(fmtMinutes(200)).toBe('3 h 20 m')
    expect(fmtMinutes(3000)).toBe('50 h')
    expect(crmKpiState(1)).toBe('breached')
    expect(crmKpiState(2)).toBe('at-risk')
    expect(crmKpiState(4)).toBe('met')
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('targets', () => {
  it('picks the most specific row: vertical over priority over origin', () => {
    expect(resolveTarget(DEFAULT_TARGETS, { vertical: 100000000, priority: 2, origin: 1 }).resolveMinutes).toBe(120) // Consumer
    expect(resolveTarget(DEFAULT_TARGETS, { vertical: null, priority: 696720000, origin: 2 }).resolveMinutes).toBe(120) // Critical
    expect(resolveTarget(DEFAULT_TARGETS, { vertical: 100000002, priority: 696720000, origin: 2 }).resolveMinutes).toBe(240) // Enterprise beats Critical
    expect(resolveTarget(DEFAULT_TARGETS, { vertical: null, priority: null, origin: null }).resolveMinutes).toBe(240)
  })
  it('falls back to the catch-all when nothing matches', () => {
    const t = resolveTarget([{ vertical: 767340001, priority: 'any', origin: 'any', responseMinutes: 10, resolveMinutes: 20, followUpMinutes: 30, pickupMinutes: 5, labMinutes: 180 }], { vertical: null, priority: null, origin: null })
    expect(t.resolveMinutes).toBe(240)
  })
})

describe('settings', () => {
  it('normalises a stored document and falls back to defaults for empty parts', () => {
    const s = normaliseSettings({ targets: [{ vertical: 'any', priority: '1', origin: 'any', responseMinutes: 30, resolveMinutes: 90 }], warnAtPercent: 150, hours: { mode: 'always', days: ['1', '2'] }, kpis: [{ key: 'fcr', enabled: true, target: 80 }, { key: 'bogus', enabled: true }], sweep: { managerEmails: 'a@k7.com, b@k7.com' }, managers: [{ email: 'Boss@K7.com' }] })
    expect(s.targets[0]!.priority).toBe(1)
    // Rows saved before the three clocks existed take the desk's numbers: 30, 5 and 180 working minutes.
    expect(s.targets[0]).toMatchObject({ followUpMinutes: 30, pickupMinutes: 5, labMinutes: 180 })
    expect(s.warnAtPercent).toBe(99)
    expect(s.hours.mode).toBe('always')
    // The old single window becomes one shift.
    expect(s.hours.shifts).toEqual([{ key: 'day', name: 'Day', start: '09:00', end: '18:00', days: [1, 2], members: [] }])
    expect(s.kpis[0]).toEqual({ key: 'fcr', enabled: true, target: 80 })
    expect(s.kpis.filter((k) => k.key !== 'fcr').every((k) => k.enabled)).toBe(true) // cards added later appear with their defaults
    expect(s.kpis.some((k) => k.key === 'followup-sla')).toBe(true)
    // The old "Email the managers" list becomes the notification managers.
    expect(s.notify.managers).toEqual(['a@k7.com', 'b@k7.com'])
    expect(s.automatedSubjects).toContain('Acknowledgement For New Ticket')
    expect(s.managers).toEqual(['boss@k7.com'])
    expect(s.managerRoles).toEqual(DEFAULT_SETTINGS.managerRoles)
    expect(normaliseSettings(null)).toBe(DEFAULT_SETTINGS)
  })
  it('bounds a period on the desk clock', () => {
    const now = new Date('2026-10-13T06:30:00Z')
    expect(periodBounds('7d', now, 'Asia/Kolkata').from.toISOString()).toBe('2026-10-06T06:30:00.000Z')
    expect(periodBounds('mtd', now, 'Asia/Kolkata').from.toISOString()).toBe('2026-09-30T18:30:00.000Z')
  })
})
