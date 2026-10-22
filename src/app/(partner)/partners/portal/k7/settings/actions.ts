'use server'

import { redirect } from 'next/navigation'

import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings, PARTNER_TYPES, savePartnerSettings, STAFF_ROLES, type PartnerSettings, type PartnerType, type StaffRole } from '@/lib/partner/settings'

/* Saves the partner portal's settings from the desk's page in one post (02-build-plan.md decision 5, §5). The staff list comes as
   indexed rows; a row without an email or a role is dropped, the way the normaliser drops it. Numbers that are blank keep the
   stored value. The CRM switch is here on purpose: a Channel Manager turns the mirror on when the service identity exists. */

const PATH = '/partners/portal/k7/settings'
const s = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const n = (form: FormData, k: string, d: number, min = 1): number => {
  const v = Number(s(form, k))
  return Number.isFinite(v) && v >= min ? Math.round(v) : d
}
const on = (form: FormData, k: string): boolean => form.get(k) === '1'

export async function savePartnerSettingsAction(form: FormData): Promise<void> {
  await requireK7Role(['channelManager'], PATH)
  const cur = await getPartnerSettings()
  const staff: PartnerSettings['staff'] = []
  for (let i = 0; i < 60; i++) {
    const email = s(form, `staff_${i}_email`).toLowerCase()
    if (!email && !form.has(`staff_${i}_email`)) break
    const roles = STAFF_ROLES.filter((r) => form.get(`staff_${i}_role_${r}`) === '1') as StaffRole[]
    if (email.includes('@') && roles.length) staff.push({ email, name: s(form, `staff_${i}_name`), roles })
  }
  const partnerTypes = PARTNER_TYPES.filter((t) => form.get(`type_${t}`) === '1') as PartnerType[]
  const regions = s(form, 'regions')
    .split(/\n+/)
    .map((line) => {
      const [code, ...rest] = line.split(/[,\t]/)
      return { code: (code ?? '').trim(), name: rest.join(',').trim() }
    })
    .filter((r) => r.code && r.name)
  const next: PartnerSettings = {
    ...cur,
    staff,
    channelManagersApproveDeals: on(form, 'channelManagersApproveDeals'),
    marketingAdminsRunSchemes: on(form, 'marketingAdminsRunSchemes'),
    devStaffPass: on(form, 'devStaffPass'),
    partnerTypes: partnerTypes.length ? partnerTypes : cur.partnerTypes,
    regions,
    terms: { version: s(form, 'terms_version') || cur.terms.version, url: s(form, 'terms_url') },
    deals: {
      protectionDays: n(form, 'deals_protectionDays', cur.deals.protectionDays),
      extensionDays: n(form, 'deals_extensionDays', cur.deals.extensionDays),
      approvalSlaHours: n(form, 'deals_approvalSlaHours', cur.deals.approvalSlaHours),
      requireCertificate: on(form, 'deals_requireCertificate'),
      conflictCheckCrm: on(form, 'deals_conflictCheckCrm'),
    },
    crm: {
      enabled: on(form, 'crm_enabled'),
      ownerRule: s(form, 'crm_ownerRule') === 'fixed' ? 'fixed' : 'approver',
      ownerId: s(form, 'crm_ownerId'),
      enquirySource: n(form, 'crm_enquirySource', cur.crm.enquirySource, 0),
      productCategory: n(form, 'crm_productCategory', cur.crm.productCategory, 0),
      accountNamePattern: s(form, 'crm_accountNamePattern') || cur.crm.accountNamePattern,
    },
    notify: { emailEnabled: on(form, 'notify_emailEnabled'), mailFrom: s(form, 'notify_mailFrom') || cur.notify.mailFrom, bellRetentionDays: n(form, 'notify_bellRetentionDays', cur.notify.bellRetentionDays, 7) },
  }
  try {
    await savePartnerSettings(next)
  } catch (e) {
    redirect(`${PATH}?error=${encodeURIComponent(`Could not save: ${(e as Error).message.slice(0, 160)}`)}`)
  }
  redirect(`${PATH}?ok=1`)
}
