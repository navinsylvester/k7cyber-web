import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { forget, memo } from './memo'
import { DEFAULT_PRODUCT, normaliseProductSettings, type ProductSettings } from './product-model'

export * from './product-model'

/* Product desk configuration storage: the Payload global `product-settings`, read with a short memo and written from the settings page.
   Access is overridden because the caller has already passed requireLead(); Payload admins can edit the raw form at /admin. */

const KEY = 'settings:product'

export const getProductSettings = (): Promise<ProductSettings> =>
  memo(KEY, 30_000, async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const g = (await payload.findGlobal({ slug: 'product-settings', depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>
      return normaliseProductSettings(g)
    } catch (e) {
      console.error(`[product settings] read failed: ${(e as Error).message}`)
      return DEFAULT_PRODUCT
    }
  })

export const saveProductSettings = async (s: ProductSettings): Promise<void> => {
  const payload = await getPayload({ config: configPromise })
  await payload.updateGlobal({
    slug: 'product-settings',
    overrideAccess: true,
    data: {
      enabled: s.enabled,
      teams: s.teams.map((t) => ({ key: t.key, name: t.name, inboxEmail: t.inboxEmail, trackerProject: t.trackerProject, leads: t.leads.map((email) => ({ email })) })),
      principals: { roles: s.principals.roles.map((name) => ({ name })), emails: s.principals.emails.map((email) => ({ email })), managersAreprincipals: s.principals.managersAreprincipals },
      priorities: s.priorities.map((p) => ({ key: p.key, label: p.label, triageHours: p.triageHours, updateEveryDays: p.updateEveryDays })),
      clock: { ...s.clock },
      tracker: { ...s.tracker },
      statusMap: s.statusMap.map((m) => ({ ...m })),
      mirror: { ...s.mirror },
      notify: { ...s.notify },
    } as never,
  })
  forget(KEY)
}
