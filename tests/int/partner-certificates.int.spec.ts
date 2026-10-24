// @vitest-environment node
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { renderCertificatePdf } from '@/lib/partner/certificate-pdf'
import {
  CERT_ALPHABET,
  CERT_NUMBER,
  certificateNumber,
  certificateState,
  currentOrgCertificate,
  daysToExpiry,
  DEFAULT_CERTIFICATE_SETTINGS,
  expiryFrom,
  isCurrent,
  kindOfNumber,
  normaliseCertificateSettings,
  orgMirror,
  parseCertificateNumber,
  parseReminderDays,
  readRule,
  reminderDue,
  ruleText,
  scoreBand,
  shouldIssueIndividual,
  toCertificate,
  verifyView,
  type Certificate,
} from '@/lib/partner/certificates-model'
import { EVENT_KEYS, EVENTS } from '@/lib/partner/notify-model'
import { JOBS, summariseResult } from '@/lib/partner/ops-model'
import { normalisePartnerSettings } from '@/lib/partner/settings-model'
import { courseStanding, TEST_STATE_LABEL, type Attempt, type Course, type Module, type Progress } from '@/lib/partner/training-model'

/* Certificates without a tenant (docs/partner-portal/04-portal-guide.md M11): the numbers (FR-TRN-07, FR-CRT-03), the score
   band, the expiry maths and the state today (FR-TRN-10, FR-CRT-05), when a pass earns a certificate and when a retake does
   not, the reminders once per threshold (FR-CRT-06), the rule per partner type (FR-CRT-01), the organisation's mirror the deal
   gate reads, the public view's minimum (FR-TRN-09), the recertify standing, the settings, the events and the job, and the PDF
   itself (both kinds, with the embedded fonts and the QR). */

const NOW = new Date('2026-10-24T10:00:00.000Z')
const iso = (d: string) => new Date(d).toISOString()
const cert = (over: Partial<Certificate> = {}): Certificate => ({
  id: '1',
  number: 'K7P-C-7KQ2MX',
  kind: 'individual',
  status: 'valid',
  orgId: '10',
  orgName: 'Example Systems Private Limited',
  orgTradeName: 'Example Systems',
  orgPartnerId: 'K7P-00042',
  orgType: 'var',
  userId: 'u1',
  userName: 'Asha Menon',
  userEmail: 'asha@example.com',
  courseId: 'c1',
  courseTitle: 'Selling the new product',
  courseVersion: 2,
  trackKey: 'sales',
  trackName: 'Sales',
  attemptId: 'a1',
  score: 90,
  band: 'Merit',
  issuedAt: iso('2026-01-15T09:00:00Z'),
  expiresAt: iso('2027-01-15T23:59:59Z'),
  requestedAt: null,
  ruleLines: [],
  issuedBy: 'Portal',
  declinedAt: null,
  declinedReason: '',
  revokedAt: null,
  revokedReason: '',
  revokedBy: '',
  supersededBy: '',
  renewalOf: '',
  reminded: {},
  fileId: '',
  createdAt: iso('2026-01-15T09:00:00Z'),
  updatedAt: iso('2026-01-15T09:00:00Z'),
  ...over,
})
const S = DEFAULT_CERTIFICATE_SETTINGS

describe('numbers (decision 12)', () => {
  it('makes K7P-C- and K7P-O- numbers of six symbols from the alphabet, from the bytes given', () => {
    const bytes = new Uint8Array([0, 1, 29, 30, 255, 7, 9, 9])
    const n = certificateNumber('individual', bytes)
    expect(n).toMatch(CERT_NUMBER)
    expect(n.startsWith('K7P-C-')).toBe(true)
    expect(n.slice(6)).toBe(`${CERT_ALPHABET[0]}${CERT_ALPHABET[1]}${CERT_ALPHABET[29]}${CERT_ALPHABET[0]}${CERT_ALPHABET[255 % 30]}${CERT_ALPHABET[7]}`)
    expect(certificateNumber('org', bytes).startsWith('K7P-O-')).toBe(true)
    expect(() => certificateNumber('org', new Uint8Array(3))).toThrow()
    expect(CERT_ALPHABET).not.toMatch(/[0OI1LU]/)
    expect(kindOfNumber('K7P-O-ABCDEF')).toBe('org')
    expect(kindOfNumber('K7P-C-ABCDEF')).toBe('individual')
    expect(kindOfNumber('K7D-00001')).toBeNull()
  })
  it('reads a typed or scanned number: case, spaces and dashes forgiven, the prefix optional, look-alikes refused', () => {
    expect(parseCertificateNumber(' k7p-c-7kq2mx ')).toBe('K7P-C-7KQ2MX')
    expect(parseCertificateNumber('C-7KQ2MX')).toBe('K7P-C-7KQ2MX')
    expect(parseCertificateNumber('K7P C 7KQ 2MX')).toBe('K7P-C-7KQ2MX')
    expect(parseCertificateNumber('K7P–O–ABCDEF')).toBe('K7P-O-ABCDEF')
    expect(parseCertificateNumber('K7P-C-7KQ2M0')).toBeNull()
    expect(parseCertificateNumber('K7P-C-7KQ2')).toBeNull()
    expect(parseCertificateNumber('K7P-X-7KQ2MX')).toBeNull()
    expect(parseCertificateNumber('')).toBeNull()
  })
})

describe('the band, the expiry and the state (FR-TRN-07, 10; FR-CRT-05)', () => {
  it('bands the score at the configured marks', () => {
    expect(scoreBand(70, S)).toBe('Pass')
    expect(scoreBand(84, S)).toBe('Pass')
    expect(scoreBand(85, S)).toBe('Merit')
    expect(scoreBand(95, S)).toBe('Distinction')
    expect(scoreBand(100, { meritFrom: 50, distinctionFrom: 50 })).toBe('Distinction')
  })
  it('expires the same day of the month at the end of the day, pulling a 31st back to the month’s last day', () => {
    expect(expiryFrom('2026-10-24T10:00:00Z', 12)).toBe('2027-10-24T23:59:59.000Z')
    expect(expiryFrom('2026-01-31T10:00:00Z', 1)).toBe('2026-02-28T23:59:59.000Z')
    expect(expiryFrom('2026-08-31T10:00:00Z', 6)).toBe('2027-02-28T23:59:59.000Z')
    expect(expiryFrom('2026-10-24T10:00:00Z', 0)).toBe('2026-11-24T23:59:59.000Z')
  })
  it('reads valid, expiring inside the first reminder window, expired past the date, and the other statuses as they are', () => {
    expect(certificateState(cert(), S.reminderDays, NOW)).toBe('valid')
    expect(certificateState(cert({ expiresAt: iso('2026-12-20T23:59:59Z') }), S.reminderDays, NOW)).toBe('expiring')
    expect(certificateState(cert({ expiresAt: iso('2026-10-23T23:59:59Z') }), S.reminderDays, NOW)).toBe('expired')
    expect(certificateState(cert({ status: 'revoked' }), S.reminderDays, NOW)).toBe('revoked')
    expect(certificateState(cert({ status: 'requested', expiresAt: null }), S.reminderDays, NOW)).toBe('requested')
    expect(certificateState(cert({ status: 'superseded' }), S.reminderDays, NOW)).toBe('superseded')
    expect(daysToExpiry(cert({ expiresAt: iso('2026-10-30T23:59:59Z') }), NOW)).toBe(7)
    expect(isCurrent(cert(), NOW)).toBe(true)
    expect(isCurrent(cert({ expiresAt: iso('2026-12-20T23:59:59Z') }), NOW)).toBe(true)
    expect(isCurrent(cert({ expiresAt: iso('2026-10-01T23:59:59Z') }), NOW)).toBe(false)
    expect(isCurrent(cert({ status: 'revoked' }), NOW)).toBe(false)
  })
  it('issues on the first pass, not on a retake while the certificate stands outside the window, and supersedes inside it or after expiry', () => {
    expect(shouldIssueIndividual([], 'c1', S.reminderDays, NOW)).toEqual({ issue: true, supersede: false })
    expect(shouldIssueIndividual([cert()], 'c1', S.reminderDays, NOW)).toEqual({ issue: false, supersede: false })
    expect(shouldIssueIndividual([cert()], 'c2', S.reminderDays, NOW)).toEqual({ issue: true, supersede: false })
    expect(shouldIssueIndividual([cert({ expiresAt: iso('2026-11-30T23:59:59Z') })], 'c1', S.reminderDays, NOW)).toEqual({ issue: true, supersede: true })
    expect(shouldIssueIndividual([cert({ expiresAt: iso('2026-09-30T23:59:59Z') })], 'c1', S.reminderDays, NOW)).toEqual({ issue: true, supersede: false })
    expect(shouldIssueIndividual([cert({ status: 'revoked' })], 'c1', S.reminderDays, NOW)).toEqual({ issue: true, supersede: false })
  })
  it('owes one reminder per threshold, the nearest first, and none once sent or outside the windows', () => {
    const in45 = cert({ expiresAt: iso('2026-12-08T23:59:59Z') })
    expect(reminderDue(in45, S.reminderDays, NOW)).toBe(60)
    expect(reminderDue({ ...in45, reminded: { '60': 'x' } }, S.reminderDays, NOW)).toBeNull()
    const in20 = cert({ expiresAt: iso('2026-11-13T23:59:59Z') })
    expect(reminderDue(in20, S.reminderDays, NOW)).toBe(30)
    expect(reminderDue({ ...in20, reminded: { '30': 'x' } }, S.reminderDays, NOW)).toBe(60)
    expect(reminderDue({ ...in20, reminded: { '30': 'x', '60': 'x' } }, S.reminderDays, NOW)).toBeNull()
    expect(reminderDue(cert(), S.reminderDays, NOW)).toBeNull()
    expect(reminderDue(cert({ status: 'expired' }), S.reminderDays, NOW)).toBeNull()
  })
})

describe('the rule per partner type and the organisation’s standing (FR-CRT-01, 02, 05)', () => {
  const people = [
    cert({ id: '1', userId: 'u1', trackKey: 'sales' }),
    cert({ id: '2', userId: 'u1', trackKey: 'sales', courseId: 'c9' }), // the same person twice counts once
    cert({ id: '3', userId: 'u2', trackKey: 'technical' }),
    cert({ id: '4', userId: 'u3', trackKey: 'technical', status: 'revoked' }), // counts for nothing
    cert({ id: '5', userId: 'u4', trackKey: 'technical', expiresAt: iso('2026-09-01T23:59:59Z') }), // expired
  ]
  it('counts distinct people with a current certificate per track against the type’s rule', () => {
    const r = readRule('var', S, people, { sales: 'Sales', technical: 'Technical' }, NOW)
    expect(r).toEqual({ configured: true, met: true, lines: [{ track: 'sales', trackName: 'Sales', need: 1, have: 1 }, { track: 'technical', trackName: 'Technical', need: 1, have: 1 }] })
    const strict = readRule('var', { rules: [{ type: 'var', track: 'sales', people: 1 }, { type: 'var', track: 'technical', people: 2 }] }, people, {}, NOW)
    expect(strict.met).toBe(false)
    expect(strict.lines[1]).toMatchObject({ need: 2, have: 1, trackName: 'Technical' })
    expect(ruleText(strict)).toBe('1 of 1 on Sales · 1 of 2 on Technical')
    expect(readRule('msp', { rules: [{ type: 'var', track: 'sales', people: 1 }] }, people, {}, NOW)).toEqual({ configured: false, met: false, lines: [] })
    expect(ruleText(readRule('', S, [], {}, NOW))).toMatch(/No rule/)
  })
  it('names the organisation’s current certificate (a request first) and the mirror the deal gate reads', () => {
    const o = (over: Partial<Certificate>) => cert({ kind: 'org', number: 'K7P-O-ABCDEF', ...over })
    expect(currentOrgCertificate([])).toBeNull()
    const old = o({ id: '7', issuedAt: iso('2025-01-01T00:00:00Z'), expiresAt: iso('2026-01-01T23:59:59Z'), status: 'expired' })
    const req = o({ id: '8', status: 'requested', issuedAt: null, expiresAt: null, requestedAt: iso('2026-10-01T00:00:00Z') })
    expect(currentOrgCertificate([old, req])?.id).toBe('8')
    expect(orgMirror([old, req], NOW)).toEqual({ status: 'expired', until: old.expiresAt })
    const live = o({ id: '9', issuedAt: iso('2026-10-02T00:00:00Z'), expiresAt: iso('2027-10-02T23:59:59Z') })
    expect(orgMirror([old, live], NOW)).toEqual({ status: 'valid', until: live.expiresAt })
    expect(orgMirror([old, { ...live, status: 'revoked' }], NOW)).toEqual({ status: 'revoked', until: live.expiresAt })
    expect(orgMirror([old, { ...live, expiresAt: iso('2026-10-20T23:59:59Z') }], NOW)).toEqual({ status: 'expired', until: iso('2026-10-20T23:59:59Z') })
    expect(orgMirror([o({ status: 'declined', issuedAt: null })], NOW)).toEqual({ status: 'none', until: null })
  })
})

describe('the public view (FR-TRN-09, FR-CRT-07)', () => {
  it('shows the holder, the organisation, the course and the dates, and nothing else', () => {
    const v = verifyView(cert(), S.reminderDays, NOW)!
    expect(v).toEqual({ number: 'K7P-C-7KQ2MX', kind: 'individual', state: 'valid', genuine: true, holder: 'Asha Menon', organisation: 'Example Systems', partnerId: 'K7P-00042', about: 'Selling the new product · Sales track', issuedAt: cert().issuedAt, expiresAt: cert().expiresAt, revokedAt: null })
    expect(JSON.stringify(v)).not.toMatch(/asha@|Merit|90/)
    const r = verifyView(cert({ status: 'revoked', revokedAt: iso('2026-05-05T00:00:00Z'), revokedReason: 'Fraud' }), S.reminderDays, NOW)!
    expect(r.state).toBe('revoked')
    expect(r.revokedAt).toBe(iso('2026-05-05T00:00:00Z'))
    expect(JSON.stringify(r)).not.toMatch(/Fraud/)
    expect(verifyView(cert({ kind: 'org', status: 'requested', issuedAt: null }), S.reminderDays, NOW)).toBeNull()
    expect(verifyView(cert({ kind: 'org', status: 'declined' }), S.reminderDays, NOW)).toBeNull()
    expect(verifyView(cert({ kind: 'org', number: 'K7P-O-ABCDEF' }), S.reminderDays, NOW)).toMatchObject({ kind: 'org', holder: 'Example Systems Private Limited', about: 'K7 Partner Programme' })
  })
})

describe('the recertify standing (FR-TRN-10)', () => {
  const course: Course = { id: '1', trackId: '1', trackName: 'Sales', title: 'Selling', description: '', order: 10, status: 'published', version: 1, passMark: null, timeLimitMinutes: null, questionsPerTest: null, showAnswers: 'default', requiredShare: null, publishedAt: null, updatedAt: '' }
  const mod: Module = { id: 'm1', courseId: '1', title: 'M', order: 1, description: '', reading: '', video: { provider: 'url', src: 'https://x/v.mp4' }, durationSeconds: 100, requiredShare: null, attachments: [], status: 'published' }
  const prog: Progress = { id: 'p', userId: 'u', orgId: 'o', moduleId: 'm1', courseId: '1', courseVersion: 1, ranges: [], duration: 100, watched: 95, share: 0.95, lastPosition: 0, completedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
  const pass: Attempt = { id: 'a', userId: 'u', userName: 'U', orgId: 'o', courseId: '1', courseVersion: 1, status: 'submitted', startedAt: '2026-01-01T09:00:00.000Z', expiresAt: null, submittedAt: '2026-01-01T09:10:00.000Z', seed: 's', paper: [], answers: {}, score: 90, correct: 9, total: 10, passed: true, passMark: 70, showAnswers: true, createdAt: '' }
  const T = normalisePartnerSettings({}).training
  const rules = { passMark: 70, timeLimitMinutes: 20, questionsPerTest: 10, showAnswers: true, requiredShare: 0.9 }
  it('reads passed while the certificate stands, recertify once it is expiring, expired or revoked, and passed again when the modules are not complete', () => {
    expect(courseStanding(course, [mod], [prog], [pass], rules, 5, { state: 'valid', number: 'K7P-C-1', expiresAt: null, id: '1' }).test).toBe('passed')
    expect(courseStanding(course, [mod], [prog], [pass], rules, 5, null).test).toBe('passed')
    for (const state of ['expiring', 'expired', 'revoked'] as const) expect(courseStanding(course, [mod], [prog], [pass], rules, 5, { state, number: 'K7P-C-1', expiresAt: null, id: '1' }).test).toBe('recertify')
    expect(courseStanding(course, [mod], [prog], [pass], rules, 0, { state: 'expired', number: 'K7P-C-1', expiresAt: null, id: '1' }).test).toBe('passed')
    expect(TEST_STATE_LABEL.recertify).toBe('Recertify')
    expect(T.passMark).toBe(70)
  })
})

describe('settings, events and the job', () => {
  it('normalises the certificate settings with the defaults, the reminder days from a list or a text, and the rules per type', () => {
    const d = normalisePartnerSettings({}).certificates
    expect(d).toMatchObject({ validityMonths: 12, orgValidityMonths: 12, reminderDays: [60, 30], meritFrom: 85, distinctionFrom: 95, issuer: 'K7 Computing Private Limited' })
    expect(d.rules.filter((r) => r.type === 'var')).toEqual([{ type: 'var', track: 'sales', people: 1 }, { type: 'var', track: 'technical', people: 1 }])
    const c = normaliseCertificateSettings({ validityMonths: 24, reminderDays: [{ days: 30 }, { days: 90 }, { days: 30 }], meritFrom: 90, distinctionFrom: 80, rules: [{ type: 'var', track: 'Sales', people: 2 }, { type: 'nope', track: 'x', people: 1 }], signatoryName: ' J Kumar ' })
    expect(c.validityMonths).toBe(24)
    expect(c.reminderDays).toEqual([90, 30])
    expect(c.distinctionFrom).toBe(90)
    expect(c.rules).toEqual([{ type: 'var', track: 'sales', people: 2 }])
    expect(c.signatoryName).toBe('J Kumar')
    expect(parseReminderDays('60, 30, 7')).toEqual([60, 30, 7])
    expect(parseReminderDays('x')).toEqual([])
    expect(normaliseCertificateSettings({ rules: [] }).rules).toEqual(d.rules)
    expect(normaliseCertificateSettings({ rules: [{ type: 'var', track: 'sales', people: 0 }] }).rules).toEqual([{ type: 'var', track: 'sales', people: 0 }])
  })
  it('reads a raw row with its relations as ids or documents', () => {
    const c = toCertificate({ id: 5, number: 'K7P-O-ABCDEF', kind: 'org', status: 'requested', org: { id: 10, name: 'Org', partnerId: 'K7P-00010', type: 'distributor' }, ruleLines: [{ track: 'sales', trackName: 'Sales', need: 1, have: 1 }], reminded: { '60': 'x', bad: 1 }, score: null })
    expect(c).toMatchObject({ id: '5', kind: 'org', status: 'requested', orgId: '10', orgName: 'Org', orgPartnerId: 'K7P-00010', orgType: 'distributor', reminded: { '60': 'x' }, score: null, band: '' })
    expect(c.ruleLines).toEqual([{ track: 'sales', trackName: 'Sales', need: 1, have: 1 }])
  })
  it('lists the certificate events once each and the sweep as a scheduled job', () => {
    for (const k of ['training.certificate.issued', 'training.certificate.expiring', 'training.certificate.expired', 'training.certificate.revoked', 'org.certificate.requested', 'org.certificate.issued', 'org.certificate.declined', 'org.certificate.expiring', 'org.certificate.expired', 'org.certificate.revoked']) expect(EVENT_KEYS).toContain(k)
    expect(new Set(EVENT_KEYS).size).toBe(EVENTS.length)
    expect(EVENTS.find((e) => e.key === 'org.certificate.requested')?.audience).toBe('k7')
    expect(EVENTS.find((e) => e.key === 'training.certificate.issued')?.delivery).toBe('immediate')
    const job = JOBS.find((j) => j.key === 'certificatesSweep')!
    expect(job.route).toBe('/api/partners/certificates/sweep')
    expect(summariseResult('certificatesSweep', { checked: 12, expired: 1, reminded: 2, requested: 0, backfilled: 3, errors: [] })).toBe('12 checked · 1 expired · 2 reminded · 0 renewal requests')
  })
})

describe('the PDF (FR-TRN-07, FR-CRT-03)', () => {
  it('draws both kinds as one A4 landscape page with the embedded fonts, the number and the verification link', async () => {
    const ind = await renderCertificatePdf({ certificate: cert(), verifyUrl: 'https://www.k7computing.com/partners/verify/K7P-C-7KQ2MX', settings: S })
    expect(Buffer.from(ind.slice(0, 5)).toString()).toBe('%PDF-')
    expect(ind.byteLength).toBeGreaterThan(20_000)
    const back = await PDFDocument.load(ind)
    expect(back.getPageCount()).toBe(1)
    const { width, height } = back.getPage(0).getSize()
    expect([Math.round(width), Math.round(height)]).toEqual([842, 595])
    expect(back.getTitle()).toContain('K7P-C-7KQ2MX')
    const fonts = back.context.enumerateIndirectObjects().map(([, o]) => o.toString()).filter((x) => /\/BaseFont/.test(x)).join(' ')
    expect(fonts).toMatch(/Archivo/)
    expect(fonts).toMatch(/IBMPlexMono/)
    const org = await renderCertificatePdf({ certificate: cert({ kind: 'org', number: 'K7P-O-ABCDEF', ruleLines: [{ track: 'sales', trackName: 'Sales', need: 1, have: 2 }] }), verifyUrl: 'https://www.k7computing.com/partners/verify/K7P-O-ABCDEF', settings: { ...S, signatoryName: 'J Kumar', signatoryTitle: 'Head of Channels' } })
    expect(Buffer.from(org.slice(0, 5)).toString()).toBe('%PDF-')
    expect(org.byteLength).toBeGreaterThan(20_000)
    // Long names fit: the generator steps the size down and wraps the course title instead of running off the sheet.
    const long = await renderCertificatePdf({ certificate: cert({ userName: 'Venkatasubramanian Krishnamurthy Iyengar Ramachandran', courseTitle: 'A very long course title that goes on and on about selling the new product to every kind of customer in every region' }), verifyUrl: 'https://x/y', settings: S })
    expect(long.byteLength).toBeGreaterThan(20_000)
  })
})
