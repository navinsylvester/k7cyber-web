import { describe, expect, it } from 'vitest'

import { ScopeError, inScope, orgWhere } from '@/lib/partner/scope'
import { DEFAULT_PARTNER_SETTINGS, normalisePartnerSettings, staffRolesFor, staffWithRole } from '@/lib/partner/settings-model'
import { issueOtp, verifyOtp } from '@/lib/support/otp'

/* The partner portal's skeleton without a tenant (docs/partner-portal/04-portal-guide.md): the organisation scope every query
   must carry (FR-ROLE-01), the K7 role resolution with its two default fallbacks (decision 5), the settings normaliser and the
   separation of the two one-time-code doors (decision 3). */

process.env.AUTH_SECRET ||= 'test-secret-for-partner-otp'

describe('organisation scope', () => {
  it('puts the organisation into every filter, before anything else', () => {
    expect(orgWhere({ orgId: 'org1' })).toEqual({ org: { equals: 'org1' } })
    expect(orgWhere({ orgId: 'org1' }, { status: { equals: 'open' } })).toEqual({ and: [{ org: { equals: 'org1' } }, { status: { equals: 'open' } }] })
    expect(orgWhere({ orgId: 'org1' }, undefined, 'orgId')).toEqual({ orgId: { equals: 'org1' } })
  })
  it('refuses an empty scope rather than returning everything', () => {
    expect(() => orgWhere({ orgId: '' })).toThrow(ScopeError)
    expect(() => orgWhere(undefined as unknown as { orgId: string })).toThrow(ScopeError)
    expect(() => orgWhere({ orgId: '   ' })).toThrow(ScopeError)
  })
  it('checks a read row against the scope, whether the relation is populated or an id', () => {
    expect(inScope({ orgId: 'a' }, { org: 'a' })).toBe(true)
    expect(inScope({ orgId: 'a' }, { org: { id: 'a' } })).toBe(true)
    expect(inScope({ orgId: 'a' }, { orgId: 'a' })).toBe(true)
    expect(inScope({ orgId: 'a' }, { org: 'b' })).toBe(false)
    expect(inScope({ orgId: 'a' }, null)).toBe(false)
    expect(inScope({ orgId: '' }, { org: '' })).toBe(false)
  })
})

describe('K7 staff roles', () => {
  const s = normalisePartnerSettings({
    staff: [
      { email: 'Priya@K7computing.com', name: 'Priya', roles: ['channelManager'] },
      { email: 'raman@k7computing.com', roles: ['marketingAdmin', 'trainingAdmin'] },
      { email: 'raman@k7computing.com', roles: ['channelManager'] },
      { email: 'nobody', roles: ['channelManager'] },
      { email: 'blank@k7computing.com', roles: [] },
    ],
  })
  it('normalises emails, drops entries without an address or a role, and keeps one person on several rows', () => {
    expect(s.staff.map((p) => p.email)).toEqual(['priya@k7computing.com', 'raman@k7computing.com', 'raman@k7computing.com'])
  })
  it('gives the fallbacks by default: Channel Managers approve deals, Marketing Admins run schemes', () => {
    expect(staffRolesFor('priya@k7computing.com', s)).toEqual(['channelManager', 'dealDeskApprover'])
    expect(staffRolesFor('RAMAN@k7computing.com ', s)).toEqual(['channelManager', 'dealDeskApprover', 'trainingAdmin', 'marketingAdmin', 'schemeAdmin'])
    expect(staffRolesFor('someone@k7computing.com', s)).toEqual([])
    expect(staffRolesFor('', s)).toEqual([])
  })
  it('withholds the fallbacks when the flags are off', () => {
    const strict = { ...s, channelManagersApproveDeals: false, marketingAdminsRunSchemes: false }
    expect(staffRolesFor('priya@k7computing.com', strict)).toEqual(['channelManager'])
    expect(staffRolesFor('raman@k7computing.com', strict)).toEqual(['channelManager', 'trainingAdmin', 'marketingAdmin'])
  })
  it('lets a development sign-in hold every role, except in production or when the switch is off', () => {
    expect(staffRolesFor('', s, { dev: true })).toHaveLength(5)
    expect(staffRolesFor('', s, { dev: true, production: true })).toEqual([])
    expect(staffRolesFor('', { ...s, devStaffPass: false }, { dev: true })).toEqual([])
  })
  it('lists who holds a role, fallbacks included, for notifications', () => {
    expect(staffWithRole('dealDeskApprover', s).map((p) => p.email)).toEqual(['priya@k7computing.com', 'raman@k7computing.com'])
    expect(staffWithRole('schemeAdmin', s).map((p) => p.email)).toEqual(['raman@k7computing.com'])
  })
})

describe('settings normaliser', () => {
  it('returns the defaults for an empty or missing global', () => {
    expect(normalisePartnerSettings(null)).toEqual(DEFAULT_PARTNER_SETTINGS)
    expect(normalisePartnerSettings({})).toEqual(DEFAULT_PARTNER_SETTINGS)
  })
  it('keeps valid values and repairs invalid ones field by field', () => {
    const s = normalisePartnerSettings({
      partnerTypes: ['var', 'bogus'],
      regions: [{ code: 'S', name: 'South' }, { code: '', name: 'No code' }],
      deals: { protectionDays: 120, extensionDays: -1, requireCertificate: true },
      crm: { enabled: true, ownerRule: 'fixed', ownerId: 'u1', accountNamePattern: '' },
      notify: { emailEnabled: false, mailFrom: '' },
    })
    expect(s.partnerTypes).toEqual(['var'])
    expect(s.regions).toEqual([{ code: 'S', name: 'South' }])
    expect(s.deals).toEqual({ protectionDays: 120, extensionDays: 90, approvalSlaHours: 48, endingNoticeDays: 14, requireCertificate: true, conflictCheckCrm: false })
    expect(s.crm.ownerRule).toBe('fixed')
    expect(s.crm.accountNamePattern).toBe('{customer}-Fresh-{product}')
    expect(s.notify.emailEnabled).toBe(false)
    expect(s.notify.mailFrom).toBe(DEFAULT_PARTNER_SETTINGS.notify.mailFrom)
  })
})

describe('the two code doors', () => {
  it('carries the purpose inside the signed token, so a partner code is told apart from a customer code', () => {
    const partner = issueOtp({ email: 'a@partner.example', purpose: 'partner-sign-in' })
    const customer = issueOtp({ email: 'a@partner.example', purpose: 'sign-in' })
    const p = verifyOtp(partner.token, partner.code, { consume: false })
    const c = verifyOtp(customer.token, customer.code, { consume: false })
    expect(p.ok && p.payload.purpose).toBe('partner-sign-in')
    expect(c.ok && c.payload.purpose).toBe('sign-in')
    // A token's purpose cannot be rewritten without breaking the signature.
    const [body, hash, sig] = partner.token.split('.')
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body!, 'base64url').toString()), purpose: 'sign-in' })).toString('base64url')
    expect(verifyOtp(`${forged}.${hash}.${sig}`, partner.code).ok).toBe(false)
  })
})
