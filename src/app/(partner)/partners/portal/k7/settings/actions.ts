'use server'

import { redirect } from 'next/navigation'

import { requireK7Role } from '@/lib/partner/session'
import { WEEKDAYS } from '@/lib/partner/sla-model'
import { parseReminderDays } from '@/lib/partner/certificates-model'
import { COLLATERAL_MAX_MB_CEILING, CRM_FEATURES, getPartnerSettings, PARTNER_TYPES, savePartnerSettings, STAFF_ROLES, type PartnerSettings, type PartnerType, type StaffRole } from '@/lib/partner/settings'

import { settingsHref, settingsTab, type SettingsTab } from './tabs'

/* Saves one tab of the partner portal's settings (02-build-plan.md decision 5, §5; the tabs in ./tabs.ts). Each tab posts its own
   form with `section`, and only that section's fields are rewritten: the rest stays as stored, so a switch on a tab that was not
   shown is never read as off. The staff list comes as indexed rows; a row without an email or a role is dropped, the way the
   normaliser drops it. Numbers that are blank keep the stored value. The CRM switch is here on purpose: a Channel Manager turns
   the mirror on when the service identity exists. */

const s = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const n = (form: FormData, k: string, d: number, min = 1): number => {
  const v = Number(s(form, k))
  return Number.isFinite(v) && v >= min ? Math.round(v) : d
}
const on = (form: FormData, k: string): boolean => form.get(k) === '1'

const SECTIONS: Record<SettingsTab, (form: FormData, cur: PartnerSettings) => Partial<PartnerSettings>> = {
  staff: (form) => {
    const staff: PartnerSettings['staff'] = []
    for (let i = 0; i < 60; i++) {
      const email = s(form, `staff_${i}_email`).toLowerCase()
      if (!email && !form.has(`staff_${i}_email`)) break
      const roles = STAFF_ROLES.filter((r) => form.get(`staff_${i}_role_${r}`) === '1') as StaffRole[]
      if (email.includes('@') && roles.length)
        staff.push({
          email,
          name: s(form, `staff_${i}_name`),
          roles,
          manager: s(form, `staff_${i}_manager`).toLowerCase(),
        })
    }
    return {
      staff,
      channelManagersApproveDeals: on(form, 'channelManagersApproveDeals'),
      marketingAdminsRunSchemes: on(form, 'marketingAdminsRunSchemes'),
      devStaffPass: on(form, 'devStaffPass'),
      testerStaffPass: on(form, 'testerStaffPass'),
    }
  },
  programme: (form, cur) => {
    const partnerTypes = PARTNER_TYPES.filter((t) => form.get(`type_${t}`) === '1') as PartnerType[]
    const regions = s(form, 'regions')
      .split(/\n+/)
      .map((line) => {
        const [code, ...rest] = line.split(/[,\t]/)
        return { code: (code ?? '').trim(), name: rest.join(',').trim() }
      })
      .filter((r) => r.code && r.name)
    return {
      partnerTypes: partnerTypes.length ? partnerTypes : cur.partnerTypes,
      regions,
      terms: { version: s(form, 'terms_version') || cur.terms.version, url: s(form, 'terms_url') },
      collateral: {
        maxMb: Math.min(n(form, 'collateral_maxMb', cur.collateral.maxMb, 1), COLLATERAL_MAX_MB_CEILING),
      },
      schemes: { disputeDays: n(form, 'schemes_disputeDays', cur.schemes.disputeDays, 0) },
    }
  },
  deals: (form, cur) => ({
    deals: {
      protectionDays: n(form, 'deals_protectionDays', cur.deals.protectionDays),
      extensionDays: n(form, 'deals_extensionDays', cur.deals.extensionDays),
      approvalSlaHours: n(form, 'deals_approvalSlaHours', cur.deals.approvalSlaHours),
      endingNoticeDays: n(form, 'deals_endingNoticeDays', cur.deals.endingNoticeDays),
      requireCertificate: on(form, 'deals_requireCertificate'),
      conflictCheckCrm: on(form, 'deals_conflictCheckCrm'),
    },
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
  }),
  crm: (form, cur) => ({
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
  }),
  training: (form, cur) => ({
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
    certificates: (() => {
      const merit = Math.min(100, n(form, 'cert_meritFrom', cur.certificates.meritFrom, 1))
      const tracks = s(form, 'cert_tracks')
        .split(/[\s,;]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
      const rules: PartnerSettings['certificates']['rules'] = []
      for (const type of PARTNER_TYPES) for (const track of tracks) rules.push({ type, track, people: n(form, `cert_rule_${type}_${track}`, 0, 0) })
      const reminders = parseReminderDays(s(form, 'cert_reminderDays'))
      return {
        validityMonths: n(form, 'cert_validityMonths', cur.certificates.validityMonths, 1),
        orgValidityMonths: n(form, 'cert_orgValidityMonths', cur.certificates.orgValidityMonths, 1),
        reminderDays: reminders.length ? reminders : cur.certificates.reminderDays,
        meritFrom: merit,
        distinctionFrom: Math.max(merit, Math.min(100, n(form, 'cert_distinctionFrom', cur.certificates.distinctionFrom, 1))),
        rules: tracks.length ? rules : cur.certificates.rules,
        signatoryName: s(form, 'cert_signatoryName'),
        signatoryTitle: s(form, 'cert_signatoryTitle') || cur.certificates.signatoryTitle,
        issuer: s(form, 'cert_issuer') || cur.certificates.issuer,
      }
    })(),
  }),
  notifications: (form, cur) => ({
    notify: {
      emailEnabled: on(form, 'notify_emailEnabled'),
      mailFrom: s(form, 'notify_mailFrom') || cur.notify.mailFrom,
      bellRetentionDays: n(form, 'notify_bellRetentionDays', cur.notify.bellRetentionDays, 7),
      signature: s(form, 'notify_signature') || cur.notify.signature,
    },
  }),
}

export async function savePartnerSettingsAction(form: FormData): Promise<void> {
  const tab = settingsTab(s(form, 'section'))
  await requireK7Role(['channelManager'], settingsHref(tab))
  const cur = await getPartnerSettings()
  const next: PartnerSettings = { ...cur, ...SECTIONS[tab](form, cur) }
  try {
    await savePartnerSettings(next)
  } catch (e) {
    redirect(settingsHref(tab, `error=${encodeURIComponent(`Could not save: ${(e as Error).message.slice(0, 160)}`)}`))
  }
  redirect(settingsHref(tab, 'ok=1'))
}
