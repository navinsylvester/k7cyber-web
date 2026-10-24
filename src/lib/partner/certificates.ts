import 'server-only'
import configPromise from '@payload-config'
import { randomBytes } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { getPayload, type Where } from 'payload'

import { CERTIFICATE_DIR } from '@/collections/partner/PartnerCertificates'
import { getServerSideURL } from '@/utilities/getURL'

import { audit, SYSTEM, type Actor } from './audit'
import { renderCertificatePdf } from './certificate-pdf'
import {
  certificateFileName,
  certificateNumber,
  certificateState,
  currentOrgCertificate,
  expiryFrom,
  isCurrent,
  isPastExpiry,
  orgMirror,
  readRule,
  reminderDue,
  ruleText,
  scoreBand,
  shouldIssueIndividual,
  toCertificate,
  verifyView,
  type Certificate,
  type CertKind,
  type CertState,
  type RuleReading,
  type VerifyView,
} from './certificates-model'
import { notify, type Recipient } from './notify'
import { certVars } from './notify-model'
import { inScope, orgRel, orgWhere, type OrgScope } from './scope'
import type { K7Context, PartnerContext } from './session'
import { getPartnerSettings, type PartnerSettings } from './settings'
import { toAttempt, toCourse, toTrack, type Attempt, type Course, type Track } from './training-model'
import { loadPartnerUser, orgUsers, toOrg, type PartnerOrg, type PartnerUser } from './users'

/* Certificates on the server (01-requirements.md §4 FR-TRN-07–10, §5; M11). Individual: issued when a pass earns one
   (`issueForPass`, called by the test engine; `shouldIssueIndividual` says when a retake does not), the PDF rendered once and
   kept as a `partner-certificate-files` row, the participant told with the file attached. Organisation: when an issue makes
   the organisation meet its type's rule for the first time (or again after expiry), a request row goes to the Channel
   Managers; `issueOrgCertificate` turns it into the certificate, `declineOrgRequest` closes it. Both kinds can be revoked with
   a reason. The sweep (`sweepCertificates`, daily) expires, reminds, backfills passes that predate M11 and keeps the
   organisations' `certificate` mirror true, which is what the deal gate and the collateral rule read. The public page reads
   through `findForVerification`, which returns the minimum (FR-TRN-09). Nothing here touches Dynamics. */

export const PARTNER_CERTIFICATES = '/partners/portal/certificates'
export const K7_CERTIFICATES = '/partners/portal/k7/certificates'
export const VERIFY = '/partners/verify'

const db = () => getPayload({ config: configPromise })
type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const now = () => new Date().toISOString()
const who = (a: Actor): string => a.name || a.email || 'Portal'
const BIG = 5000

export const verifyUrlFor = (number: string): string => `${getServerSideURL()}${VERIFY}/${number}`
export const certificateHref = (c: Pick<Certificate, 'id'>): string => `${PARTNER_CERTIFICATES}/${c.id}`
export const k7CertificateHref = (c: Pick<Certificate, 'id'>): string => `${K7_CERTIFICATES}/${c.id}`

/* ---------- Reading ---------- */

const find = async (where: Where, o: { sort?: string; limit?: number } = {}): Promise<Certificate[]> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-certificates', where, limit: o.limit ?? BIG, depth: 0, sort: o.sort ?? '-createdAt', overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toCertificate)
}

/** Every certificate of an organisation, newest first, through the scope. */
export const certificatesOfOrg = (scope: OrgScope): Promise<Certificate[]> => find(orgWhere(scope))

/** One user's individual certificates, through the scope. */
export const certificatesOfUser = (scope: OrgScope, userId: string): Promise<Certificate[]> => find(orgWhere(scope, { and: [{ user: { equals: userId } }, { kind: { equals: 'individual' } }] }))

/** The current individual certificate per course for a user: the newest that is not superseded or declined. */
export const currentByCourse = (certs: Certificate[]): Map<string, Certificate> => {
  const out = new Map<string, Certificate>()
  for (const c of [...certs].filter((x) => x.kind === 'individual' && x.status !== 'superseded').sort((a, b) => (b.issuedAt ?? b.createdAt).localeCompare(a.issuedAt ?? a.createdAt))) if (!out.has(c.courseId)) out.set(c.courseId, c)
  return out
}

/** One certificate a partner user may read: in their scope, and theirs, the organisation's, or any when they are an admin. */
export const loadCertificateFor = async (me: PartnerContext, id: string): Promise<Certificate | null> => {
  if (!/^\d+$/.test(id)) return null
  const payload = await db()
  try {
    const doc = (await payload.findByID({ collection: 'partner-certificates', id: Number(id), depth: 0, overrideAccess: true })) as unknown as Doc
    if (!inScope(me.scope, doc)) return null
    const c = toCertificate(doc)
    if (c.kind === 'org' || me.roles.includes('admin') || c.userId === me.user.id) return c
    return null
  } catch {
    return null
  }
}

/** One certificate for K7, any organisation. */
export const loadCertificate = async (id: string): Promise<Certificate | null> => {
  if (!/^\d+$/.test(id)) return null
  const payload = await db()
  try {
    return toCertificate((await payload.findByID({ collection: 'partner-certificates', id: Number(id), depth: 0, overrideAccess: true })) as unknown as Doc)
  } catch {
    return null
  }
}

export const findByNumber = async (number: string): Promise<Certificate | null> => (await find({ number: { equals: number } }, { limit: 1 }))[0] ?? null

/** The public verification (FR-TRN-09, FR-CRT-07): the minimum, or null for an unknown number, a request or a declined one. */
export const findForVerification = async (number: string, at = new Date()): Promise<VerifyView | null> => {
  const c = await findByNumber(number)
  if (!c) return null
  return verifyView(c, (await getPartnerSettings()).certificates.reminderDays, at)
}

export const stateOf = async (c: Certificate, at = new Date()): Promise<CertState> => certificateState(c, (await getPartnerSettings()).certificates.reminderDays, at)

/* ---------- The file ---------- */

const fileDoc = async (fileId: string): Promise<{ filename: string; mimeType: string } | null> => {
  if (!/^\d+$/.test(fileId)) return null
  const payload = await db()
  try {
    const d = (await payload.findByID({ collection: 'partner-certificate-files', id: Number(fileId), depth: 0, overrideAccess: true })) as unknown as Doc
    return { filename: s(d.filename), mimeType: s(d.mimeType) }
  } catch {
    return null
  }
}

const storePdf = async (c: Certificate, bytes: Uint8Array): Promise<string> => {
  const payload = await db()
  const name = certificateFileName(c)
  const doc = await payload.create({ collection: 'partner-certificate-files', overrideAccess: true, depth: 0, data: { number: c.number } as never, file: { data: Buffer.from(bytes), mimetype: 'application/pdf', name, size: bytes.byteLength } })
  await payload.update({ collection: 'partner-certificates', id: Number(c.id), overrideAccess: true, depth: 0, data: { file: doc.id } as never })
  return String(doc.id)
}

const render = async (c: Certificate, settings?: PartnerSettings): Promise<Uint8Array> => renderCertificatePdf({ certificate: c, verifyUrl: verifyUrlFor(c.number), settings: (settings ?? (await getPartnerSettings())).certificates })

/** The PDF bytes: the stored file, or, when the row has none or the disk lost it, drawn again and stored. A request has no file. */
export const certificateBytes = async (c: Certificate): Promise<{ bytes: Uint8Array; name: string } | null> => {
  if (c.status === 'requested' || c.status === 'declined' || !c.issuedAt) return null
  const name = certificateFileName(c)
  if (c.fileId) {
    const f = await fileDoc(c.fileId)
    if (f?.filename) {
      const full = path.join(CERTIFICATE_DIR, f.filename)
      if (full.startsWith(CERTIFICATE_DIR + path.sep) && existsSync(full)) return { bytes: new Uint8Array(readFileSync(full)), name }
    }
  }
  const bytes = await render(c)
  await storePdf(c, bytes).catch((e) => console.error(`[partner certificates] could not store ${c.number}: ${(e as Error).message}`))
  return { bytes, name }
}

export const servePdf = (file: { bytes: Uint8Array; name: string }, o: { inline?: boolean } = {}): Response =>
  new Response(Buffer.from(file.bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(file.bytes.byteLength),
      'Content-Disposition': `${o.inline ? 'inline' : 'attachment'}; filename="${file.name}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })

/* ---------- Numbers ---------- */

const newNumber = async (kind: CertKind): Promise<string> => {
  for (let i = 0; i < 12; i++) {
    const n = certificateNumber(kind, randomBytes(8))
    if (!(await findByNumber(n))) return n
  }
  throw new Error('Could not allocate a certificate number')
}

/* ---------- The organisation's mirror and rule ---------- */

const trackNames = async (): Promise<Record<string, string>> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-tracks', limit: 200, depth: 0, overrideAccess: true })
  return Object.fromEntries((r.docs as unknown as Doc[]).map((d) => [s(d.key), s(d.name)]))
}

/** `partner-orgs.certificate` as the certificates say it should be; written only when it differs. */
export const syncOrgMirror = async (orgId: string, certs?: Certificate[]): Promise<{ status: string; until: string | null }> => {
  const all = certs ?? (await certificatesOfOrg({ orgId }))
  const mirror = orgMirror(all)
  const payload = await db()
  const org = (await payload.findByID({ collection: 'partner-orgs', id: Number(orgId), depth: 0, overrideAccess: true })) as unknown as Doc
  const cur = (org.certificate ?? {}) as Doc
  if (s(cur.status) !== mirror.status || (s(cur.until) || null) !== mirror.until) await payload.update({ collection: 'partner-orgs', id: Number(orgId), depth: 0, overrideAccess: true, data: { certificate: mirror } as never })
  return mirror
}

export type OrgStanding = { org: PartnerOrg; rule: RuleReading; current: Certificate | null; state: CertState | 'none'; certs: Certificate[] }

/** Where an organisation stands: the rule for its type against its people's current certificates, and its own certificate. */
export const orgStanding = async (scope: OrgScope, settings?: PartnerSettings, at = new Date()): Promise<OrgStanding> => {
  const st = settings ?? (await getPartnerSettings())
  const payload = await db()
  const [org, certs, names] = await Promise.all([payload.findByID({ collection: 'partner-orgs', id: Number(scope.orgId), depth: 0, overrideAccess: true }) as unknown as Promise<Doc>, certificatesOfOrg(scope), trackNames()])
  const o = toOrg(org)
  const rule = readRule(o.type, st.certificates, certs, names, at)
  const current = currentOrgCertificate(certs)
  return { org: o, rule, current, state: current ? certificateState(current, st.certificates.reminderDays, at) : 'none', certs }
}

/** FR-CRT-02, 06: the request to the Channel Manager when the rule is met and no request waits and no certificate is current.
    Returns the request made, or null when nothing was due. */
export const raiseOrgRequestIfMet = async (orgId: string, actor: Actor = SYSTEM, settings?: PartnerSettings): Promise<Certificate | null> => {
  const st = settings ?? (await getPartnerSettings())
  const standing = await orgStanding({ orgId }, st)
  if (!standing.rule.met) return null
  if (standing.current && (standing.current.status === 'requested' || isCurrent(standing.current))) return null
  // A declined request is not raised again until something changed: an individual certificate issued since the decline.
  const declined = standing.certs.filter((c) => c.kind === 'org' && c.status === 'declined' && c.declinedAt).sort((a, b) => b.declinedAt!.localeCompare(a.declinedAt!))[0]
  if (declined && !standing.certs.some((c) => c.kind === 'individual' && c.issuedAt && c.issuedAt > declined.declinedAt!)) return null
  const payload = await db()
  const number = await newNumber('org')
  const previous = standing.certs.filter((c) => c.kind === 'org' && c.issuedAt).sort((a, b) => b.issuedAt!.localeCompare(a.issuedAt!))[0] ?? null
  const doc = (await payload.create({
    collection: 'partner-certificates',
    overrideAccess: true,
    depth: 0,
    data: { number, kind: 'org', status: 'requested', org: Number(orgId), orgPartnerId: standing.org.partnerId, orgName: standing.org.name, orgTradeName: standing.org.tradeName, orgType: standing.org.type, requestedAt: now(), ruleLines: standing.rule.lines, renewalOf: previous?.number ?? '' } as never,
  })) as unknown as Doc
  const c = toCertificate(doc)
  await audit({ actor, object: 'partner-certificates', objectId: c.id, objectLabel: c.number, action: previous ? 'certificate.renewal-requested' : 'certificate.requested', to: ruleText(standing.rule), orgId, comment: previous ? `renews ${previous.number}` : 'the rule met for the first time' })
  await notify({
    event: 'org.certificate.requested',
    subject: `${previous ? 'Partner certificate renewal' : 'Partner certificate'} to issue: ${standing.org.name}`,
    body: `${standing.org.name} (${standing.org.partnerId}) ${previous ? 'meets the rule again and its certificate has lapsed' : 'has met the training requirement for its partner type for the first time'}: ${ruleText(standing.rule)}. Issue the partner certificate on the desk, or decline with a reason.`,
    href: k7CertificateHref(c),
    to: { kind: 'staff', role: 'channelManager' },
    vars: certVars({ ...c, courseTitle: '', trackName: '', userName: '', userEmail: '', band: '' }, verifyUrlFor(c.number), { rule: ruleText(standing.rule) }),
    linkLabel: 'Open the request',
  })
  return c
}

/* ---------- Individual certificates (FR-TRN-07, 08, 10) ---------- */

type IssueIndividual = { user: PartnerUser; org: PartnerOrg; course: Course; track: Track; attempt: Attempt; actor: Actor }

const adminsOf = (orgId: string): Recipient => ({ kind: 'org', orgId, roles: ['admin'] })

/** Writes the row, draws and stores the PDF, supersedes the current one when this is a recertification, tells the
    participant (the PDF attached) and the Partner Admins, then reads the organisation's rule. */
const issueIndividual = async (i: IssueIndividual, settings: PartnerSettings): Promise<Certificate> => {
  const payload = await db()
  const scope = { orgId: i.org.id }
  const existing = await certificatesOfUser(scope, i.user.id)
  const decision = shouldIssueIndividual(existing, i.course.id, settings.certificates.reminderDays)
  const issuedAt = now()
  const number = await newNumber('individual')
  const score = i.attempt.score ?? 0
  const doc = (await payload.create({
    collection: 'partner-certificates',
    overrideAccess: true,
    depth: 0,
    data: {
      number,
      kind: 'individual',
      status: 'valid',
      org: orgRel(scope) as number,
      orgPartnerId: i.org.partnerId,
      orgName: i.org.name,
      orgTradeName: i.org.tradeName,
      orgType: i.org.type,
      user: Number(i.user.id),
      userName: i.user.name || i.user.email,
      userEmail: i.user.email,
      course: Number(i.course.id),
      courseTitle: i.course.title,
      courseVersion: i.attempt.courseVersion || i.course.version,
      trackKey: i.track.key,
      trackName: i.track.name,
      attempt: Number(i.attempt.id),
      score,
      band: scoreBand(score, settings.certificates),
      issuedAt,
      expiresAt: expiryFrom(issuedAt, settings.certificates.validityMonths),
      issuedBy: 'Portal',
      reminded: {},
    } as never,
  })) as unknown as Doc
  let c = toCertificate(doc)
  if (decision.supersede) {
    for (const old of existing.filter((x) => x.courseId === i.course.id && isCurrent(x))) {
      await payload.update({ collection: 'partner-certificates', id: Number(old.id), overrideAccess: true, depth: 0, data: { status: 'superseded', supersededBy: c.number } as never })
      await audit({ actor: i.actor, object: 'partner-certificates', objectId: old.id, objectLabel: old.number, action: 'certificate.superseded', to: c.number, orgId: i.org.id })
    }
  }
  const bytes = await render(c, settings)
  const fileId = await storePdf(c, bytes).catch((e) => {
    console.error(`[partner certificates] could not store ${c.number}: ${(e as Error).message}`)
    return ''
  })
  c = { ...c, fileId }
  await audit({ actor: i.actor, object: 'partner-certificates', objectId: c.id, objectLabel: c.number, action: decision.supersede ? 'certificate.recertified' : 'certificate.issued', to: `${c.courseTitle} · ${score}% · ${c.band}`, orgId: i.org.id, comment: `valid to ${c.expiresAt?.slice(0, 10)} · version ${c.courseVersion}` })
  const verifyUrl = verifyUrlFor(c.number)
  const subject = `Your certificate for ${c.courseTitle}: ${c.number}`
  const body = `${c.userName} passed the ${c.trackName} course “${c.courseTitle}” with ${score}% (${c.band}) and holds individual certificate ${c.number}, valid to ${c.expiresAt?.slice(0, 10).split('-').reverse().join('-')}. The PDF is attached and stays available in the portal; anyone can confirm it at ${verifyUrl}.`
  const to: Recipient[] = i.user.roles.includes('admin') ? [adminsOf(i.org.id)] : [{ kind: 'user', user: i.user }, adminsOf(i.org.id)]
  await notify({ event: 'training.certificate.issued', subject, body, href: certificateHref(c), to, vars: certVars(c, verifyUrl), attachments: [{ filename: certificateFileName(c), content: Buffer.from(bytes), contentType: 'application/pdf' }], linkLabel: 'Open the certificate' })
  return c
}

/** The test engine's call on a pass: the certificate issued, or null when the learner's current one stands (a retake outside
    the reminder window). Afterwards the organisation's rule is read and a request raised if it is newly met. */
export const issueForPass = async (me: PartnerContext, o: { attempt: Attempt; course: Course; track: Track }): Promise<Certificate | null> => {
  if (!o.attempt.passed) return null
  const settings = await getPartnerSettings()
  const existing = await certificatesOfUser(me.scope, me.user.id)
  if (!shouldIssueIndividual(existing, o.course.id, settings.certificates.reminderDays).issue) return null
  const c = await issueIndividual({ user: me.user, org: me.org, course: o.course, track: o.track, attempt: o.attempt, actor: me.actor }, settings)
  await raiseOrgRequestIfMet(me.scope.orgId, me.actor, settings).catch((e) => console.error(`[partner certificates] rule after ${c.number}: ${(e as Error).message}`))
  return c
}

/* ---------- The organisation certificate (FR-CRT-02 … 07) ---------- */

export type CertMove = { ok: true; certificate: Certificate } | { ok: false; error: string }

/** The Channel Manager issues: from a waiting request (the row becomes the certificate), or afresh for an organisation whose
    certificate expired or was never requested while it meets the rule now. The PDF is drawn, the admins told with it attached,
    the mirror set. */
export const issueOrgCertificate = async (target: { orgId: string; requestId?: string }, me: K7Context): Promise<CertMove> => {
  const settings = await getPartnerSettings()
  const standing = await orgStanding({ orgId: target.orgId }, settings)
  if (standing.org.status !== 'approved') return { ok: false, error: 'The organisation is suspended; reinstate it first.' }
  if (!standing.rule.configured) return { ok: false, error: 'No rule is set for this partner type (Settings → Certificates).' }
  if (!standing.rule.met) return { ok: false, error: `The organisation does not meet the rule now: ${ruleText(standing.rule)}.` }
  const current = standing.certs.find((c) => c.kind === 'org' && isCurrent(c))
  if (current) return { ok: false, error: `${current.number} is current until ${current.expiresAt?.slice(0, 10)}; revoke it before issuing another.` }
  const request = standing.certs.find((c) => c.kind === 'org' && c.status === 'requested' && (!target.requestId || c.id === target.requestId)) ?? null
  const payload = await db()
  const issuedAt = now()
  const previous = standing.certs.filter((c) => c.kind === 'org' && c.issuedAt).sort((a, b) => b.issuedAt!.localeCompare(a.issuedAt!))[0] ?? null
  const data = { status: 'valid', orgPartnerId: standing.org.partnerId, orgName: standing.org.name, orgTradeName: standing.org.tradeName, orgType: standing.org.type, issuedAt, expiresAt: expiryFrom(issuedAt, settings.certificates.orgValidityMonths), issuedBy: who(me.actor), ruleLines: standing.rule.lines, reminded: {}, renewalOf: previous?.number ?? '' }
  const doc = request
    ? ((await payload.update({ collection: 'partner-certificates', id: Number(request.id), overrideAccess: true, depth: 0, data: data as never })) as unknown as Doc)
    : ((await payload.create({ collection: 'partner-certificates', overrideAccess: true, depth: 0, data: { ...data, number: await newNumber('org'), kind: 'org', org: Number(target.orgId), requestedAt: issuedAt } as never })) as unknown as Doc)
  let c = toCertificate(doc)
  const bytes = await render(c, settings)
  const fileId = await storePdf(c, bytes).catch((e) => {
    console.error(`[partner certificates] could not store ${c.number}: ${(e as Error).message}`)
    return ''
  })
  c = { ...c, fileId }
  await syncOrgMirror(target.orgId)
  await audit({ actor: me.actor, object: 'partner-certificates', objectId: c.id, objectLabel: c.number, action: previous ? 'certificate.renewed' : 'certificate.issued', to: `valid to ${c.expiresAt?.slice(0, 10)}`, orgId: target.orgId, comment: `${ruleText(standing.rule)} · by ${who(me.actor)}${previous ? ` · renews ${previous.number}` : ''}` })
  const verifyUrl = verifyUrlFor(c.number)
  await notify({
    event: 'org.certificate.issued',
    subject: `K7 Partner Certificate ${c.number} issued to ${standing.org.name}`,
    body: `${standing.org.name} (${standing.org.partnerId}) is a certified K7 partner: certificate ${c.number}, issued ${c.issuedAt?.slice(0, 10).split('-').reverse().join('-')} and valid to ${c.expiresAt?.slice(0, 10).split('-').reverse().join('-')}. The PDF is attached and stays on the organisation page; anyone can confirm it at ${verifyUrl}. Keep your people certified: the certificate is renewed when it lapses, provided the rule (${ruleText(standing.rule)}) still holds.`,
    href: certificateHref(c),
    to: adminsOf(target.orgId),
    vars: certVars({ ...c, courseTitle: '', trackName: '', userName: '', userEmail: '', band: '' }, verifyUrl, { rule: ruleText(standing.rule) }),
    attachments: [{ filename: certificateFileName(c), content: Buffer.from(bytes), contentType: 'application/pdf' }],
    linkLabel: 'Open the certificate',
  })
  return { ok: true, certificate: c }
}

export const declineOrgRequest = async (c: Certificate, reason: string, me: K7Context): Promise<CertMove> => {
  if (c.kind !== 'org' || c.status !== 'requested') return { ok: false, error: 'Only a waiting request can be declined.' }
  const why = reason.trim()
  if (why.length < 3) return { ok: false, error: 'Give the organisation a reason.' }
  const payload = await db()
  const doc = (await payload.update({ collection: 'partner-certificates', id: Number(c.id), overrideAccess: true, depth: 0, data: { status: 'declined', declinedAt: now(), declinedReason: why, issuedBy: who(me.actor) } as never })) as unknown as Doc
  const d = toCertificate(doc)
  await audit({ actor: me.actor, object: 'partner-certificates', objectId: d.id, objectLabel: d.number, action: 'certificate.declined', orgId: d.orgId, comment: why })
  await notify({ event: 'org.certificate.declined', subject: `Partner certificate not issued yet`, body: `K7 has not issued the partner certificate to ${d.orgName} for now. ${who(me.actor)} writes: ${why}`, href: PARTNER_CERTIFICATES, to: adminsOf(d.orgId), vars: certVars({ ...d, courseTitle: '', trackName: '', userName: '', userEmail: '', band: '' }, verifyUrlFor(d.number), { reason: why }) })
  return { ok: true, certificate: d }
}

/** FR-CRT-07 and its individual twin: revoked with a reason, the holder told, the public page says invalid, the mirror set. */
export const revokeCertificate = async (c: Certificate, reason: string, me: K7Context): Promise<CertMove> => {
  if (c.status !== 'valid' && c.status !== 'expired') return { ok: false, error: 'Only an issued certificate can be revoked.' }
  const why = reason.trim()
  if (why.length < 3) return { ok: false, error: 'Record a reason.' }
  const payload = await db()
  const doc = (await payload.update({ collection: 'partner-certificates', id: Number(c.id), overrideAccess: true, depth: 0, data: { status: 'revoked', revokedAt: now(), revokedReason: why, revokedBy: who(me.actor) } as never })) as unknown as Doc
  const d = toCertificate(doc)
  await audit({ actor: me.actor, object: 'partner-certificates', objectId: d.id, objectLabel: d.number, action: 'certificate.revoked', from: c.status, to: 'revoked', orgId: d.orgId, comment: why })
  if (d.kind === 'org') {
    await syncOrgMirror(d.orgId)
    await notify({ event: 'org.certificate.revoked', subject: `Partner certificate ${d.number} revoked`, body: `K7 has revoked the partner certificate ${d.number} of ${d.orgName}. Reason: ${why}. The verification page now reads revoked; deal registration needs a certificate or a waiver while the gate is on.`, href: PARTNER_CERTIFICATES, to: adminsOf(d.orgId), vars: certVars({ ...d, courseTitle: '', trackName: '', userName: '', userEmail: '', band: '' }, verifyUrlFor(d.number), { reason: why }) })
  } else {
    const holder = d.userId ? (await loadPartnerUser(d.userId))?.user ?? null : null
    const to: Recipient[] = holder && !holder.roles.includes('admin') ? [{ kind: 'user', user: holder }, adminsOf(d.orgId)] : [adminsOf(d.orgId)]
    await notify({ event: 'training.certificate.revoked', subject: `Certificate ${d.number} revoked`, body: `K7 has revoked ${d.userName}’s certificate ${d.number} for “${d.courseTitle}”. Reason: ${why}. The course can be taken again.`, href: PARTNER_CERTIFICATES, to, vars: certVars(d, verifyUrlFor(d.number), { reason: why }) })
  }
  return { ok: true, certificate: d }
}

/* ---------- The sweep (FR-TRN-10, FR-CRT-05, 06) ---------- */

export type CertSweepResult = { checked: number; expired: number; reminded: number; requested: number; backfilled: number; mirrors: number; errors: string[] }

const dmyOf = (iso: string | null): string => (iso ? iso.slice(0, 10).split('-').reverse().join('-') : '')

const holderRecipients = async (c: Certificate): Promise<Recipient[]> => {
  if (c.kind === 'org') return [adminsOf(c.orgId)]
  const holder = c.userId ? (await loadPartnerUser(c.userId))?.user ?? null : null
  return holder && holder.status !== 'disabled' && !holder.roles.includes('admin') ? [{ kind: 'user', user: holder }, adminsOf(c.orgId)] : [adminsOf(c.orgId)]
}

/** Daily: valid certificates past their date become expired (the holders told; an expired organisation certificate raises
    the renewal request by itself when the rule still holds); the reminders go out once per threshold; passes from before
    M11 get their certificate; every organisation's mirror is checked. */
export const sweepCertificates = async (at = new Date()): Promise<CertSweepResult> => {
  const settings = await getPartnerSettings()
  const r: CertSweepResult = { checked: 0, expired: 0, reminded: 0, requested: 0, backfilled: 0, mirrors: 0, errors: [] }
  const payload = await db()
  const valid = await find({ status: { equals: 'valid' } })
  const touchedOrgs = new Set<string>()
  for (const c of valid) {
    r.checked += 1
    try {
      if (isPastExpiry(c, at)) {
        await payload.update({ collection: 'partner-certificates', id: Number(c.id), overrideAccess: true, depth: 0, data: { status: 'expired' } as never })
        r.expired += 1
        touchedOrgs.add(c.orgId)
        await audit({ actor: SYSTEM, object: 'partner-certificates', objectId: c.id, objectLabel: c.number, action: 'certificate.expired', from: 'valid', to: 'expired', orgId: c.orgId })
        const vars = certVars(c, verifyUrlFor(c.number))
        if (c.kind === 'org') await notify({ event: 'org.certificate.expired', subject: `Partner certificate ${c.number} has expired`, body: `The partner certificate of ${c.orgName} expired on ${dmyOf(c.expiresAt)}. If your people’s certificates are current, K7 has been asked to renew it; otherwise the recertification tests are open in Training.`, href: PARTNER_CERTIFICATES, to: adminsOf(c.orgId), vars })
        else await notify({ event: 'training.certificate.expired', subject: `Certificate ${c.number} has expired`, body: `${c.userName}’s certificate for “${c.courseTitle}” expired on ${dmyOf(c.expiresAt)}. The recertification test is open on the course page; passing it issues a new certificate.`, href: PARTNER_CERTIFICATES, to: await holderRecipients(c), vars })
        continue
      }
      const due = reminderDue(c, settings.certificates.reminderDays, at)
      if (due !== null) {
        await payload.update({ collection: 'partner-certificates', id: Number(c.id), overrideAccess: true, depth: 0, data: { reminded: { ...c.reminded, [String(due)]: at.toISOString() } } as never })
        r.reminded += 1
        const vars = certVars(c, verifyUrlFor(c.number))
        const days = Math.max(0, Math.ceil((new Date(c.expiresAt!).getTime() - at.getTime()) / 86400000))
        if (c.kind === 'org') {
          const standing = await orgStanding({ orgId: c.orgId }, settings, at)
          await notify({ event: 'org.certificate.expiring', subject: `Partner certificate expires in ${days} days`, body: `The partner certificate ${c.number} of ${c.orgName} expires on ${dmyOf(c.expiresAt)}. ${standing.rule.met ? `Your organisation still meets the rule (${ruleText(standing.rule)}); K7 will be asked to renew it when it lapses.` : `Your organisation does not meet the rule at the moment (${ruleText(standing.rule)}); have your people recertify in Training before then, or the certificate will not be renewed.`}`, href: PARTNER_CERTIFICATES, to: adminsOf(c.orgId), vars: { ...vars, rule: ruleText(standing.rule) } })
        } else {
          await notify({ event: 'training.certificate.expiring', subject: `Certificate for ${c.courseTitle} expires in ${days} days`, body: `${c.userName}’s certificate ${c.number} for “${c.courseTitle}” expires on ${dmyOf(c.expiresAt)}. The recertification test is open on the course page now; passing it issues a new certificate for another ${settings.certificates.validityMonths} months.`, href: `/partners/portal/training/${c.courseId}`, to: await holderRecipients(c), vars })
        }
      }
    } catch (e) {
      r.errors.push(`${c.number}: ${(e as Error).message.slice(0, 160)}`)
    }
  }
  // Passes recorded before certificates existed, or whose issue failed: one certificate per user and course, the latest pass.
  try {
    r.backfilled = await backfillPasses(settings)
  } catch (e) {
    r.errors.push(`backfill: ${(e as Error).message.slice(0, 160)}`)
  }
  // The organisations: the mirror, and the renewal request where an expired or never-requested organisation meets the rule.
  const orgs = await payload.find({ collection: 'partner-orgs', where: { status: { equals: 'approved' } }, limit: BIG, depth: 0, overrideAccess: true })
  for (const o of orgs.docs as unknown as Doc[]) {
    const id = s(o.id)
    try {
      const certs = await certificatesOfOrg({ orgId: id })
      const before = (o.certificate ?? {}) as Doc
      const mirror = await syncOrgMirror(id, certs)
      if (s(before.status) !== mirror.status || (s(before.until) || null) !== mirror.until) r.mirrors += 1
      if (await raiseOrgRequestIfMet(id, SYSTEM, settings)) r.requested += 1
    } catch (e) {
      // An organisation removed while the sweep runs (a test's cleanup, a deletion in the admin) is not an error.
      if (/not found/i.test((e as Error).message)) continue
      r.errors.push(`org ${id}: ${(e as Error).message.slice(0, 160)}`)
    }
  }
  return r
}

/** One certificate for every (user, course) with a pass and no certificate at all, from the latest pass. */
const backfillPasses = async (settings: PartnerSettings): Promise<number> => {
  const payload = await db()
  const passes = await payload.find({ collection: 'partner-attempts', where: { and: [{ passed: { equals: true } }, { status: { not_equals: 'open' } }] }, limit: BIG, depth: 0, sort: '-startedAt', overrideAccess: true })
  const certs = await find({ kind: { equals: 'individual' } })
  const covered = new Set(certs.map((c) => `${c.userId}:${c.courseId}`))
  const seen = new Set<string>()
  let n = 0
  for (const d of passes.docs as unknown as Doc[]) {
    const userId = s(typeof d.user === 'object' && d.user ? (d.user as Doc).id : d.user)
    const courseId = s(typeof d.course === 'object' && d.course ? (d.course as Doc).id : d.course)
    const key = `${userId}:${courseId}`
    if (seen.has(key) || covered.has(key)) continue
    seen.add(key)
    const found = await loadPartnerUser(userId)
    if (!found || found.user.status === 'disabled' || found.org.status !== 'approved') continue
    let course: Doc
    try {
      course = (await payload.findByID({ collection: 'partner-courses', id: Number(courseId), depth: 1, overrideAccess: true })) as unknown as Doc
    } catch {
      continue
    }
    if (course.status !== 'published') continue
    const track = (typeof course.track === 'object' && course.track ? course.track : {}) as Doc
    await issueIndividual({ user: found.user, org: found.org, course: toCourse(course), track: toTrack(track), attempt: toAttempt(d), actor: SYSTEM }, settings)
    n += 1
  }
  return n
}

/* ---------- The K7 side ---------- */

export type CertCounts = { requests: number; valid: number; expiring: number; expired: number; revoked: number; orgsCertified: number }

export const certificateCounts = async (at = new Date()): Promise<CertCounts> => {
  const settings = await getPartnerSettings()
  const all = await find({})
  const states = all.map((c) => ({ c, st: certificateState(c, settings.certificates.reminderDays, at) }))
  return {
    requests: states.filter((x) => x.st === 'requested').length,
    valid: states.filter((x) => x.st === 'valid' || x.st === 'expiring').length,
    expiring: states.filter((x) => x.st === 'expiring').length,
    expired: states.filter((x) => x.st === 'expired').length,
    revoked: states.filter((x) => x.st === 'revoked').length,
    orgsCertified: new Set(states.filter((x) => x.c.kind === 'org' && (x.st === 'valid' || x.st === 'expiring')).map((x) => x.c.orgId)).size,
  }
}

export type K7CertView = 'requests' | 'expiring' | 'valid' | 'expired' | 'revoked' | 'org' | 'all'
export type K7CertRow = { c: Certificate; state: CertState }

export const k7CertificateLedger = async (view: K7CertView, at = new Date()): Promise<K7CertRow[]> => {
  const settings = await getPartnerSettings()
  const rows = (await find({})).map((c) => ({ c, state: certificateState(c, settings.certificates.reminderDays, at) }))
  const pick = (x: K7CertRow): boolean =>
    view === 'all' ? true : view === 'requests' ? x.state === 'requested' : view === 'expiring' ? x.state === 'expiring' : view === 'valid' ? x.state === 'valid' || x.state === 'expiring' : view === 'expired' ? x.state === 'expired' : view === 'revoked' ? x.state === 'revoked' || x.state === 'declined' : x.c.kind === 'org'
  return rows.filter(pick)
}

/** The people of an organisation with their current certificates, for the two organisation views. */
export const orgPeopleCertificates = async (scope: OrgScope): Promise<{ user: PartnerUser; certs: Certificate[] }[]> => {
  const [users, certs] = await Promise.all([orgUsers(scope.orgId), certificatesOfOrg(scope)])
  return users
    .map((user) => ({ user, certs: [...currentByCourse(certs.filter((c) => c.userId === user.id)).values()] }))
    .sort((a, b) => (a.user.name || a.user.email).localeCompare(b.user.name || b.user.email))
}

