import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS, DEFAULT_TARGETS, normaliseSettings, periodBounds, resolveTarget } from '@/lib/support/kpi-model'
import { addWorkingMinutes, crmKpiState, DEFAULT_HOURS, fmtLeft, fmtMinutes, median, readSla, workingDaysBetween, workingMinutesBetween, type BusinessHours } from '@/lib/support/sla'

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

describe('readings', () => {
  const now = new Date(tue1200)
  it('classifies running cases by the share of target used', () => {
    expect(readSla({ start: tue0900, now, targetMinutes: 240, warnAtPercent: 75, hours: IST }).state).toBe('at-risk') // 180/240
    expect(readSla({ start: tue0900, now, targetMinutes: 480, warnAtPercent: 75, hours: IST }).state).toBe('ok')
    const b = readSla({ start: tue0900, now, targetMinutes: 120, warnAtPercent: 75, hours: IST })
    expect(b.state).toBe('breached')
    expect(b.left).toBe(-60)
    expect(fmtLeft(b)).toBe('overdue 1 h')
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
    const t = resolveTarget([{ vertical: 767340001, priority: 'any', origin: 'any', responseMinutes: 10, resolveMinutes: 20 }], { vertical: null, priority: null, origin: null })
    expect(t.resolveMinutes).toBe(240)
  })
})

describe('settings', () => {
  it('normalises a stored document and falls back to defaults for empty parts', () => {
    const s = normaliseSettings({ targets: [{ vertical: 'any', priority: '1', origin: 'any', responseMinutes: 30, resolveMinutes: 90 }], warnAtPercent: 150, hours: { mode: 'always', days: ['1', '2'] }, kpis: [{ key: 'fcr', enabled: true, target: 80 }, { key: 'bogus', enabled: true }], rules: [{ key: 'stale', enabled: false, actions: ['note', 'nope'], cooldownHours: 2 }], sweep: { managerEmails: 'a@k7.com, b@k7.com' }, managers: [{ email: 'Boss@K7.com' }] })
    expect(s.targets[0]!.priority).toBe(1)
    expect(s.warnAtPercent).toBe(99)
    expect(s.hours.mode).toBe('always')
    expect(s.hours.days).toEqual([1, 2])
    expect(s.hours.start).toBe('09:00')
    expect(s.kpis).toEqual([{ key: 'fcr', enabled: true, target: 80 }])
    expect(s.rules).toEqual([{ key: 'stale', enabled: false, thresholdMinutes: null, cooldownHours: 2, actions: ['note'], queueId: null }])
    expect(s.sweep.managerEmails).toEqual(['a@k7.com', 'b@k7.com'])
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
