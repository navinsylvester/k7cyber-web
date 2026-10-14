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
      targets: s.targets.map((t) => ({ vertical: String(t.vertical), priority: String(t.priority), origin: String(t.origin), responseMinutes: t.responseMinutes, resolveMinutes: t.resolveMinutes })),
      warnAtPercent: s.warnAtPercent,
      phoneCountsAsResponded: s.phoneCountsAsResponded,
      pauseWhileWaiting: s.pauseWhileWaiting,
      subtractOnHold: s.subtractOnHold,
      hours: { mode: s.hours.mode, start: s.hours.start, end: s.hours.end, timeZone: s.hours.timeZone, days: s.hours.days.map(String) },
      kpis: s.kpis.map((k) => ({ key: k.key, enabled: k.enabled, target: k.target })),
      defaultPeriod: s.defaultPeriod,
      rules: s.rules.map((r) => ({ key: r.key, enabled: r.enabled, thresholdMinutes: r.thresholdMinutes, cooldownHours: r.cooldownHours, actions: r.actions, queueId: r.queueId })),
      sweep: { enabled: s.sweep.enabled, live: s.sweep.live, managerEmails: s.sweep.managerEmails.join(', ') },
      managerRoles: s.managerRoles.map((name) => ({ name })),
      managers: s.managers.map((email) => ({ email })),
    } as never,
  })
  forget(SETTINGS_KEY)
}

