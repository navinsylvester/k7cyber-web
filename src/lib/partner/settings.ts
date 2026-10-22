import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { forget, memo } from '@/lib/support/memo'

import { DEFAULT_PARTNER_SETTINGS, normalisePartnerSettings, type PartnerSettings } from './settings-model'

export * from './settings-model'

/* Partner settings storage: the Payload global `partner-settings`, read with a short memo. Access is overridden because the
   callers have already passed the session helpers; Payload admins edit the raw form at /admin (M2 adds the K7 settings page). */

const KEY = 'settings:partner'

export const getPartnerSettings = (): Promise<PartnerSettings> =>
  memo(KEY, 30_000, async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const g = (await payload.findGlobal({ slug: 'partner-settings', depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>
      return normalisePartnerSettings(g)
    } catch (e) {
      console.error(`[partner settings] read failed: ${(e as Error).message}`)
      return DEFAULT_PARTNER_SETTINGS
    }
  })

export const savePartnerSettings = async (s: PartnerSettings): Promise<void> => {
  const payload = await getPayload({ config: configPromise })
  await payload.updateGlobal({
    slug: 'partner-settings',
    overrideAccess: true,
    data: {
      staff: s.staff.map((p) => ({ email: p.email, name: p.name, roles: p.roles })),
      channelManagersApproveDeals: s.channelManagersApproveDeals,
      marketingAdminsRunSchemes: s.marketingAdminsRunSchemes,
      devStaffPass: s.devStaffPass,
      partnerTypes: s.partnerTypes,
      regions: s.regions.map((r) => ({ ...r })),
      terms: { ...s.terms },
      deals: { ...s.deals },
      crm: { ...s.crm },
      notify: { ...s.notify },
    } as never,
  })
  forget(KEY)
}

/** The portal is on in development, and in production only with PARTNER_PORTAL_ENABLED=1 (02-build-plan.md §8). */
export const partnerPortalEnabled = (): boolean => process.env.PARTNER_PORTAL_ENABLED === '1' || (process.env.NODE_ENV !== 'production' && process.env.PARTNER_PORTAL_ENABLED !== '0')
