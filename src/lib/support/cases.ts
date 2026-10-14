import 'server-only'

import { action, and, bind, buildQuery, callDataverse, create, entity, guid, isGuid, list, nextPage, or, retrieve, str, update, type DataverseAuth, type Page, type Row } from '@/lib/dataverse'

import { ORIGIN_WEB, STATE, STATUS } from './options'
import { CUSTOMER_VISIBLE_FILTER } from './status'

/* Cases (incident). Agent functions run with the agent's delegated token and inherit their Dynamics rights.
   Customer functions take a CustomerScope and never issue a query without it (08-implementation-plan.md §3). */

export const CASE_SELECT = [
  'incidentid', 'ticketnumber', 'title', 'description', 'statecode', 'statuscode', 'caseorigincode', 'prioritycode', 'casetypecode',
  'createdon', 'modifiedon', 'new_verticaltype', 'new_customertype', 'k7_caseconsideredas', 'new_category', 'k7_productversion',
  'k7_2ndserialnumber', 'k7_customeremail', 'k7_module', 'k7_submodule', 'adx_resolution', 'adx_stepstoreproduce', 'adx_createdbyusername',
  '_customerid_value', '_primarycontactid_value', '_productid_value', '_new_issue_value', '_new_subcategory_value', '_ownerid_value',
  '_k7_rfe_value', '_k7_defectnew_value', '_createdby_value', '_modifiedby_value', 'firstresponseslastatus', 'resolvebyslastatus', 'escalatedon', 'followupby', 'cit_productcategory',
] as const

export const CASE_LIST_SELECT = ['incidentid', 'ticketnumber', 'title', 'statecode', 'statuscode', 'caseorigincode', 'prioritycode', 'createdon', 'modifiedon', '_customerid_value', '_productid_value', '_ownerid_value', '_new_issue_value'] as const

export type CaseRow = Row & { incidentid: string; ticketnumber: string; title: string; statecode: number; statuscode: number; createdon: string; modifiedon: string }

/* ---------- Agent reads ---------- */

export const getCase = async (auth: DataverseAuth, id: string): Promise<CaseRow | null> => {
  if (!isGuid(id)) return null
  try {
    return await retrieve<CaseRow>(auth, `${entity('incidents', id)}?$select=${CASE_SELECT.join(',')}`)
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null
    throw e
  }
}

export const getCaseByTicket = async (auth: DataverseAuth, ticket: string): Promise<CaseRow | null> => {
  const p = await list<CaseRow>(auth, buildQuery('incidents', { select: [...CASE_SELECT], filter: `ticketnumber eq ${str(ticket.trim().toUpperCase())}`, top: 1 }), 1)
  return p.value[0] ?? null
}

/** Quick search for the workspace header: case number prefix, title words or customer email. */
export const searchCases = async (auth: DataverseAuth, q: string, top = 10): Promise<CaseRow[]> => {
  const needle = q.trim()
  if (!needle) return []
  const filter = /^cs-/i.test(needle)
    ? `startswith(ticketnumber,${str(needle.toUpperCase())})`
    : or(`contains(title,${str(needle)})`, `contains(ticketnumber,${str(needle.toUpperCase())})`, `contains(k7_customeremail,${str(needle)})`)
  const p = await list<CaseRow>(auth, buildQuery('incidents', { select: [...CASE_LIST_SELECT], filter, orderby: 'modifiedon desc', top }), top)
  return p.value
}

/** Cases of a customer record, newest first (account or contact pages). */
export const casesForCustomer = async (auth: DataverseAuth, customerId: string, top = 25): Promise<CaseRow[]> => {
  const p = await list<CaseRow>(auth, buildQuery('incidents', { select: [...CASE_LIST_SELECT], filter: or(`_customerid_value eq ${guid(customerId)}`, `_primarycontactid_value eq ${guid(customerId)}`), orderby: 'modifiedon desc', top }), top)
  return p.value
}

/* ---------- Agent writes ---------- */

export type NewCase = {
  title: string
  description?: string
  customer: { kind: 'contact' | 'account'; id: string }
  primaryContactId?: string
  origin?: number
  productId?: string
  categoryId?: string
  subcategoryId?: string
  vertical?: number
  customerType?: number
  priority?: number
  caseType?: number
  category?: number
  consideredAs?: number
  productVersion?: string
  serial?: string
  module?: string
  submodule?: string
  customerEmail?: string
  stepsToReproduce?: string
  /** Portal attribution (adx_createdbyusername): the signed-in email. */
  createdBy?: string
  ownerId?: string
  /** Status reason on create (an active one); the portal sends Open so UAT's defaults do not decide it. */
  status?: number
}

const caseBody = (c: Partial<NewCase>): Row => {
  const b: Row = {}
  if (c.title !== undefined) b.title = c.title.trim().slice(0, 200)
  if (c.description !== undefined) b.description = c.description
  if (c.customer) b[c.customer.kind === 'contact' ? 'customerid_contact@odata.bind' : 'customerid_account@odata.bind'] = bind(c.customer.kind === 'contact' ? 'contacts' : 'accounts', c.customer.id)
  if (c.primaryContactId !== undefined) b['primarycontactid@odata.bind'] = c.primaryContactId ? bind('contacts', c.primaryContactId) : null
  if (c.origin !== undefined) b.caseorigincode = c.origin
  if (c.productId !== undefined) b['productid@odata.bind'] = c.productId ? bind('products', c.productId) : null
  if (c.categoryId !== undefined) b['new_Issue@odata.bind'] = c.categoryId ? bind('new_issuecategories', c.categoryId) : null
  if (c.subcategoryId !== undefined) b['new_SubCategory@odata.bind'] = c.subcategoryId ? bind('new_subcategories', c.subcategoryId) : null
  if (c.vertical !== undefined) b.new_verticaltype = c.vertical
  if (c.customerType !== undefined) b.new_customertype = c.customerType
  if (c.priority !== undefined) b.prioritycode = c.priority
  if (c.caseType !== undefined) b.casetypecode = c.caseType
  if (c.category !== undefined) b.new_category = c.category
  if (c.consideredAs !== undefined) b.k7_caseconsideredas = c.consideredAs
  if (c.productVersion !== undefined) b.k7_productversion = c.productVersion
  if (c.serial !== undefined) b.k7_2ndserialnumber = c.serial
  if (c.module !== undefined) b.k7_module = c.module
  if (c.submodule !== undefined) b.k7_submodule = c.submodule
  if (c.customerEmail !== undefined) b.k7_customeremail = c.customerEmail
  if (c.stepsToReproduce !== undefined) b.adx_stepstoreproduce = c.stepsToReproduce
  if (c.createdBy !== undefined) b.adx_createdbyusername = c.createdBy
  if (c.ownerId !== undefined) b['ownerid@odata.bind'] = bind('systemusers', c.ownerId)
  if (c.status !== undefined) b.statuscode = c.status
  // Lookups cleared with null need the navigation-property form; drop the @odata.bind key for those.
  for (const k of Object.keys(b)) if (b[k] === null && k.endsWith('@odata.bind')) delete b[k]
  return b
}

/** Creates a case and returns its id and number (autonumber assigned by Dataverse). */
export const createCase = async (auth: DataverseAuth, input: NewCase): Promise<{ id: string; ticket: string }> => {
  const r = await callDataverse<{ incidentid: string; ticketnumber: string }>(auth, 'POST', 'incidents', { body: caseBody(input), prefer: ['return=representation'] })
  return { id: r.incidentid, ticket: r.ticketnumber }
}

/** Only the fields given are sent (07-production-safety.md §3). */
export const updateCase = async (auth: DataverseAuth, id: string, patch: Partial<NewCase> & { statuscode?: number }, etag = '*'): Promise<void> => {
  const body = caseBody(patch)
  if (patch.statuscode !== undefined) body.statuscode = patch.statuscode
  await update(auth, entity('incidents', id), body, etag)
}

export type ResolveInput = { status: typeof STATUS.CLOSED_CALL | typeof STATUS.CLOSED_REMOTE; subject: string; remarks?: string; minutes?: number }

/** Resolve through the platform action so SLAs, plugins and the model-driven app agree (02-dataverse-integration.md §5). */
export const resolveCase = async (auth: DataverseAuth, id: string, r: ResolveInput): Promise<void> => {
  const resolution: Row = { subject: r.subject.trim().slice(0, 200), 'incidentid@odata.bind': bind('incidents', id) }
  if (r.remarks) resolution.description = r.remarks
  if (r.minutes) resolution.timespent = r.minutes
  await action(auth, 'CloseIncident', { IncidentResolution: resolution, Status: r.status })
}

export const cancelCase = async (auth: DataverseAuth, id: string): Promise<void> => {
  await update(auth, entity('incidents', id), { statecode: STATE.CANCELED, statuscode: STATUS.CANCELED })
}

export const reopenCase = async (auth: DataverseAuth, id: string): Promise<void> => {
  await update(auth, entity('incidents', id), { statecode: STATE.ACTIVE, statuscode: STATUS.OPEN })
}

export const setStatusReason = async (auth: DataverseAuth, id: string, statuscode: number): Promise<void> => {
  await update(auth, entity('incidents', id), { statuscode })
}

export const assignCase = async (auth: DataverseAuth, id: string, owner: { kind: 'user' | 'team'; id: string }): Promise<void> => {
  await update(auth, entity('incidents', id), { 'ownerid@odata.bind': bind(owner.kind === 'user' ? 'systemusers' : 'teams', owner.id) })
}

/** AddToQueue is bound to the destination queue (`queues(id)/Microsoft.Dynamics.CRM.AddToQueue`), not unbound as 02-dataverse-integration.md §5 shows. */
export const addCaseToQueue = async (auth: DataverseAuth, id: string, queueId: string): Promise<void> => {
  await action(auth, `${entity('queues', queueId)}/Microsoft.Dynamics.CRM.AddToQueue`, { Target: { incidentid: guid(id), '@odata.type': 'Microsoft.Dynamics.CRM.incident' } })
}

/* ---------- Customer scope ---------- */

export type CustomerScope = { contactId: string; accountId?: string | null; email: string }

/** Every customer query carries this. Cases owned by the contact, by their account, or where they are the primary contact. */
export const customerScopeFilter = (s: CustomerScope): string =>
  and(or(`_customerid_value eq ${guid(s.contactId)}`, `_primarycontactid_value eq ${guid(s.contactId)}`, s.accountId ? `_customerid_value eq ${guid(s.accountId)}` : null), CUSTOMER_VISIBLE_FILTER)

export const CUSTOMER_PAGE = 10

export const listCustomerCases = async (auth: DataverseAuth, scope: CustomerScope, o: { state: 'open' | 'closed'; page: number }): Promise<Page<CaseRow> & { page: number }> => {
  const filter = and(customerScopeFilter(scope), `statecode eq ${o.state === 'open' ? STATE.ACTIVE : STATE.RESOLVED}`)
  let p = await list<CaseRow>(auth, buildQuery('incidents', { select: [...CASE_LIST_SELECT], filter, orderby: 'modifiedon desc', count: true }), CUSTOMER_PAGE)
  let page = 1
  while (page < o.page && p.nextLink) {
    p = await nextPage<CaseRow>(auth, p.nextLink, CUSTOMER_PAGE)
    page++
  }
  return { ...p, page }
}

export const countCustomerCases = async (auth: DataverseAuth, scope: CustomerScope): Promise<{ open: number; waiting: number; closed: number }> => {
  const base = customerScopeFilter(scope)
  const [open, closed] = await Promise.all([
    list<CaseRow>(auth, buildQuery('incidents', { select: ['incidentid', 'statuscode'], filter: and(base, `statecode eq ${STATE.ACTIVE}`), count: true }), 50),
    list<CaseRow>(auth, buildQuery('incidents', { select: ['incidentid'], filter: and(base, `statecode eq ${STATE.RESOLVED}`), count: true, top: 1 }), 1),
  ])
  return { open: open.total ?? open.value.length, waiting: open.value.filter((c) => c.statuscode === STATUS.IN_PROGRESS_CUSTOMER).length, closed: closed.total ?? 0 }
}

export const getCustomerCase = async (auth: DataverseAuth, scope: CustomerScope, ticket: string): Promise<CaseRow | null> => {
  const p = await list<CaseRow>(auth, buildQuery('incidents', { select: [...CASE_SELECT], filter: and(customerScopeFilter(scope), `ticketnumber eq ${str(ticket.trim().toUpperCase())}`), top: 1 }), 1)
  return p.value[0] ?? null
}

export type CustomerNewCase = { title: string; description: string; productId?: string; categoryId?: string; subcategoryId?: string; productVersion?: string; serial?: string; vertical?: number }

/** A case raised from the portal: origin Web, customer = the contact (or their account), attribution in adx_createdbyusername. */
export const createCustomerCase = async (auth: DataverseAuth, scope: CustomerScope, c: CustomerNewCase): Promise<{ id: string; ticket: string }> =>
  createCase(auth, {
    title: c.title,
    description: c.description,
    customer: scope.accountId ? { kind: 'account', id: scope.accountId } : { kind: 'contact', id: scope.contactId },
    // Dynamics refuses a primary contact on a case whose customer is that same contact (0x8004f865); it belongs to account cases.
    primaryContactId: scope.accountId ? scope.contactId : undefined,
    origin: ORIGIN_WEB,
    productId: c.productId,
    categoryId: c.categoryId,
    subcategoryId: c.subcategoryId,
    productVersion: c.productVersion,
    serial: c.serial,
    vertical: c.vertical,
    customerEmail: scope.email,
    createdBy: scope.email,
    status: STATUS.OPEN,
  })

/** Customers may reopen a resolved case within the window; the check happens in the caller with canReopen(). */
export const reopenCustomerCase = async (auth: DataverseAuth, scope: CustomerScope, ticket: string): Promise<CaseRow | null> => {
  const c = await getCustomerCase(auth, scope, ticket)
  if (!c) return null
  await reopenCase(auth, c.incidentid)
  return c
}

/* ---------- Workspace counters ---------- */

export const myCounts = async (auth: DataverseAuth, userId: string): Promise<{ active: number; waiting: number; critical: number; resolvedToday: number }> => {
  const mine = `_ownerid_value eq ${guid(userId)}`
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const [active, resolved] = await Promise.all([
    list<CaseRow>(auth, buildQuery('incidents', { select: ['incidentid', 'statuscode', 'prioritycode'], filter: and(mine, `statecode eq ${STATE.ACTIVE}`), count: true }), 500),
    list<CaseRow>(auth, buildQuery('incidents', { select: ['incidentid'], filter: and(mine, `statecode eq ${STATE.RESOLVED}`, `modifiedon ge ${today.toISOString()}`), count: true, top: 1 }), 1),
  ])
  return {
    active: active.total ?? active.value.length,
    waiting: active.value.filter((c) => c.statuscode === STATUS.IN_PROGRESS_CUSTOMER).length,
    critical: active.value.filter((c) => c.prioritycode === 696720000 || c.prioritycode === 1).length,
    resolvedToday: resolved.total ?? 0,
  }
}

/** Convenience for the create-case action: a brand-new case for an agent, with defaults the mobile app also applies. */
export const agentNewCase = (input: NewCase): NewCase => ({ caseType: 1, origin: 1, status: STATUS.OPEN, ...input })

export { create as _create }
