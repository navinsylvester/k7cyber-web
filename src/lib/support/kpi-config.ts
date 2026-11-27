import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { DEFAULT_SETTINGS, normaliseSettings, type Settings } from './kpi-model'
import { forget, memo } from './memo'

export * from './kpi-model'

/* Support KPI configuration storage: the Payload global `support-settings`, read with a short memo and written from the KPI page.
   Access is overridden because the caller has already passed requireManager(); Payload admins can edit the raw form at /admin. */

type Raw = Record<string, unknown>

const SETTINGS_KEY = 'settings:support'

/** The current settings; defaults when the global was never saved. Memoised for 30 seconds per process. */
export const getSettings = (): Promise<Settings> =>
  memo(SETTINGS_KEY, 30_000, async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const g = (await payload.findGlobal({ slug: 'support-settings', depth: 0, overrideAccess: true })) as unknown as Raw
      return normaliseSettings(g)
    } catch (e) {
      console.error(`[support settings] read failed: ${(e as Error).message}`)
      return DEFAULT_SETTINGS
    }
  })

/** Writes the whole configuration (the KPI page posts every field). */
export const saveSettings = async (s: Settings): Promise<void> => {
  const payload = await getPayload({ config: configPromise })
  await payload.updateGlobal({
    slug: 'support-settings',
    overrideAccess: true,
    data: {
      targets: s.targets.map((t) => ({ vertical: String(t.vertical), priority: String(t.priority), origin: String(t.origin), responseMinutes: t.responseMinutes, resolveMinutes: t.resolveMinutes, followUpMinutes: t.followUpMinutes, pickupMinutes: t.pickupMinutes, labMinutes: t.labMinutes })),
      warnAtPercent: s.warnAtPercent,
      phoneCountsAsResponded: s.phoneCountsAsResponded,
      pauseWhileWaiting: s.pauseWhileWaiting,
      subtractOnHold: s.subtractOnHold,
      hours: {
        mode: s.hours.mode,
        timeZone: s.hours.timeZone,
        shifts: s.hours.shifts.map((x) => ({ key: x.key, name: x.name, start: x.start, end: x.end, days: x.days.map(String), members: x.members.join('\n') })),
      },
      kpis: s.kpis.map((k) => ({ key: k.key, enabled: k.enabled, target: k.target })),
      defaultPeriod: s.defaultPeriod,
      automatedSubjects: s.automatedSubjects.join('\n'),
      notify: {
        enabled: s.notify.enabled,
        kpiPeriod: s.notify.kpiPeriod,
        retentionDays: s.notify.retentionDays,
        managers: s.notify.managers.join('\n'),
        rules: s.notify.rules.map((r) => ({ key: r.key, audiences: r.audiences.join(','), delivery: r.delivery })),
      },
      sweep: { enabled: s.sweep.enabled, live: s.sweep.live },
      managerRoles: s.managerRoles.map((name) => ({ name })),
      managers: s.managers.map((email) => ({ email })),
      csat: { ...s.csat },
    } as never,
  })
  forget(SETTINGS_KEY)
}

