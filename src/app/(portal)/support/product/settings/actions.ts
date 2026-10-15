'use server'

import { redirect } from 'next/navigation'

import { getProductSettings, saveProductSettings } from '@/lib/support/product-config'
import { PRIORITIES, TEAMS, type ProductSettings } from '@/lib/support/product-model'
import { requireLead } from '@/lib/support/session'

/* Saves the product desk's configuration from the settings page in one post. Light validation: a blank number keeps the stored value,
   lists accept commas or new lines, the tracker stays link-only until phase B registers the Yodiz adapter. */

const PATH = '/support/product/settings'
const s = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const n = (form: FormData, k: string, d: number, min = 1): number => {
  const v = Number(s(form, k))
  return Number.isFinite(v) && v >= min ? Math.round(v) : d
}
const on = (form: FormData, k: string): boolean => form.get(k) === '1'
const lines = (v: string): string[] => [...new Set(v.split(/[\n,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))]

export async function saveProductSettingsAction(form: FormData): Promise<void> {
  await requireLead()
  const cur = await getProductSettings()
  const next: ProductSettings = {
    ...cur,
    enabled: on(form, 'enabled'),
    teams: TEAMS.map((key) => {
      const c = cur.teams.find((t) => t.key === key)!
      return { key, name: s(form, `team_${key}_name`) || c.name, inboxEmail: s(form, `team_${key}_inbox`).toLowerCase(), leads: lines(s(form, `team_${key}_leads`)), trackerProject: s(form, `team_${key}_project`) }
    }),
    principals: { roles: [...new Set(s(form, 'principals_roles').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean))], emails: lines(s(form, 'principals_emails')), managersAreprincipals: on(form, 'principals_managers') },
    priorities: PRIORITIES.map((key) => {
      const c = cur.priorities.find((p) => p.key === key)!
      return { key, label: s(form, `prio_${key}_label`) || c.label, triageHours: n(form, `prio_${key}_triage`, c.triageHours), updateEveryDays: n(form, `prio_${key}_cadence`, c.updateEveryDays) }
    }),
    clock: { pauseWhileWithProduct: on(form, 'clock_pause'), autoCloseDays: n(form, 'clock_autoclose', cur.clock.autoCloseDays), warnAtPercent: Math.min(100, n(form, 'clock_warn', cur.clock.warnAtPercent, 10)) },
    mirror: { ...cur.mirror, enabled: on(form, 'mirror_enabled'), createCrmRows: on(form, 'mirror_rows'), notesOnLinkedCases: on(form, 'mirror_notes'), statusBack: on(form, 'mirror_status') },
    notify: { principalsOnRaise: on(form, 'notify_principals'), inboxOnAccept: on(form, 'notify_inbox'), ownerOnChange: on(form, 'notify_owner') },
  }
  try {
    await saveProductSettings(next)
  } catch (e) {
    redirect(`${PATH}?error=${encodeURIComponent(`Could not save: ${(e as Error).message.slice(0, 160)}`)}`)
  }
  redirect(`${PATH}?ok=1`)
}
