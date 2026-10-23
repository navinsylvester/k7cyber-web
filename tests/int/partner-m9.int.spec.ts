import { describe, expect, it } from 'vitest'

import { cronAuthorised, cronSecretUsable } from '@/lib/cron-auth'
import { conflictsAmong, customerKey, emailDomain, type ConflictCandidate } from '@/lib/partner/deals-model'
import { FEATURE_OF } from '@/lib/partner/mirror'
import { ageText, cadenceText, DRAFT_RETENTION_DAYS, JOB_RUN_RETENTION_DAYS, JOBS, jobStanding, overallLevel, overdueAfterMinutes, readinessChecks, summariseResult, type ReadinessEnv } from '@/lib/partner/ops-model'
import { canMoveUser, USER_STATUSES } from '@/lib/partner/organisation-model'
import { finalValue, standing, type Slab } from '@/lib/partner/schemes-model'
import { inScope, orgRel, orgWhere, ScopeError } from '@/lib/partner/scope'
import { CRM_FEATURES, crmFeatureOn, DEFAULT_PARTNER_SETTINGS, normalisePartnerSettings } from '@/lib/partner/settings-model'
import { APPLICATION_STATUSES, canDecideDeal, canMoveApplication, canMoveDeal, canMoveOrg, DEAL_STATUSES, decisionPath, isClosedDeal, isDecided, LIVE_DEAL_STATUSES, OPEN_DEAL_STATUSES, ORG_STATUSES, PROTECTED_DEAL_STATUSES } from '@/lib/partner/status'
import { canSend, canSendFrom, clientKey } from '@/lib/support/otp'

/* M9 hardening (docs/partner-portal/02-build-plan.md §6): every status machine as a full matrix, so an edge added by
   accident fails here; the scope rule's corners; the scheduled routes' door; the code limiter; the go-live switches; the
   readiness checks over made-up environments; the conflict matcher and the eligibility maths over anonymised fixtures. */

/* ---------- The status machines, as full matrices ---------- */

const matrix = <S extends string>(all: readonly S[], can: (a: S, b: S) => boolean): Record<S, S[]> => Object.fromEntries(all.map((a) => [a, all.filter((b) => can(a, b))])) as Record<S, S[]>

describe('the application machine, every pair (01-requirements.md §3.2)', () => {
  it('has exactly these edges and no other', () => {
    expect(matrix(APPLICATION_STATUSES, canMoveApplication)).toEqual({
      draft: ['submitted'],
      submitted: ['underReview'],
      underReview: ['clarification', 'approved', 'rejected'],
      clarification: ['submitted'],
      approved: [],
      rejected: [],
    })
  })
  it('a decision is only ever two moves long, and only from the two states that hold it', () => {
    for (const from of APPLICATION_STATUSES) {
      for (const d of ['approve', 'reject', 'clarify'] as const) {
        const path = decisionPath(from, d)
        expect(path.length).toBeLessThanOrEqual(2)
        expect(path.length > 0).toBe(from === 'submitted' || from === 'underReview')
        if (path.length === 2) expect(path[0]).toBe('underReview')
      }
    }
    expect(APPLICATION_STATUSES.filter(isDecided)).toEqual(['approved', 'rejected'])
  })
})

describe('the deal machine, every pair (01-requirements.md §7.2)', () => {
  it('has exactly these edges and no other', () => {
    expect(matrix(DEAL_STATUSES, canMoveDeal)).toEqual({
      submitted: ['infoRequested', 'approved', 'rejected', 'withdrawn'],
      infoRequested: ['submitted', 'withdrawn'],
      approved: ['extensionRequested', 'expired', 'withdrawn'],
      rejected: [],
      extensionRequested: ['approved', 'expired', 'withdrawn'],
      expired: [],
      withdrawn: [],
    })
  })
  it('the four decisions are taken on a submitted deal only', () => {
    for (const from of DEAL_STATUSES) for (const d of ['approve', 'approveWithChanges', 'requestInfo', 'reject'] as const) expect(canDecideDeal(from, d)).toBe(from === 'submitted')
  })
  it('the state sets partition the machine the way the queue, the conflict check and the protection need', () => {
    const closed = DEAL_STATUSES.filter(isClosedDeal)
    expect(closed).toEqual(['rejected', 'expired', 'withdrawn'])
    expect([...LIVE_DEAL_STATUSES, ...closed].sort()).toEqual([...DEAL_STATUSES].sort())
    for (const s of OPEN_DEAL_STATUSES) expect(LIVE_DEAL_STATUSES).toContain(s)
    for (const s of PROTECTED_DEAL_STATUSES) expect(LIVE_DEAL_STATUSES).toContain(s)
    for (const s of closed) expect(Object.values(matrix(DEAL_STATUSES, canMoveDeal)[s])).toEqual([])
  })
})

describe('the people and the organisation, every pair', () => {
  it('a user moves invited → active | disabled, active → disabled, disabled → active | invited', () => {
    expect(matrix(USER_STATUSES, canMoveUser)).toEqual({ invited: ['active', 'disabled'], active: ['disabled'], disabled: ['invited', 'active'] })
  })
  it('an organisation only toggles', () => {
    expect(matrix(ORG_STATUSES, canMoveOrg)).toEqual({ approved: ['suspended'], suspended: ['approved'] })
  })
})

/* ---------- The scope rule's corners (FR-ROLE-01) ---------- */

describe('the organisation scope, corners', () => {
  it('puts the organisation first on either field and refuses blanks of every kind', () => {
    expect(orgWhere({ orgId: '7' })).toEqual({ org: { equals: '7' } })
    expect(orgWhere({ orgId: '7' }, { status: { equals: 'x' } }, 'orgId')).toEqual({ and: [{ orgId: { equals: '7' } }, { status: { equals: 'x' } }] })
    for (const bad of [{ orgId: '' }, { orgId: '   ' }, { orgId: 7 as unknown as string }, null as unknown as { orgId: string }, undefined as unknown as { orgId: string }]) expect(() => orgWhere(bad)).toThrow(ScopeError)
  })
  it('inScope accepts the populated relation and the bare id, and nothing else', () => {
    const scope = { orgId: '12' }
    expect(inScope(scope, { org: { id: 12 } })).toBe(true)
    expect(inScope(scope, { org: '12' })).toBe(true)
    expect(inScope(scope, { orgId: '12' })).toBe(true)
    expect(inScope(scope, { org: { id: 13 } })).toBe(false)
    expect(inScope(scope, { org: null })).toBe(false)
    expect(inScope(scope, {})).toBe(false)
    expect(inScope(scope, null)).toBe(false)
    expect(inScope({ orgId: '' }, { orgId: '' })).toBe(false)
  })
  it('orgRel gives Postgres its number and keeps a text id as text', () => {
    expect(orgRel({ orgId: '12' })).toBe(12)
    expect(orgRel({ orgId: 'abc' })).toBe('abc')
  })
})

/* ---------- The scheduled routes' door ---------- */

describe('the cron door', () => {
  const req = (auth?: string) => ({ headers: { get: (n: string) => (n === 'authorization' ? (auth ?? null) : null) } })
  const secret = 'a-secret-of-sixteen-plus'
  it('opens for the exact bearer and nothing else', () => {
    expect(cronAuthorised(req(`Bearer ${secret}`), secret)).toBe(true)
    expect(cronAuthorised(req(`bearer ${secret}`), secret)).toBe(false)
    expect(cronAuthorised(req(`Bearer ${secret}x`), secret)).toBe(false)
    expect(cronAuthorised(req(`Bearer ${secret.slice(0, -1)}`), secret)).toBe(false)
    expect(cronAuthorised(req(secret), secret)).toBe(false)
    expect(cronAuthorised(req(), secret)).toBe(false)
  })
  it('an unset or short secret opens nothing, even when matched', () => {
    expect(cronSecretUsable('')).toBe(false)
    expect(cronSecretUsable('short')).toBe(false)
    expect(cronSecretUsable(secret)).toBe(true)
    expect(cronAuthorised(req('Bearer short'), 'short')).toBe(false)
    expect(cronAuthorised(req('Bearer '), '')).toBe(false)
    expect(cronAuthorised(req('Bearer undefined'), '')).toBe(false)
  })
})

/* ---------- The code limiter ---------- */

describe('the code limiter', () => {
  it('counts per address and per client in separate windows that slide', () => {
    const t0 = Date.now()
    const addr = `m9-${t0}@example.in`
    for (let i = 0; i < 5; i++) expect(canSend(addr, 5, t0 + i)).toBe(true)
    expect(canSend(addr, 5, t0 + 6)).toBe(false)
    expect(canSend(addr, 5, t0 + 15 * 60 * 1000 + 1)).toBe(true)
    const client = `10.0.0.${t0 % 255}-${t0}`
    for (let i = 0; i < 30; i++) expect(canSendFrom(client, 30, t0 + i)).toBe(true)
    expect(canSendFrom(client, 30, t0 + 31)).toBe(false)
    expect(canSend(`other-${t0}@example.in`, 5, t0)).toBe(true)
  })
  it('keys a client by the first forwarded hop, then x-real-ip, else "direct", and keeps the key tame', () => {
    const h = (m: Record<string, string>) => ({ get: (n: string) => m[n] ?? null })
    expect(clientKey(h({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9')
    expect(clientKey(h({ 'x-real-ip': '2001:DB8::1' }))).toBe('2001:db8::1')
    expect(clientKey(h({}))).toBe('direct')
    expect(clientKey(h({ 'x-forwarded-for': '<script>' }))).toBe('script')
    expect(clientKey(h({ 'x-forwarded-for': 'x'.repeat(200) })).length).toBe(64)
  })
})

/* ---------- The go-live switches ---------- */

describe('the CRM feature switches (the go-live gate)', () => {
  it('default on under the master, and the normaliser repairs each one on its own', () => {
    expect(DEFAULT_PARTNER_SETTINGS.crm.features).toEqual({ accountCreate: true, opportunityCreate: true, sync: true })
    const s = normalisePartnerSettings({ crm: { enabled: true, features: { accountCreate: false, sync: 'yes' } } })
    expect(s.crm.features).toEqual({ accountCreate: false, opportunityCreate: true, sync: true })
    expect(normalisePartnerSettings({ crm: { features: null } }).crm.features).toEqual(DEFAULT_PARTNER_SETTINGS.crm.features)
  })
  it('a feature is on only with the master on', () => {
    const off = normalisePartnerSettings({ crm: { enabled: false } })
    const on = normalisePartnerSettings({ crm: { enabled: true, features: { opportunityCreate: false } } })
    for (const f of CRM_FEATURES) expect(crmFeatureOn(off, f)).toBe(false)
    expect(crmFeatureOn(on, 'accountCreate')).toBe(true)
    expect(crmFeatureOn(on, 'opportunityCreate')).toBe(false)
    expect(crmFeatureOn(on, 'sync')).toBe(true)
  })
  it('every outbox kind sits behind a switch', () => {
    expect(FEATURE_OF).toEqual({ 'account.create': 'accountCreate', 'opportunity.create': 'opportunityCreate' })
  })
})

/* ---------- Operations ---------- */

describe('the jobs catalogue and a job’s standing', () => {
  it('names every route once with a cadence, and the words for cadence and age read', () => {
    expect(new Set(JOBS.map((j) => j.route)).size).toBe(JOBS.length)
    expect(JOBS.every((j) => j.cadenceMinutes >= 15 && j.route.startsWith('/api/partners/'))).toBe(true)
    expect(cadenceText(15)).toBe('15 min')
    expect(cadenceText(60)).toBe('1 hour')
    expect(cadenceText(24 * 60)).toBe('1 day')
    expect(cadenceText(48 * 60)).toBe('2 days')
    expect(ageText(5)).toBe('5 min')
    expect(ageText(125)).toBe('2 h 05 min')
    expect(ageText(3 * 24 * 60)).toBe('3 d')
  })
  it('never run · running · failed · overdue after twice the cadence, two hours at least', () => {
    const spec = JOBS.find((j) => j.key === 'outbox')!
    const now = new Date('2026-10-23T12:00:00Z')
    expect(overdueAfterMinutes(spec)).toBe(120)
    expect(overdueAfterMinutes(JOBS.find((j) => j.key === 'digest')!)).toBe(48 * 60)
    const run = (minutesAgo: number, ok = true) => ({ id: '1', job: 'outbox' as const, trigger: 'cron' as const, ok, at: new Date(now.getTime() - minutesAgo * 60_000).toISOString(), durationMs: 10, summary: '1 ran', actor: '' })
    expect(jobStanding(spec, null, now).state).toBe('never')
    expect(jobStanding(spec, run(10), now).state).toBe('ok')
    expect(jobStanding(spec, run(10, false), now).state).toBe('failed')
    expect(jobStanding(spec, run(121), now).state).toBe('overdue')
    expect(jobStanding(spec, run(121, false), now).state).toBe('overdue')
  })
  it('summarises each job’s result in one line', () => {
    expect(summariseResult('outbox', { ran: 2, done: 1, failed: 1, skipped: 0, pending: 3, lines: [] })).toBe('2 ran · 1 done · 1 failed · 0 skipped · 3 waiting')
    expect(summariseResult('outbox', { ran: 0, lines: ['The CRM mirror is off in the partner settings; nothing was written.'] })).toMatch(/mirror is off/)
    expect(summariseResult('sync', { skipped: 'Last run x' })).toBe('skipped: Last run x')
    expect(summariseResult('sync', { scanned: 4, fetched: 4, changed: 1, missing: 0, errors: [] })).toBe('4 deals · 4 read · 1 changed · 0 missing · 0 errors')
    expect(summariseResult('dealsSweep', { expired: ['a'], noticed: [], errors: [] })).toBe('1 expired · 0 told of the end')
    expect(summariseResult('slaSweep', { checked: 3, breached: 1, noticed: ['x'], errors: ['e'] })).toBe('3 on the clock · 1 past the target · 1 notices · 1 errors')
    expect(summariseResult('digest', { mails: 2, rows: 5, removed: 1, errors: [] })).toBe('2 emails · 5 rows · 1 read rows removed')
    expect(summariseResult('schemesRun', { schemes: ['s'], errors: [] })).toBe('1 schemes computed')
    expect(summariseResult('housekeeping', { drafts: 3, jobRuns: 0, errors: [] })).toBe('3 drafts removed · 0 old job runs removed')
    expect(summariseResult('housekeeping', undefined)).toBe('0 drafts removed · 0 old job runs removed')
  })
})

describe('the readiness checks', () => {
  const dev: ReadinessEnv = {
    production: false,
    portalEnabled: true,
    authSecretLength: 44,
    cronSecretUsable: true,
    databaseUrl: true,
    smtp: false,
    allowlist: false,
    showCode: true,
    devAgentDoor: true,
    devServiceProbe: true,
    dataverseUrl: 'https://k7crmuat.crm8.dynamics.com',
    serviceConfigured: false,
    writesEnabled: true,
    crm: { enabled: true, features: { accountCreate: true, opportunityCreate: true, sync: true } },
    devStaffPass: true,
    dirs: [{ label: 'collateral', path: '/x/uploads/collateral', exists: true, writable: true }],
  }
  const level = (checks: ReturnType<typeof readinessChecks>, key: string) => checks.find((c) => c.key === key)?.level
  it('a development laptop is ready with notes, never failing', () => {
    const c = readinessChecks(dev)
    expect(overallLevel(c)).toBe('warn')
    expect(level(c, 'smtp')).toBe('warn')
    expect(level(c, 'devDoors')).toBe('warn')
    expect(level(c, 'service')).toBe('warn')
    expect(level(c, 'dataverse')).toBe('ok')
    expect(c.filter((x) => x.level === 'fail')).toEqual([])
  })
  it('the same laptop settings in production fail where they must', () => {
    const c = readinessChecks({ ...dev, production: true, portalEnabled: false })
    expect(overallLevel(c)).toBe('fail')
    expect(c.filter((x) => x.level === 'fail').map((x) => x.key).sort()).toEqual(['devDoors', 'portal', 'service', 'showCode', 'smtp'])
  })
  it('a staging host is ready: SMTP, the allowlist noted, the service identity, UAT writes', () => {
    const c = readinessChecks({ ...dev, production: true, smtp: true, allowlist: true, showCode: false, devAgentDoor: false, devServiceProbe: false, serviceConfigured: true })
    expect(overallLevel(c)).toBe('warn')
    expect(c.filter((x) => x.level === 'warn').map((x) => x.key)).toEqual(['allowlist'])
  })
  it('the production CRM host is a note while writes are expected, the missing secrets and directories fail', () => {
    const c = readinessChecks({ ...dev, production: true, smtp: true, showCode: false, devAgentDoor: false, devServiceProbe: false, serviceConfigured: true, dataverseUrl: 'https://k7crm.crm8.dynamics.com', writesEnabled: false, dirs: [{ label: 'collateral', path: '/x', exists: true, writable: false }, { label: 'deal files', path: '/y', exists: false, writable: false }] })
    expect(level(c, 'dataverse')).toBe('warn')
    expect(level(c, 'writes')).toBe('warn')
    expect(level(c, 'dir:collateral')).toBe('fail')
    expect(level(c, 'dir:deal files')).toBe('warn')
    const d = readinessChecks({ ...dev, authSecretLength: 10, cronSecretUsable: false, databaseUrl: false, dataverseUrl: '' })
    expect(d.filter((x) => x.level === 'fail').map((x) => x.key).sort()).toEqual(['authSecret', 'cronSecret', 'database', 'dataverse'])
  })
  it('with the mirror off the CRM lines collapse to one note and a missing host is not a failure', () => {
    const c = readinessChecks({ ...dev, crm: { ...dev.crm, enabled: false }, dataverseUrl: '' })
    expect(level(c, 'crm')).toBe('ok')
    expect(level(c, 'dataverse')).toBe('warn')
    expect(c.find((x) => x.key === 'service')).toBeUndefined()
  })
  it('the retention periods are what the runbook says', () => {
    expect(DRAFT_RETENTION_DAYS).toBe(30)
    expect(JOB_RUN_RETENTION_DAYS).toBe(90)
  })
})

/* ---------- Anonymised fixtures: the conflict matcher and the eligibility maths ---------- */

type Fixture = { id: string; dealId: string; org: string; status: ConflictCandidate['status']; customer: string; email: string; protectionEnds: string | null }
const now = new Date('2026-10-23T09:00:00Z')
const far = '2027-01-01T00:00:00.000Z'
/** Ten deals across four organisations, names and addresses invented. The expected matches are worked out by hand below. */
const FIXTURE: Fixture[] = [
  { id: 'a1', dealId: 'K7D-10001', org: 'K7P-00001', status: 'approved', customer: 'Meridian Textiles Pvt. Ltd.', email: 'cio@meridiantextiles.in', protectionEnds: far },
  { id: 'a2', dealId: 'K7D-10002', org: 'K7P-00001', status: 'submitted', customer: 'Harbour Logistics', email: 'it@harbourlogistics.com', protectionEnds: null },
  { id: 'b1', dealId: 'K7D-10003', org: 'K7P-00002', status: 'approved', customer: 'MERIDIAN TEXTILES PRIVATE LIMITED', email: 'procurement@meridiantextiles.in', protectionEnds: far },
  { id: 'b2', dealId: 'K7D-10004', org: 'K7P-00002', status: 'rejected', customer: 'Harbour Logistics Ltd', email: 'it@harbourlogistics.com', protectionEnds: null },
  { id: 'b3', dealId: 'K7D-10005', org: 'K7P-00002', status: 'approved', customer: 'Cedar & Pine Schools', email: 'admin@gmail.com', protectionEnds: far },
  { id: 'c1', dealId: 'K7D-10006', org: 'K7P-00003', status: 'approved', customer: 'Harbour Freight', email: 'ops@harbourlogistics.com', protectionEnds: far },
  { id: 'c2', dealId: 'K7D-10007', org: 'K7P-00003', status: 'expired', customer: 'Meridian Textiles', email: 'cio@meridiantextiles.in', protectionEnds: '2026-01-01T00:00:00.000Z' },
  { id: 'c3', dealId: 'K7D-10008', org: 'K7P-00003', status: 'approved', customer: 'Cedar and Pine Schools', email: 'principal@yahoo.com', protectionEnds: '2026-10-01T00:00:00.000Z' },
  { id: 'd1', dealId: 'K7D-10009', org: 'K7P-00004', status: 'infoRequested', customer: 'Lotus Dairy Co-operative', email: 'cio@meridiantextiles.in', protectionEnds: null },
  { id: 'd2', dealId: 'K7D-10010', org: 'K7P-00004', status: 'extensionRequested', customer: 'Northwind Pharma', email: 'sec@northwind.co.in', protectionEnds: far },
]
const cands = (): ConflictCandidate[] => FIXTURE.map((f) => ({ id: f.id, dealId: f.dealId, status: f.status, orgPartnerId: f.org, orgName: f.org, customerKey: customerKey(f.customer), emailDomain: emailDomain(f.email), protectionEnds: f.protectionEnds, customer: { name: f.customer, email: f.email } }))
const subjectOf = (f: Fixture) => ({ id: f.id, customerKey: customerKey(f.customer), emailDomain: emailDomain(f.email), customer: { email: f.email } })
const against = (id: string) => conflictsAmong(subjectOf(FIXTURE.find((f) => f.id === id)!), cands(), now).map((c) => `${c.dealId}:${c.matchedOn.join('+')}`).sort()

describe('the conflict matcher over the fixture', () => {
  it('Meridian: the other organisation’s live Meridian deal by name and domain, the one sharing the address by domain and email; the expired one is ignored', () => {
    expect(against('a1')).toEqual(['K7D-10003:name+domain', 'K7D-10009:domain+email'])
  })
  it('Harbour: the rejected twin is ignored; the freight company shares only the domain', () => {
    expect(against('a2')).toEqual(['K7D-10006:domain'])
  })
  it('Cedar & Pine: the name matches across "&" and "and", public mail domains never match, and protection that ran out is ignored', () => {
    expect(against('b3')).toEqual([])
    expect(against('c3')).toEqual(['K7D-10005:name'])
  })
  it('a submitted deal with no protection end still counts as live; a lone customer has no conflict', () => {
    expect(against('d1')).toEqual(['K7D-10001:domain+email', 'K7D-10003:domain'])
    expect(against('d2')).toEqual([])
  })
  it('every deal in the fixture is matched the same way the queue would see it: never with itself, never with a closed deal', () => {
    for (const f of FIXTURE) {
      const hits = conflictsAmong(subjectOf(f), cands(), now)
      expect(hits.some((h) => h.dealId === f.dealId)).toBe(false)
      expect(hits.every((h) => !['rejected', 'expired', 'withdrawn'].includes(FIXTURE.find((x) => x.dealId === h.dealId)!.status))).toBe(true)
    }
  })
})

describe('the eligibility maths over a slab fixture', () => {
  const slabs: Slab[] = [
    { threshold: 25_00_000, benefit: '3 % back-end rebate', amount: 75_000 },
    { threshold: 10_00_000, benefit: '2 % back-end rebate', amount: 20_000 },
    { threshold: 50_00_000, benefit: '5 % plus the summit seat', amount: 2_50_000 },
  ]
  const cases: { value: number; eligible: boolean; slabIndex: number; gap: number; share: number }[] = [
    { value: 0, eligible: false, slabIndex: -1, gap: 10_00_000, share: 0 },
    { value: 9_99_999, eligible: false, slabIndex: -1, gap: 1, share: 0.2 },
    { value: 10_00_000, eligible: true, slabIndex: 0, gap: 15_00_000, share: 0.2 },
    { value: 24_99_999, eligible: true, slabIndex: 0, gap: 1, share: 0.5 },
    { value: 25_00_000, eligible: true, slabIndex: 1, gap: 25_00_000, share: 0.5 },
    { value: 50_00_000, eligible: true, slabIndex: 2, gap: 0, share: 1 },
    { value: 1_00_00_000, eligible: true, slabIndex: 2, gap: 0, share: 1 },
  ]
  it('reads each value against the sorted slabs: the slab reached, the gap to the next or the target, the share of the top', () => {
    for (const c of cases) {
      const s = standing(slabs, c.value)
      expect({ eligible: s.eligible, slabIndex: s.slabIndex, gap: s.gap, share: Number(s.share.toFixed(4)) }).toEqual({ eligible: c.eligible, slabIndex: c.slabIndex, gap: c.gap, share: c.share })
      expect(s.target).toBe(10_00_000)
    }
    expect(standing(slabs, 25_00_000).slab?.amount).toBe(75_000)
    expect(standing([], 5).eligible).toBe(false)
  })
  it('an adjustment moves the final value, never below zero, and may move the slab', () => {
    expect(finalValue(26_00_000, -1_50_000)).toBe(24_50_000)
    expect(standing(slabs, finalValue(26_00_000, -1_50_000)).slabIndex).toBe(0)
    expect(finalValue(5, -10)).toBe(0)
    expect(finalValue(5, Number.NaN)).toBe(5)
  })
})
