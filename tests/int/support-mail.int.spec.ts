import { afterEach, describe, expect, it, vi } from 'vitest'

import { devAgentDoorEnabled, devProbeEnabled } from '@/lib/dataverse/auth'
import { mailAllowed, mailAllowlist, sendMail } from '@/lib/support/mail'

/* 11-staging-readiness.md item 11: on a shared test host the portal writes only to the allowlist, and the development
   switches split so the customer side can run on the probe token while the probe sign-in door stays shut. */

const env = { ...process.env }
afterEach(() => {
  process.env = { ...env }
  vi.restoreAllMocks()
})

describe('SUPPORT_MAIL_ALLOWLIST', () => {
  it('is null when unset or blank, and then allows everyone', () => {
    expect(mailAllowlist('')).toBeNull()
    expect(mailAllowlist('  ')).toBeNull()
    expect(mailAllowed('anyone@example.com', null)).toBe(true)
  })
  it('reads addresses and domains, separated by commas, spaces or semicolons, case-insensitively', () => {
    expect(mailAllowlist('Priya@K7computing.com, @k7support.onmicrosoft.com example.org;')).toEqual(['priya@k7computing.com', '@k7support.onmicrosoft.com', '@example.org'])
  })
  it('matches an exact address or a whole domain, never a subdomain or a look-alike', () => {
    const allow = mailAllowlist('priya@k7computing.com @example.org')!
    expect(mailAllowed('PRIYA@k7computing.com', allow)).toBe(true)
    expect(mailAllowed('raman@k7computing.com', allow)).toBe(false)
    expect(mailAllowed('anyone@example.org', allow)).toBe(true)
    expect(mailAllowed('Any One <anyone@example.org>', allow)).toBe(true)
    expect(mailAllowed('anyone@mail.example.org', allow)).toBe(false)
    expect(mailAllowed('anyone@example.org.evil.com', allow)).toBe(false)
    expect(mailAllowed('not-an-address', allow)).toBe(false)
  })
})

describe('sendMail under the allowlist (no SMTP_URL: nothing leaves the process)', () => {
  it('reports the suppressed recipients and keeps the allowed ones', async () => {
    delete process.env.SMTP_URL
    process.env.SUPPORT_MAIL_ALLOWLIST = '@k7computing.com'
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await sendMail({ to: 'lead@k7computing.com, customer@gmail.com', subject: 'x', text: 'y' })
    expect(r).toEqual({ sent: false, suppressed: ['customer@gmail.com'] })
    expect(log.mock.calls.some(([line]) => String(line).includes('suppressed by SUPPORT_MAIL_ALLOWLIST') && String(line).includes('customer@gmail.com'))).toBe(true)
    expect(log.mock.calls.some(([line]) => String(line).includes('[support mail → lead@k7computing.com]'))).toBe(true)
  })
  it('does not log the body when every recipient is suppressed', async () => {
    delete process.env.SMTP_URL
    process.env.SUPPORT_MAIL_ALLOWLIST = 'tester@k7computing.com'
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await sendMail({ to: 'customer@gmail.com', subject: 'Your code', text: 'SECRET-BODY' })
    expect(r).toEqual({ sent: false, suppressed: ['customer@gmail.com'] })
    expect(log.mock.calls.some(([line]) => String(line).includes('SECRET-BODY'))).toBe(false)
  })
  it('is unchanged without an allowlist', async () => {
    delete process.env.SMTP_URL
    delete process.env.SUPPORT_MAIL_ALLOWLIST
    vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(await sendMail({ to: 'customer@gmail.com', subject: 'x', text: 'y' })).toEqual({ sent: false })
  })
})

describe('the development switches', () => {
  it('SUPPORT_DEV_SERVICE=probe allows the probe token without opening the sign-in door', () => {
    delete process.env.SUPPORT_DEV_AGENT
    process.env.SUPPORT_DEV_SERVICE = 'probe'
    expect(devProbeEnabled()).toBe(true)
    expect(devAgentDoorEnabled()).toBe(false)
  })
  it('SUPPORT_DEV_AGENT=probe does both', () => {
    process.env.SUPPORT_DEV_AGENT = 'probe'
    delete process.env.SUPPORT_DEV_SERVICE
    expect(devProbeEnabled()).toBe(true)
    expect(devAgentDoorEnabled()).toBe(true)
  })
  it('neither is on without a switch', () => {
    delete process.env.SUPPORT_DEV_AGENT
    delete process.env.SUPPORT_DEV_SERVICE
    expect(devProbeEnabled()).toBe(false)
    expect(devAgentDoorEnabled()).toBe(false)
  })
})
