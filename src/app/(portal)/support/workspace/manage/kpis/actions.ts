'use server'

import { redirect } from 'next/navigation'

import { normaliseCsat } from '@/lib/support/csat-model'
import { getSettings, saveSettings } from '@/lib/support/kpi-config'
import { asPeriod, KPI_DEFS, RULE_DEFS, type KpiKey, type RuleAction, type RuleKey, type Settings, type TargetRule } from '@/lib/support/kpi-model'
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
const hhmm = (v: string, d: string): string => (/^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, '0') : d)

export async function saveSettingsAction(form: FormData): Promise<void> {
  await requireManager()
  const cur = await getSettings()
  const errors: string[] = []

  const targets: TargetRule[] = []
  const count = Number(s(form, 't_count')) || 0
  for (let i = 0; i < count + 1; i++) {
    const response = n(form, `t_${i}_response`)
    const resolve = n(form, `t_${i}_resolve`)
    if (response === null || resolve === null || response <= 0 || resolve <= 0) continue
    targets.push({ vertical: anyOrNum(s(form, `t_${i}_vertical`)), priority: anyOrNum(s(form, `t_${i}_priority`)), origin: anyOrNum(s(form, `t_${i}_origin`)), responseMinutes: Math.round(response), resolveMinutes: Math.round(resolve) })
  }
  if (!targets.some((t) => t.vertical === 'any' && t.priority === 'any' && t.origin === 'any')) errors.push('Keep one catch-all row (any vertical, any priority, any origin).')

  const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => form.get(`day_${d}`) === '1')
  const warn = n(form, 'warnAtPercent')

  const kpis = KPI_DEFS.map((d) => ({ key: d.key as KpiKey, enabled: form.get(`kpi_${d.key}_enabled`) === '1', target: n(form, `kpi_${d.key}_target`) }))

  const rules = RULE_DEFS.map((d) => {
    const actions = form.getAll(`rule_${d.key}_actions`).map(String).filter((a): a is RuleAction => ['flag', 'note', 'queue', 'email-owner', 'email-managers'].includes(a))
    const queueId = s(form, `rule_${d.key}_queue`)
    if (actions.includes('queue') && !queueId) errors.push(`"${d.label}" adds to a queue but no queue is chosen.`)
    return { key: d.key as RuleKey, enabled: form.get(`rule_${d.key}_enabled`) === '1', thresholdMinutes: d.thresholdLabel ? n(form, `rule_${d.key}_threshold`) : null, cooldownHours: Math.max(1, n(form, `rule_${d.key}_cooldown`) ?? 8), actions: (actions.length ? actions : ['flag']) as RuleAction[], queueId: queueId || null }
  })

  const next: Settings = {
    targets: targets.length ? targets : cur.targets,
    warnAtPercent: warn === null ? cur.warnAtPercent : Math.min(99, Math.max(10, Math.round(warn))),
    phoneCountsAsResponded: form.get('phoneCountsAsResponded') === '1',
    pauseWhileWaiting: form.get('pauseWhileWaiting') === '1',
    subtractOnHold: form.get('subtractOnHold') === '1',
    hours: { mode: s(form, 'hours_mode') === 'always' ? 'always' : 'business', start: hhmm(s(form, 'hours_start'), cur.hours.start), end: hhmm(s(form, 'hours_end'), cur.hours.end), days: days.length ? days : cur.hours.days, timeZone: s(form, 'hours_tz') || cur.hours.timeZone },
    kpis,
    defaultPeriod: asPeriod(s(form, 'defaultPeriod'), cur.defaultPeriod),
    rules,
    sweep: { enabled: form.get('sweep_enabled') === '1', live: form.get('sweep_live') === '1', managerEmails: lines(s(form, 'sweep_emails')).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) },
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
      notifyManagersOnLow: form.get('csat_notifyManagersOnLow') === '1',
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
