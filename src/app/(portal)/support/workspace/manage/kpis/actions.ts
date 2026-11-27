'use server'

import { redirect } from 'next/navigation'

import { normaliseCsat } from '@/lib/support/csat-model'
import { getSettings, saveSettings } from '@/lib/support/kpi-config'
import { asPeriod, KPI_DEFS, NEW_CLOCK_DEFAULTS, normaliseShifts, type KpiKey, type Settings, type TargetRule } from '@/lib/support/kpi-model'
import { requireManager } from '@/lib/support/session'

/* Saves the whole KPI configuration from the settings page in one post. Validation is light and forgiving: a blank target
   means "no target", a target row without both minute values is dropped, unknown values fall back to what was stored. */

const PATH = '/support/workspace/manage/kpis'

const s = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const n = (form: FormData, k: string): number | null => {
  const v = s(form, k)
  if (v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
const anyOrNum = (v: string): number | 'any' => (v === 'any' || v === '' ? 'any' : Number(v))
const lines = (v: string): string[] => v.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean)

export async function saveSettingsAction(form: FormData): Promise<void> {
  await requireManager()
  const cur = await getSettings()
  const errors: string[] = []

  const targets: TargetRule[] = []
  const count = Number(s(form, 't_count')) || 0
  const mins = (k: string, d: number) => {
    const v = n(form, k)
    return v !== null && v > 0 ? Math.round(v) : d
  }
  for (let i = 0; i < count + 1; i++) {
    const response = n(form, `t_${i}_response`)
    const resolve = n(form, `t_${i}_resolve`)
    if (response === null || resolve === null || response <= 0 || resolve <= 0) continue
    targets.push({
      vertical: anyOrNum(s(form, `t_${i}_vertical`)),
      priority: anyOrNum(s(form, `t_${i}_priority`)),
      origin: anyOrNum(s(form, `t_${i}_origin`)),
      responseMinutes: Math.round(response),
      resolveMinutes: Math.round(resolve),
      followUpMinutes: mins(`t_${i}_followup`, NEW_CLOCK_DEFAULTS.followUpMinutes),
      pickupMinutes: mins(`t_${i}_pickup`, NEW_CLOCK_DEFAULTS.pickupMinutes),
      labMinutes: mins(`t_${i}_lab`, NEW_CLOCK_DEFAULTS.labMinutes),
    })
  }
  if (!targets.some((t) => t.vertical === 'any' && t.priority === 'any' && t.origin === 'any')) errors.push('Keep one catch-all row (any vertical, any priority, any origin).')

  // Shifts: the rows posted, then the blank row for a new one. A row without a name, both times or a day is dropped.
  const shiftCount = Number(s(form, 'sh_count')) || 0
  const posted = Array.from({ length: shiftCount + 1 }, (_, i) => ({
    key: s(form, `sh_${i}_key`),
    name: s(form, `sh_${i}_name`),
    start: s(form, `sh_${i}_start`),
    end: s(form, `sh_${i}_end`),
    days: [0, 1, 2, 3, 4, 5, 6].filter((d) => form.get(`sh_${i}_day_${d}`) === '1').map(String),
    members: s(form, `sh_${i}_members`),
  })).filter((x) => x.name && x.start && x.end && x.days.length && form.get(`sh_${x.key || 'new'}_drop`) !== '1')
  const shifts = posted.length ? normaliseShifts({ shifts: posted }) : []
  if (!shifts.length) errors.push('Keep at least one shift with a name, a start, an end and a day.')
  const warn = n(form, 'warnAtPercent')

  const kpis = KPI_DEFS.map((d) => ({ key: d.key as KpiKey, enabled: form.get(`kpi_${d.key}_enabled`) === '1', target: n(form, `kpi_${d.key}_target`) }))


  const next: Settings = {
    targets: targets.length ? targets : cur.targets,
    warnAtPercent: warn === null ? cur.warnAtPercent : Math.min(99, Math.max(10, Math.round(warn))),
    phoneCountsAsResponded: form.get('phoneCountsAsResponded') === '1',
    pauseWhileWaiting: form.get('pauseWhileWaiting') === '1',
    subtractOnHold: form.get('subtractOnHold') === '1',
    hours: { mode: s(form, 'hours_mode') === 'always' ? 'always' : 'business', timeZone: s(form, 'hours_tz') || cur.hours.timeZone, shifts: shifts.length ? shifts : cur.hours.shifts },
    kpis,
    defaultPeriod: asPeriod(s(form, 'defaultPeriod'), cur.defaultPeriod),
    automatedSubjects: String(form.get('automatedSubjects') ?? '')
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean),
    notify: cur.notify,
    sweep: { enabled: form.get('sweep_enabled') === '1', live: form.get('sweep_live') === '1' },
    managerRoles: lines(s(form, 'managerRoles')).length ? lines(s(form, 'managerRoles')) : cur.managerRoles,
    managers: lines(s(form, 'managers')).map((e) => e.toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    csat: normaliseCsat({
      enabled: form.get('csat_enabled') === '1',
      satisfiedFrom: n(form, 'csat_satisfiedFrom') ?? cur.csat.satisfiedFrom,
      unhappyAtOrBelow: n(form, 'csat_unhappyAtOrBelow') ?? cur.csat.unhappyAtOrBelow,
      inviteMode: s(form, 'csat_inviteMode') || cur.csat.inviteMode,
      inviteOnResolve: form.get('csat_inviteOnResolve') === '1',
      reminderAfterHours: n(form, 'csat_reminderAfterHours'),
      surveyDays: n(form, 'csat_surveyDays') ?? cur.csat.surveyDays,
      followUpMinutes: n(form, 'csat_followUpMinutes') ?? cur.csat.followUpMinutes,
      notifyManagersOnLow: cur.csat.notifyManagersOnLow,
      careWindowDays: n(form, 'csat_careWindowDays') ?? cur.csat.careWindowDays,
      careRecent: n(form, 'csat_careRecent') ?? cur.csat.careRecent,
    }),
    updatedAt: null,
  }
  if (next.csat.unhappyAtOrBelow >= next.csat.satisfiedFrom) errors.push('The "unhappy" score must be below the "satisfied" score.')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: next.hours.timeZone })
  } catch {
    errors.push(`Unknown time zone "${next.hours.timeZone}".`)
  }
  if (errors.length) redirect(`${PATH}?error=${encodeURIComponent(errors.join(' '))}`)
  try {
    await saveSettings(next)
  } catch (e) {
    redirect(`${PATH}?error=${encodeURIComponent(`Could not save: ${(e as Error).message.slice(0, 160)}`)}`)
  }
  redirect(`${PATH}?ok=1`)
}
