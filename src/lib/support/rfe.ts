import 'server-only'

import { and, bind, buildQuery, create, entity, guid, isGuid, list, or, retrieve, str, update, type DataverseAuth, type Row } from '@/lib/dataverse'

/* RFEs and defects (01-requirements.md §4.5): list, create, update, link to a case. Since the product desk (10-product-desk.md §6) both rows
   are mirrors of an item: created at raise, their status, priority and YODIZ id written as the item moves. */

export const RFE_SELECT = ['k7_rfeid', 'k7_rfeno', 'k7_rfetitle', 'k7_rfestatus', 'k7_rfetype', 'k7_rfemode', 'k7_numberofusers', 'k7_yodizid', 'k7_serialno', 'k7_verticaltype', 'createdon', 'modifiedon', 'statecode', '_k7_case_value', '_k7_associatedcaseno_value', '_k7_product_value', '_k7_account_value', '_ownerid_value'] as const
export const DEFECT_SELECT = ['k7_defectid', 'k7_defectno', 'k7_defecttitle', 'k7_defectstatus', 'k7_priority', 'k7_yodizid', 'k7_emailaddress', 'createdon', 'modifiedon', 'statecode', '_k7_associatedcaseno_value', '_ownerid_value'] as const

export type RfeRow = Row & { k7_rfeid: string; k7_rfetitle: string }
export type DefectRow = Row & { k7_defectid: string; k7_defecttitle: string }

export const listRfes = async (auth: DataverseAuth, o: { q?: string; top?: number } = {}): Promise<RfeRow[]> => {
  const q = o.q?.trim()
  const filter = q ? or(`contains(k7_rfetitle,${str(q)})`, `contains(k7_rfeno,${str(q)})`, `contains(k7_yodizid,${str(q)})`) : 'statecode eq 0'
  const p = await list<RfeRow>(auth, buildQuery('k7_rfes', { select: [...RFE_SELECT], filter, orderby: 'modifiedon desc', top: o.top ?? 50 }), o.top ?? 50)
  return p.value
}

export const listDefects = async (auth: DataverseAuth, o: { q?: string; top?: number } = {}): Promise<DefectRow[]> => {
  const q = o.q?.trim()
  const filter = q ? or(`contains(k7_defecttitle,${str(q)})`, `contains(k7_defectno,${str(q)})`) : undefined
  const p = await list<DefectRow>(auth, buildQuery('k7_defects', { select: [...DEFECT_SELECT], filter, orderby: 'modifiedon desc', top: o.top ?? 50 }), o.top ?? 50)
  return p.value
}

export const getRfe = async (auth: DataverseAuth, id: string): Promise<RfeRow | null> => {
  if (!isGuid(id)) return null
  return retrieve<RfeRow>(auth, `${entity('k7_rfes', id)}?$select=${RFE_SELECT.join(',')}`)
}

export const rfesOfCase = async (auth: DataverseAuth, incidentId: string): Promise<RfeRow[]> => {
  const p = await list<RfeRow>(auth, buildQuery('k7_rfes', { select: [...RFE_SELECT], filter: or(`_k7_case_value eq ${guid(incidentId)}`, `_k7_associatedcaseno_value eq ${guid(incidentId)}`), orderby: 'createdon desc', top: 10 }), 10)
  return p.value
}

export const defectsOfCase = async (auth: DataverseAuth, incidentId: string): Promise<DefectRow[]> => {
  const p = await list<DefectRow>(auth, buildQuery('k7_defects', { select: [...DEFECT_SELECT], filter: `_k7_associatedcaseno_value eq ${guid(incidentId)}`, orderby: 'createdon desc', top: 10 }), 10).catch(() => ({ value: [] as DefectRow[] }))
  return p.value
}

export type NewRfe = { title: string; type: number; status?: number; receivedFrom?: number; yodizId?: string; users?: string; serial?: string; caseId?: string; productId?: string; accountId?: string; vertical?: number }

/** Creates the RFE and, when a case is given, links it from both sides (k7_rfe on the case is set by the caller through updateCase). */
export const createRfe = async (auth: DataverseAuth, r: NewRfe): Promise<string> => {
  const b: Row = { k7_rfetitle: r.title.trim().slice(0, 200), k7_rfetype: r.type, k7_rfestatus: r.status ?? 696720001 }
  if (r.receivedFrom) b.k7_rfereceivedfrom = r.receivedFrom
  if (r.yodizId) b.k7_yodizid = r.yodizId
  if (r.users) b.k7_numberofusers = r.users
  if (r.serial) b.k7_serialno = r.serial
  if (r.vertical) b.k7_verticaltype = r.vertical
  if (r.caseId) {
    b['k7_Case@odata.bind'] = bind('incidents', r.caseId)
    b['k7_AssociatedCaseNo@odata.bind'] = bind('incidents', r.caseId)
  }
  if (r.productId) b['k7_Product@odata.bind'] = bind('products', r.productId)
  if (r.accountId) b['k7_Account@odata.bind'] = bind('accounts', r.accountId)
  return create(auth, 'k7_rfes', b)
}

export const updateRfe = async (auth: DataverseAuth, id: string, r: Partial<NewRfe>): Promise<void> => {
  const b: Row = {}
  if (r.title !== undefined) b.k7_rfetitle = r.title.trim().slice(0, 200)
  if (r.type !== undefined) b.k7_rfetype = r.type
  if (r.status !== undefined) b.k7_rfestatus = r.status
  if (r.yodizId !== undefined) b.k7_yodizid = r.yodizId
  if (r.users !== undefined) b.k7_numberofusers = r.users
  if (Object.keys(b).length) await update(auth, entity('k7_rfes', id), b)
}

export const getDefect = async (auth: DataverseAuth, id: string): Promise<DefectRow | null> => {
  if (!isGuid(id)) return null
  return retrieve<DefectRow>(auth, `${entity('k7_defects', id)}?$select=${DEFECT_SELECT.join(',')}`)
}

export type NewDefect = { title: string; status?: number; priority?: number; yodizId?: string; caseId?: string; incidentNo?: string; customer?: { kind: 'account' | 'contact'; id: string } }

/** Creates the defect row the Hub's list and the Defect dashboard read; the product desk links it to the first case of an item. */
export const createDefect = async (auth: DataverseAuth, d: NewDefect): Promise<string> => {
  const b: Row = { k7_defecttitle: d.title.trim().slice(0, 100), k7_defectstatus: d.status ?? 696720000 }
  if (d.priority) b.k7_priority = d.priority
  if (d.yodizId) b.k7_yodizid = d.yodizId
  if (d.incidentNo) b.k7_incidentid = d.incidentNo
  if (d.caseId) b['k7_AssociatedCaseNo@odata.bind'] = bind('incidents', d.caseId)
  if (d.customer) b[d.customer.kind === 'account' ? 'k7_Customer_account@odata.bind' : 'k7_Customer_contact@odata.bind'] = bind(d.customer.kind === 'account' ? 'accounts' : 'contacts', d.customer.id)
  return create(auth, 'k7_defects', b)
}

export const updateDefect = async (auth: DataverseAuth, id: string, d: Partial<NewDefect>): Promise<void> => {
  const b: Row = {}
  if (d.title !== undefined) b.k7_defecttitle = d.title.trim().slice(0, 100)
  if (d.status !== undefined) b.k7_defectstatus = d.status
  if (d.priority !== undefined) b.k7_priority = d.priority
  if (d.yodizId !== undefined) b.k7_yodizid = d.yodizId
  if (Object.keys(b).length) await update(auth, entity('k7_defects', id), b)
}

export const activeRfeFilter = and('statecode eq 0')
