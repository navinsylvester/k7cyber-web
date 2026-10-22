import 'server-only'
import { randomBytes } from 'node:crypto'

import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import { sendMail } from '@/lib/support/mail'
import { getServerSideURL } from '@/utilities/getURL'

import { audit, type Actor } from './audit'
import { nextId } from './ids'
import { enqueueOutbox } from './mirror'
import { notify } from './notify'
import { clarificationNote, EMPTY_COMPANY, normaliseWebsite, readyToSubmit, type Application, type Company, type Contact, type DecisionRow } from './registration-model'
import type { K7Context } from './session'
import { getPartnerSettings, PARTNER_TYPE_LABEL, PARTNER_TYPES, type PartnerType } from './settings'
import { APPLICATION_STATUS_LABEL, canMoveApplication, decisionPath, DECISION_TO, type ApplicationStatus, type Decision } from './status'
import { findPartnerUserByEmail, toUser } from './users'

/* Applications and onboarding (01-requirements.md §3, 02-build-plan.md M2): the draft the join pages fill, the submission that
   gives it a number and tells the Channel Managers, the queue the K7 side reads, the decisions (assign, approve, reject, send
   back) and what approval creates: the organisation with its partner ID, the Partner Admin, the invitation, and the CRM job.
   Every move writes an audit row and an email to the applicant (FR-REG-08). */

const db = () => getPayload({ config: configPromise })
type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const d = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

export const JOIN = '/partners/join'
export const K7_APPLICATIONS = '/partners/portal/k7/applications'

export const toApplication = (x: Doc): Application => {
  const c = (x.contact ?? {}) as Doc
  const t = (x.terms ?? {}) as Doc
  const a = (x.assignee ?? {}) as Doc
  return {
    id: s(x.id),
    number: s(x.number),
    type: (PARTNER_TYPES as readonly string[]).includes(s(x.type)) ? (s(x.type) as PartnerType) : 'var',
    status: (['draft', 'submitted', 'underReview', 'clarification', 'approved', 'rejected'] as ApplicationStatus[]).includes(x.status as ApplicationStatus) ? (x.status as ApplicationStatus) : 'draft',
    company: {
      legalName: s(x.legalName),
      tradeName: s(x.tradeName),
      address: s(x.address),
      city: s(x.city),
      state: s(x.state),
      country: s(x.country) || EMPTY_COMPANY.country,
      pin: s(x.pin),
      website: s(x.website),
      yearOfIncorporation: typeof x.yearOfIncorporation === 'number' ? x.yearOfIncorporation : null,
      size: s(x.size) as Company['size'],
      turnover: s(x.turnover) as Company['turnover'],
      gstin: s(x.gstin),
      pan: s(x.pan),
    },
    contact: {
      name: s(c.name),
      designation: s(c.designation),
      email: s(c.email).toLowerCase(),
      mobile: s(c.mobile),
      emailVerifiedAt: d(c.emailVerifiedAt),
      mobileVerifiedAt: d(c.mobileVerifiedAt),
      mobileVerification: c.mobileVerification === 'sms' ? 'sms' : c.mobileVerification === 'skipped' ? 'skipped' : 'none',
    },
    regions: Array.isArray(x.regions) ? x.regions.map(String) : [],
    terms: { version: s(t.version), acceptedAt: d(t.acceptedAt) },
    assignee: { email: s(a.email).toLowerCase(), name: s(a.name) },
    decisions: Array.isArray(x.decisions) ? (x.decisions as Doc[]).map((r) => ({ to: s(r.to) as ApplicationStatus, byName: s(r.byName), byEmail: s(r.byEmail), at: s(r.at), comment: s(r.comment) })) : [],
    resumeKey: s(x.resumeKey),
    orgId: s(x.orgId),
    submittedAt: d(x.submittedAt),
    decidedAt: d(x.decidedAt),
    createdAt: s(x.createdAt),
    updatedAt: s(x.updatedAt),
  }
}

const update = async (id: string, data: Record<string, unknown>): Promise<Application> => {
  const payload = await db()
  const doc = await payload.update({ collection: 'partner-applications', id, data: data as never, depth: 0, overrideAccess: true })
  return toApplication(doc as unknown as Doc)
}

/* ---------- The join pages ---------- */

export const createDraft = async (type: PartnerType): Promise<Application> => {
  const payload = await db()
  const doc = await payload.create({ collection: 'partner-applications', data: { type, status: 'draft', resumeKey: randomBytes(24).toString('base64url'), country: EMPTY_COMPANY.country } as never, depth: 0, overrideAccess: true })
  return toApplication(doc as unknown as Doc)
}

/** The application behind a resume key (the join cookie or the emailed link). */
export const loadByKey = async (key: string | undefined | null): Promise<Application | null> => {
  if (!key || key.length < 16) return null
  const payload = await db()
  const r = await payload.find({ collection: 'partner-applications', where: { resumeKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
  const doc = r.docs[0] as unknown as Doc | undefined
  return doc ? toApplication(doc) : null
}

export const loadApplication = async (id: string): Promise<Application | null> => {
  if (!id) return null
  try {
    const payload = await db()
    return toApplication((await payload.findByID({ collection: 'partner-applications', id, depth: 0, overrideAccess: true })) as unknown as Doc)
  } catch {
    return null
  }
}

export const findByNumber = async (number: string): Promise<Application | null> => {
  const n = number.trim().toUpperCase()
  if (!/^K7A-\d{5}$/.test(n)) return null
  const payload = await db()
  const r = await payload.find({ collection: 'partner-applications', where: { number: { equals: n } }, limit: 1, depth: 0, overrideAccess: true })
  const doc = r.docs[0] as unknown as Doc | undefined
  return doc ? toApplication(doc) : null
}

/** Whether the applicant may still edit: a draft, or one sent back for clarification. */
export const editable = (a: Application): boolean => a.status === 'draft' || a.status === 'clarification'

export const saveType = (a: Application, type: PartnerType): Promise<Application> => update(a.id, { type })

/** Step 2: the company and the contact. A changed contact email needs verifying again. */
export const saveDetails = async (a: Application, company: Company, contact: Pick<Contact, 'name' | 'designation' | 'email' | 'mobile'>, regions: string[]): Promise<Application> => {
  const email = contact.email.trim().toLowerCase()
  const emailChanged = email !== a.contact.email
  const mobileChanged = contact.mobile.trim() !== a.contact.mobile
  return update(a.id, {
    legalName: company.legalName.trim(),
    tradeName: company.tradeName.trim(),
    address: company.address.trim(),
    city: company.city.trim(),
    state: company.state.trim(),
    country: company.country.trim(),
    pin: company.pin.trim(),
    website: normaliseWebsite(company.website),
    yearOfIncorporation: company.yearOfIncorporation,
    size: company.size || null,
    turnover: company.turnover || null,
    gstin: company.gstin.trim().toUpperCase(),
    pan: company.pan.trim().toUpperCase(),
    regions,
    contact: {
      name: contact.name.trim(),
      designation: contact.designation.trim(),
      email,
      mobile: contact.mobile.trim(),
      emailVerifiedAt: emailChanged ? null : a.contact.emailVerifiedAt,
      mobileVerifiedAt: mobileChanged ? null : a.contact.mobileVerifiedAt,
      mobileVerification: mobileChanged ? 'none' : a.contact.mobileVerification,
    },
  })
}

/** Step 3: the email code was right; the mobile either got its SMS code or the gateway is missing (decision 4). */
export const markVerified = (a: Application, o: { email?: boolean; mobile?: 'sms' | 'skipped' }): Promise<Application> =>
  update(a.id, {
    contact: {
      ...a.contact,
      emailVerifiedAt: o.email ? new Date().toISOString() : a.contact.emailVerifiedAt,
      mobileVerifiedAt: o.mobile === 'sms' ? new Date().toISOString() : a.contact.mobileVerifiedAt,
      mobileVerification: o.mobile ?? a.contact.mobileVerification,
    },
  })

const statusLink = (a: Pick<Application, 'number' | 'resumeKey'>): string => `${getServerSideURL()}${JOIN}/status?a=${encodeURIComponent(a.number)}&k=${encodeURIComponent(a.resumeKey)}`

const applicantMail = async (a: Application, subject: string, body: string): Promise<void> => {
  if (!a.contact.email) return
  const settings = await getPartnerSettings()
  try {
    await sendMail({ to: a.contact.email, from: settings.notify.mailFrom, subject, text: `${body}\n\nYour application: ${statusLink(a)}\n\nK7 Partner Programme` })
  } catch (e) {
    console.error(`[partner registration] mail to applicant ${a.number}: ${(e as Error).message}`)
  }
}

const describe = (a: Application): string => `${a.company.legalName || 'Unnamed company'} · ${PARTNER_TYPE_LABEL[a.type]}${a.company.country ? ` · ${a.company.country}` : ''}`

/** Step 4: terms accepted, everything verified → Submitted (first time or after a clarification). Gives the number on the first
    submission, tells the Channel Managers, and emails the applicant the link they resume from. */
export const submitApplication = async (a: Application, termsVersion: string): Promise<{ ok: true; app: Application } | { ok: false; errors: Record<string, string> }> => {
  const settings = await getPartnerSettings()
  const errors = readyToSubmit(a, settings.regions)
  if (Object.keys(errors).length) return { ok: false, errors }
  if (!canMoveApplication(a.status, 'submitted')) return { ok: false, errors: { status: `An application that is ${APPLICATION_STATUS_LABEL[a.status].toLowerCase()} cannot be submitted.` } }
  const resubmit = a.status === 'clarification'
  const number = a.number || (await nextId('application'))
  const now = new Date().toISOString()
  const decision: DecisionRow = { to: 'submitted', byName: a.contact.name, byEmail: a.contact.email, at: now, comment: resubmit ? 'Resubmitted after clarification' : '' }
  const app = await update(a.id, { number, status: 'submitted', submittedAt: now, terms: { version: termsVersion, acceptedAt: now }, decisions: [...a.decisions, decision], assignee: resubmit ? a.assignee : { email: '', name: '' } })
  const actor: Actor = { kind: 'partner', name: app.contact.name, email: app.contact.email }
  await audit({ actor, object: 'partner-applications', objectId: app.id, objectLabel: app.number, action: resubmit ? 'application.resubmitted' : 'application.submitted', from: a.status, to: 'submitted', comment: `Terms ${termsVersion} accepted` })
  await notify({
    event: resubmit ? 'application.resubmitted' : 'application.submitted',
    subject: `${resubmit ? 'Resubmitted' : 'New'} application ${app.number}: ${app.company.legalName}`,
    body: `${describe(app)}. ${resubmit ? 'The applicant answered the clarification.' : 'Waiting for a Channel Manager to review it.'}`,
    href: `${K7_APPLICATIONS}/${app.number}`,
    to: { kind: 'staff', role: 'channelManager' },
  })
  await applicantMail(app, `Application ${app.number} received`, `Thank you. We have your application for ${app.company.legalName} to join the K7 Partner Programme as a ${PARTNER_TYPE_LABEL[app.type]}.\n\nA Channel Manager will review it and we will email you at every step. Keep this message: the link below shows the status and lets you edit the application if we ask for something.`)
  return { ok: true, app }
}

/* ---------- The K7 queue ---------- */

export type ApplicationFilter = { status?: ApplicationStatus | 'open' | 'decided' | 'all'; q?: string; mine?: string; page?: number; limit?: number }
export type ApplicationPage = { rows: Application[]; total: number; page: number; totalPages: number }

export const listApplications = async (f: ApplicationFilter = {}): Promise<ApplicationPage> => {
  const payload = await db()
  const status = f.status ?? 'open'
  const parts: Where[] = [{ status: { not_equals: 'draft' } }]
  if (status === 'open') parts.push({ status: { in: ['submitted', 'underReview', 'clarification'] } })
  else if (status === 'decided') parts.push({ status: { in: ['approved', 'rejected'] } })
  else if (status !== 'all') parts.push({ status: { equals: status } })
  if (f.mine) parts.push({ 'assignee.email': { equals: f.mine.toLowerCase() } })
  const q = f.q?.trim()
  if (q) parts.push({ or: [{ number: { like: q } }, { legalName: { like: q } }, { tradeName: { like: q } }, { 'contact.email': { like: q } }, { 'contact.name': { like: q } }, { city: { like: q } }] })
  const limit = f.limit ?? 25
  const page = Math.max(1, f.page ?? 1)
  const r = await payload.find({ collection: 'partner-applications', where: { and: parts }, sort: status === 'decided' ? '-decidedAt' : 'submittedAt', limit, page, depth: 0, overrideAccess: true })
  return { rows: (r.docs as unknown as Doc[]).map(toApplication), total: r.totalDocs, page: r.page ?? page, totalPages: r.totalPages }
}

export const applicationCounts = async (): Promise<Record<'submitted' | 'underReview' | 'clarification' | 'approved' | 'rejected', number>> => {
  const payload = await db()
  const out = { submitted: 0, underReview: 0, clarification: 0, approved: 0, rejected: 0 }
  await Promise.all(
    (Object.keys(out) as (keyof typeof out)[]).map(async (k) => {
      const r = await payload.count({ collection: 'partner-applications', where: { status: { equals: k } }, overrideAccess: true })
      out[k] = r.totalDocs
    }),
  )
  return out
}

/* ---------- Decisions (FR-REG-05) ---------- */

const k7Actor = (me: K7Context): Actor => me.actor

/** Submitted → Under review, assigned to this person (or re-assigned while under review). */
export const assignApplication = async (a: Application, me: K7Context, to: { email: string; name: string } = { email: me.email, name: me.name }): Promise<Application> => {
  const moving = a.status === 'submitted'
  if (moving && !canMoveApplication(a.status, 'underReview')) throw new Error('This application cannot be assigned from its state.')
  if (!moving && a.status !== 'underReview') throw new Error('Only a submitted application or one under review can be assigned.')
  const now = new Date().toISOString()
  const decisions = moving ? [...a.decisions, { to: 'underReview' as const, byName: me.name, byEmail: me.email, at: now, comment: `Assigned to ${to.name || to.email}` }] : a.decisions
  const app = await update(a.id, { status: 'underReview', assignee: { email: to.email.toLowerCase(), name: to.name }, decisions })
  await audit({ actor: k7Actor(me), object: 'partner-applications', objectId: app.id, objectLabel: app.number, action: moving ? 'application.under-review' : 'application.reassigned', from: a.status, to: 'underReview', comment: `Assigned to ${to.name || to.email}` })
  if (moving) await applicantMail(app, `Application ${app.number} is under review`, `Your application for ${app.company.legalName} is now with a K7 Channel Manager. We will email you when a decision is made.`)
  return app
}

export type DecideResult = { ok: true; app: Application; org?: { id: string; partnerId: string } } | { ok: false; error: string }

/** Approve, reject or send back. From Submitted the application is assigned to the decider first, so the trail shows both. */
export const decideApplication = async (a: Application, decision: Decision, comment: string, me: K7Context): Promise<DecideResult> => {
  const path = decisionPath(a.status, decision)
  if (!path.length) return { ok: false, error: `${APPLICATION_STATUS_LABEL[a.status]} applications cannot be ${decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'sent back'}.` }
  const note = comment.trim()
  if (decision !== 'approve' && note.length < 3) return { ok: false, error: decision === 'reject' ? 'Give the applicant the reason.' : 'Tell the applicant what you need.' }
  let app = a
  if (path[0] === 'underReview') app = await assignApplication(app, me)
  const to = DECISION_TO[decision]
  if (decision === 'approve') {
    const r = await approveApplication(app, note, me)
    return r
  }
  const now = new Date().toISOString()
  app = await update(app.id, { status: to, decidedAt: to === 'rejected' ? now : null, decisions: [...app.decisions, { to, byName: me.name, byEmail: me.email, at: now, comment: note }] })
  await audit({ actor: k7Actor(me), object: 'partner-applications', objectId: app.id, objectLabel: app.number, action: to === 'rejected' ? 'application.rejected' : 'application.clarification', from: 'underReview', to, comment: note })
  if (to === 'rejected') await applicantMail(app, `Application ${app.number}: not accepted`, `We are sorry: the application for ${app.company.legalName} was not accepted.\n\nReason: ${note}\n\nIf circumstances change, your company is welcome to apply again.`)
  else await applicantMail(app, `Application ${app.number}: we need something from you`, `A K7 Channel Manager has a question about the application for ${app.company.legalName}:\n\n${note}\n\nOpen the link below, edit the application and resubmit it.`)
  return { ok: true, app }
}

/** Approval (FR-REG-06): the organisation with its partner ID, the primary contact as Partner Admin, the invitation, the CRM job. */
export const approveApplication = async (a: Application, comment: string, me: K7Context): Promise<DecideResult> => {
  if (!canMoveApplication(a.status, 'approved')) return { ok: false, error: `${APPLICATION_STATUS_LABEL[a.status]} applications cannot be approved.` }
  const email = a.contact.email
  if (!email) return { ok: false, error: 'The application has no contact email.' }
  const taken = await findPartnerUserByEmail(email)
  if (taken) return { ok: false, error: `${email} is already a user of ${taken.org.partnerId} (${taken.org.name}). The same address cannot be the Partner Admin of a second organisation.` }
  const payload = await db()
  const settings = await getPartnerSettings()
  const now = new Date().toISOString()
  const partnerId = await nextId('partner')
  const orgDoc = await payload.create({
    collection: 'partner-orgs',
    overrideAccess: true,
    depth: 0,
    data: {
      partnerId,
      type: a.type,
      status: 'approved',
      applicationId: a.id,
      name: a.company.legalName,
      tradeName: a.company.tradeName,
      gstin: a.company.gstin,
      pan: a.company.pan,
      address: a.company.address,
      city: a.company.city,
      state: a.company.state,
      country: a.company.country,
      pin: a.company.pin,
      website: a.company.website,
      regions: a.regions,
    } as never,
  })
  const orgId = String(orgDoc.id)
  const userDoc = await payload.create({
    collection: 'partner-users',
    overrideAccess: true,
    depth: 0,
    data: { org: orgDoc.id, email, name: a.contact.name, designation: a.contact.designation, mobile: a.contact.mobile, roles: ['admin'], status: 'invited', invitedAt: now } as never,
  })
  const user = toUser(userDoc as unknown as Doc)
  const app = await update(a.id, { status: 'approved', orgId, decidedAt: now, decisions: [...a.decisions, { to: 'approved', byName: me.name, byEmail: me.email, at: now, comment }] })
  const actor = k7Actor(me)
  await audit({ actor, object: 'partner-applications', objectId: app.id, objectLabel: app.number, action: 'application.approved', from: 'underReview', to: 'approved', orgId, comment })
  await audit({ actor, object: 'partner-orgs', objectId: orgId, objectLabel: partnerId, action: 'org.created', to: 'approved', orgId, comment: `From application ${app.number}` })
  await audit({ actor, object: 'partner-users', objectId: user.id, objectLabel: user.email, action: 'user.invited', to: 'invited', orgId, comment: 'Partner Admin, from the application’s primary contact' })
  await notify({
    event: 'application.approved',
    subject: `Welcome to the K7 Partner Programme: ${partnerId}`,
    body: `${a.company.legalName} is approved as a ${PARTNER_TYPE_LABEL[a.type]}. Your partner ID is ${partnerId}. Sign in with this email address at ${getServerSideURL()}/partners/portal/sign-in: we send a one-time code, no password.${comment ? `\n\nFrom your Channel Manager: ${comment}` : ''}`,
    href: '/partners/portal',
    to: { kind: 'user', user },
  })
  const job = await enqueueOutbox({ kind: 'account.create', orgId, object: 'partner-orgs', objectId: orgId, objectLabel: partnerId, payload: { approverUserId: me.userId, approverEmail: me.email, approvedAt: now, ownerRule: settings.crm.ownerRule, ownerId: settings.crm.ownerId }, actor: me.email || me.name })
  if (!job) console.error(`[partner registration] the CRM job for ${partnerId} could not be queued`)
  return { ok: true, app, org: { id: orgId, partnerId } }
}

/** For the K7 application sheet: the organisation it became, when it did. */
export const orgOfApplication = async (a: Application): Promise<{ id: string; partnerId: string; name: string } | null> => {
  if (!a.orgId) return null
  try {
    const payload = await db()
    const o = (await payload.findByID({ collection: 'partner-orgs', id: a.orgId, depth: 0, overrideAccess: true })) as unknown as Doc
    return { id: s(o.id), partnerId: s(o.partnerId), name: s(o.name) }
  } catch {
    return null
  }
}

export { clarificationNote }
