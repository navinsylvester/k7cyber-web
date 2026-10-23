'use server'

import { redirect } from 'next/navigation'

import { requireK7Role } from '@/lib/partner/session'
import { WEEKDAYS } from '@/lib/partner/sla-model'
import { COLLATERAL_MAX_MB_CEILING, CRM_FEATURES, getPartnerSettings, PARTNER_TYPES, savePartnerSettings, STAFF_ROLES, type PartnerSettings, type PartnerType, type StaffRole } from '@/lib/partner/settings'

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
    if (email.includes('@') && roles.length) staff.push({ email, name: s(form, `staff_${i}_name`), roles, manager: s(form, `staff_${i}_manager`).toLowerCase() })
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
      endingNoticeDays: n(form, 'deals_endingNoticeDays', cur.deals.endingNoticeDays),
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
      syncMinutes: n(form, 'crm_syncMinutes', cur.crm.syncMinutes, 5),
      features: Object.fromEntries(CRM_FEATURES.map((f) => [f, on(form, `crm_feature_${f}`)])) as PartnerSettings['crm']['features'],
    },
    notify: { emailEnabled: on(form, 'notify_emailEnabled'), mailFrom: s(form, 'notify_mailFrom') || cur.notify.mailFrom, bellRetentionDays: n(form, 'notify_bellRetentionDays', cur.notify.bellRetentionDays, 7), signature: s(form, 'notify_signature') || cur.notify.signature },
    sla: {
      hours: {
        mode: s(form, 'sla_mode') === 'always' ? 'always' : 'business',
        start: /^\d{1,2}:\d{2}$/.test(s(form, 'sla_start')) ? s(form, 'sla_start') : cur.sla.hours.start,
        end: /^\d{1,2}:\d{2}$/.test(s(form, 'sla_end')) ? s(form, 'sla_end') : cur.sla.hours.end,
        days: WEEKDAYS.map((w) => w.n).filter((d) => form.get(`sla_day_${d}`) === '1'),
        timeZone: s(form, 'sla_timeZone') || cur.sla.hours.timeZone,
      },
      warnShare: (() => {
        const v = Number(s(form, 'sla_warnPercent'))
        return Number.isFinite(v) && v >= 10 && v <= 95 ? v / 100 : cur.sla.warnShare
      })(),
      escalateTo: s(form, 'sla_escalateTo')
        .split(/[\s,;]+/)
        .map((x) => x.trim().toLowerCase())
        .filter((x) => x.includes('@')),
    },
    collateral: { maxMb: Math.min(n(form, 'collateral_maxMb', cur.collateral.maxMb, 1), COLLATERAL_MAX_MB_CEILING) },
    schemes: { disputeDays: n(form, 'schemes_disputeDays', cur.schemes.disputeDays, 0) },
    training: {
      watchShare: (() => {
        const v = Number(s(form, 'training_watchPercent'))
        return Number.isFinite(v) && v >= 10 && v <= 100 ? v / 100 : cur.training.watchShare
      })(),
      passMark: Math.min(100, n(form, 'training_passMark', cur.training.passMark, 1)),
      timeLimitMinutes: n(form, 'training_timeLimitMinutes', cur.training.timeLimitMinutes, 1),
      questionsPerTest: n(form, 'training_questionsPerTest', cur.training.questionsPerTest, 1),
      showAnswers: on(form, 'training_showAnswers'),
    },
  }
  try {
    await savePartnerSettings(next)
  } catch (e) {
    redirect(`${PATH}?error=${encodeURIComponent(`Could not save: ${(e as Error).message.slice(0, 160)}`)}`)
  }
  redirect(`${PATH}?ok=1`)
}
