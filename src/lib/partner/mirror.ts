import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { bind, buildQuery, create, entity, list, ProductionWriteRefused, retrieve, str, update, WritesDisabled, type DataverseAuth, type Row } from '@/lib/dataverse'

import { audit, SYSTEM } from './audit'
import { accountBody, contactBody, type SizeBand, type TurnoverBand } from './registration-model'
import { getPartnerSettings } from './settings'
import type { PartnerType } from './settings-model'

/* The CRM mirror's outbox (02-build-plan.md decision 2, 03-dynamics-exploration.md §6): every write the portal owes Dynamics is a
   row in `partner-outbox`, queued by the portal action and run as the service identity, never in the request path's critical
   section. `account.create` makes the partner account and its primary contact on approval and stores the ids on the
   organisation. Jobs run only when `partner-settings.crm.enabled` is on; the client's guard turns a production write into
   `skipped`; another failure is `failed` with its code, retried by the next drain. */

const db = () => getPayload({ config: configPromise })
type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export type OutboxKind = 'account.create' | 'opportunity.create'
export type OutboxState = 'pending' | 'done' | 'failed' | 'skipped'
export type OutboxJob = { id: string; kind: OutboxKind; state: OutboxState; attempts: number; orgId: string; object: string; objectId: string; objectLabel: string; payload: Record<string, unknown>; result: Record<string, unknown>; actor: string; lastError: string; doneAt: string | null; createdAt: string; updatedAt: string }

const toJob = (x: Doc): OutboxJob => ({
  id: s(x.id),
  kind: x.kind === 'opportunity.create' ? 'opportunity.create' : 'account.create',
  state: (['pending', 'done', 'failed', 'skipped'] as OutboxState[]).includes(x.state as OutboxState) ? (x.state as OutboxState) : 'pending',
  attempts: typeof x.attempts === 'number' ? x.attempts : 0,
  orgId: s(x.orgId),
  object: s(x.object),
  objectId: s(x.objectId),
  objectLabel: s(x.objectLabel),
  payload: (x.payload && typeof x.payload === 'object' ? x.payload : {}) as Record<string, unknown>,
  result: (x.result && typeof x.result === 'object' ? x.result : {}) as Record<string, unknown>,
  actor: s(x.actor),
  lastError: s(x.lastError),
  doneAt: typeof x.doneAt === 'string' ? x.doneAt : null,
  createdAt: s(x.createdAt),
  updatedAt: s(x.updatedAt),
})

export type EnqueueInput = { kind: OutboxKind; orgId: string; object: string; objectId: string; objectLabel: string; payload?: Record<string, unknown>; actor: string }

/** Records the job; runs it at once when the mirror is on (the service identity must exist), else it waits for the drain. */
export const enqueueOutbox = async (i: EnqueueInput): Promise<OutboxJob | null> => {
  try {
    const payload = await db()
    const doc = await payload.create({ collection: 'partner-outbox', overrideAccess: true, depth: 0, data: { kind: i.kind, state: 'pending', attempts: 0, orgId: i.orgId, object: i.object, objectId: i.objectId, objectLabel: i.objectLabel, payload: i.payload ?? {}, actor: i.actor } as never })
    const job = toJob(doc as unknown as Doc)
    const settings = await getPartnerSettings()
    if (!settings.crm.enabled) return job
    return await runJob(job)
  } catch (e) {
    console.error(`[partner outbox] enqueue ${i.kind} for ${i.objectLabel}: ${(e as Error).message}`)
    return null
  }
}

const errorCode = (e: unknown): string => {
  const x = e as { code?: string; status?: number; message?: string }
  return (x.code ?? (x.status ? `HTTP ${x.status}` : (x.message ?? 'error'))).slice(0, 120)
}

/* ---------- account.create ---------- */

type OrgDoc = { id: string; partnerId: string; type: PartnerType; name: string; website: string; address: string; city: string; state: string; country: string; pin: string; regions: string[]; crm: { accountId: string; accountCode: string; contactId: string }; applicationId: string }

const orgDoc = (x: Doc): OrgDoc => {
  const crm = (x.crm ?? {}) as Doc
  return { id: s(x.id), partnerId: s(x.partnerId), type: s(x.type) as PartnerType, name: s(x.name), website: s(x.website), address: s(x.address), city: s(x.city), state: s(x.state), country: s(x.country), pin: s(x.pin), regions: Array.isArray(x.regions) ? x.regions.map(String) : [], crm: { accountId: s(crm.accountId), accountCode: s(crm.accountCode), contactId: s(crm.contactId) }, applicationId: s(x.applicationId) }
}

/** A reference row by its name, or null; names differ in case and spacing between what the applicant typed and the CRM's rows. */
const byName = async (auth: DataverseAuth, entitySet: string, idField: string, nameField: string, name: string): Promise<string | null> => {
  const n = name.trim()
  if (!n) return null
  try {
    const p = await list(auth, buildQuery(entitySet, { select: [idField], filter: `${nameField} eq ${str(n)} and statecode eq 0`, top: 1 }), 1)
    const id = p.value[0]?.[idField]
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

const createAccountJob = async (auth: DataverseAuth, job: OutboxJob): Promise<Record<string, unknown>> => {
  const payload = await db()
  const org = orgDoc((await payload.findByID({ collection: 'partner-orgs', id: job.orgId, depth: 0, overrideAccess: true })) as unknown as Doc)
  if (org.crm.accountId && org.crm.contactId) return { accountId: org.crm.accountId, accountCode: org.crm.accountCode, contactId: org.crm.contactId, note: 'already mirrored' }
  const app = org.applicationId ? ((await payload.findByID({ collection: 'partner-applications', id: org.applicationId, depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null) : null
  const contact = (app?.contact ?? {}) as Doc
  const settings = await getPartnerSettings()
  const regionName = settings.regions.find((r) => org.regions.includes(r.code))?.name ?? ''
  const { body } = accountBody({
    name: org.name,
    type: org.type,
    website: org.website,
    email: s(contact.email),
    phone: s(contact.mobile),
    address: org.address,
    city: org.city,
    state: org.state,
    country: org.country,
    pin: org.pin,
    turnover: s(app?.turnover) as TurnoverBand | '',
    size: s(app?.size) as SizeBand | '',
    yearOfIncorporation: typeof app?.yearOfIncorporation === 'number' ? app.yearOfIncorporation : null,
    approvedAt: s(job.payload.approvedAt) || new Date().toISOString(),
  })
  const [regionId, stateId, cityId, countryId] = await Promise.all([
    byName(auth, 'k7_regions', 'k7_regionid', 'k7_name', regionName),
    byName(auth, 'k7_states', 'k7_stateid', 'k7_state', org.state),
    byName(auth, 'alletec_cities', 'alletec_cityid', 'alletec_name', org.city),
    byName(auth, 'alletec_countries', 'alletec_countryid', 'alletec_name', org.country),
  ])
  const account: Row = { ...body }
  if (regionId) account['k7_Region@odata.bind'] = bind('k7_regions', regionId)
  if (stateId) account['k7_State@odata.bind'] = bind('k7_states', stateId)
  if (cityId) account['alletec_City@odata.bind'] = bind('alletec_cities', cityId)
  if (countryId) account['alletec_Country@odata.bind'] = bind('alletec_countries', countryId)
  const ownerRule = s(job.payload.ownerRule) === 'fixed' ? 'fixed' : 'approver'
  const ownerId = ownerRule === 'fixed' ? s(job.payload.ownerId) : s(job.payload.approverUserId)
  if (/^[0-9a-f-]{36}$/i.test(ownerId)) account['ownerid@odata.bind'] = bind('systemusers', ownerId)
  const SUPPRESS = { 'MSCRM.SuppressDuplicateDetection': 'true' }
  // Two writes, recorded one at a time: a job that fails on the contact resumes from the account it already made.
  let accountId = org.crm.accountId
  if (!accountId) {
    accountId = await create(auth, 'accounts', account, SUPPRESS)
    await payload.update({ collection: 'partner-orgs', id: org.id, overrideAccess: true, data: { crm: { accountId, accountCode: '', contactId: '' } } as never })
  }
  let contactId = org.crm.contactId
  if (!contactId && s(contact.email)) {
    const c: Row = { ...contactBody({ name: s(contact.name), designation: s(contact.designation), email: s(contact.email), mobile: s(contact.mobile) }), 'parentcustomerid_account@odata.bind': bind('accounts', accountId) }
    if (regionId) c['k7_Region@odata.bind'] = bind('k7_regions', regionId)
    if (stateId) c['k7_State@odata.bind'] = bind('k7_states', stateId)
    if (cityId) c['alletec_City@odata.bind'] = bind('alletec_cities', cityId)
    contactId = await create(auth, 'contacts', c, SUPPRESS)
    await update(auth, entity('accounts', accountId), { 'primarycontactid@odata.bind': bind('contacts', contactId) })
  }
  let accountCode = org.crm.accountCode
  if (!accountCode) try {
    const row = await retrieve<Row>(auth, `${entity('accounts', accountId)}?$select=alletec_accountid`)
    accountCode = s(row.alletec_accountid)
  } catch {
    /* the code is a convenience; the id is what matters */
  }
  await payload.update({ collection: 'partner-orgs', id: org.id, overrideAccess: true, data: { crm: { accountId, accountCode, contactId } } as never })
  await audit({ actor: SYSTEM, object: 'partner-orgs', objectId: org.id, objectLabel: org.partnerId, action: 'org.crm-mirrored', orgId: org.id, comment: `Account ${accountCode || accountId}${contactId ? ' with primary contact' : ''} created in Dynamics`, meta: { accountId, contactId, regionId, stateId, cityId, countryId } })
  return { accountId, accountCode, contactId, lookups: { regionId, stateId, cityId, countryId } }
}

/* ---------- Running ---------- */

const record = async (job: OutboxJob, state: OutboxState, extra: Record<string, unknown>): Promise<OutboxJob> => {
  const payload = await db()
  const doc = await payload.update({ collection: 'partner-outbox', id: job.id, overrideAccess: true, depth: 0, data: { state, attempts: job.attempts + 1, ...extra } as never })
  return toJob(doc as unknown as Doc)
}

/** Runs one job as the service identity. The production guard and the writes switch give `skipped`; anything else `failed`. */
export const runJob = async (job: OutboxJob, auth: DataverseAuth = { kind: 'service' }): Promise<OutboxJob> => {
  if (job.state === 'done') return job
  try {
    let result: Record<string, unknown>
    switch (job.kind) {
      case 'account.create':
        result = await createAccountJob(auth, job)
        break
      case 'opportunity.create':
        return record(job, 'pending', { lastError: 'opportunity.create arrives with M4' })
    }
    return await record(job, 'done', { result, lastError: '', doneAt: new Date().toISOString() })
  } catch (e) {
    if (e instanceof ProductionWriteRefused || e instanceof WritesDisabled) return record(job, 'skipped', { lastError: e instanceof ProductionWriteRefused ? 'production is read-only' : 'DATAVERSE_WRITES_ENABLED is off' })
    const code = errorCode(e)
    console.error(`[partner outbox] ${job.kind} ${job.objectLabel}: ${code}`)
    return record(job, 'failed', { lastError: code })
  }
}

export type DrainResult = { ran: number; done: number; failed: number; skipped: number; pending: number; lines: string[] }

/** The pending and failed jobs, oldest first, when the mirror is on. Skipped jobs are retried too: the switch may have changed. */
export const drainOutbox = async (limit = 25, auth: DataverseAuth = { kind: 'service' }): Promise<DrainResult> => {
  const r: DrainResult = { ran: 0, done: 0, failed: 0, skipped: 0, pending: 0, lines: [] }
  const settings = await getPartnerSettings()
  if (!settings.crm.enabled) {
    r.lines.push('The CRM mirror is off in the partner settings; nothing was written.')
    return r
  }
  const payload = await db()
  const q = await payload.find({ collection: 'partner-outbox', where: { state: { in: ['pending', 'failed', 'skipped'] } }, sort: 'createdAt', limit, depth: 0, overrideAccess: true })
  for (const doc of q.docs) {
    const job = await runJob(toJob(doc as unknown as Doc), auth)
    r.ran += 1
    r[job.state] += 1
    r.lines.push(`${job.kind} ${job.objectLabel}: ${job.state}${job.lastError ? ` (${job.lastError})` : ''}`)
  }
  return r
}

export const outboxOf = async (object: string, objectId: string): Promise<OutboxJob[]> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'partner-outbox', where: { and: [{ object: { equals: object } }, { objectId: { equals: objectId } }] }, sort: '-createdAt', limit: 50, depth: 0, overrideAccess: true })
    return (r.docs as unknown as Doc[]).map(toJob)
  } catch {
    return []
  }
}

export const loadJob = async (id: string): Promise<OutboxJob | null> => {
  try {
    const payload = await db()
    return toJob((await payload.findByID({ collection: 'partner-outbox', id, depth: 0, overrideAccess: true })) as unknown as Doc)
  } catch {
    return null
  }
}

export const owedOutboxCount = async (): Promise<number> => {
  try {
    const payload = await db()
    return (await payload.count({ collection: 'partner-outbox', where: { state: { in: ['pending', 'failed', 'skipped'] } }, overrideAccess: true })).totalDocs
  } catch {
    return 0
  }
}
