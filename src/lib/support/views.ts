import 'server-only'

import { buildQuery, condition, fetchXml, layoutCells, likeAny, list, rootAttributes, shapeFetchXml, type DataverseAuth, type Row, fv } from '@/lib/dataverse'

import { HOUR, memo } from './memo'

/* The 21 case views of the model-driven app, run from their own FetchXML so the portal adds paging, sort and search without
   re-implementing a single filter (01-requirements.md §4.3, 02-dataverse-integration.md §4a). */

export type View = { id: string; name: string; fetchxml: string; layoutxml: string; columns: { name: string; width: number }[]; isDefault: boolean; group: ViewGroup }
export type ViewGroup = 'mine' | 'operations' | 'service-requests' | 'reports'

/** The phase-1 set, in the order the workspace shows them. */
export const PHASE1_VIEWS = ['My Active Cases', 'My Resolved Cases', 'Active Cases', 'Email Cases - Open', 'FCR Cases'] as const

const groupOf = (name: string): ViewGroup => {
  if (/^my /i.test(name)) return 'mine'
  if (/service request|sr -|poc|technical discussion/i.test(name)) return 'service-requests'
  if (/report|daily|monthly|customer connect|onboarding|audit|dashboard|recent|survey/i.test(name)) return 'reports'
  return 'operations'
}

export const listCaseViews = (auth: DataverseAuth): Promise<View[]> =>
  memo('views:incident', HOUR, async () => {
    const p = await list<Row>(auth, buildQuery('savedqueries', { select: ['savedqueryid', 'name', 'fetchxml', 'layoutxml', 'isdefault'], filter: "returnedtypecode eq 'incident' and statecode eq 0 and querytype eq 0", orderby: 'name' }), 100)
    const views = p.value
      .filter((v) => v.fetchxml && v.layoutxml)
      .map((v) => ({ id: String(v.savedqueryid), name: String(v.name), fetchxml: String(v.fetchxml), layoutxml: String(v.layoutxml), columns: layoutCells(String(v.layoutxml)), isDefault: v.isdefault === true, group: groupOf(String(v.name)) }))
    const rank = (v: View) => {
      const i = (PHASE1_VIEWS as readonly string[]).indexOf(v.name)
      return i >= 0 ? i : 100
    }
    return views.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  })

export const getView = async (auth: DataverseAuth, idOrName: string): Promise<View | undefined> => {
  const views = await listCaseViews(auth)
  return views.find((v) => v.id === idOrName.toLowerCase() || v.name.toLowerCase() === idOrName.toLowerCase())
}

/** Column headings for the logical names the views use. Anything else is humanised. */
export const COLUMN_LABEL: Record<string, string> = {
  ticketnumber: 'Case',
  title: 'Title',
  customerid: 'Customer',
  primarycontactid: 'Contact',
  statuscode: 'Status',
  statecode: 'State',
  caseorigincode: 'Origin',
  createdon: 'Created',
  modifiedon: 'Modified',
  createdby: 'Created by',
  modifiedby: 'Modified by',
  ownerid: 'Owner',
  prioritycode: 'Priority',
  productid: 'Product',
  new_issue: 'Issue',
  new_subcategory: 'Sub category',
  new_customertype: 'Customer type',
  new_verticaltype: 'Vertical',
  k7_caseconsideredas: 'FCR',
  k7_assigndate: 'Assigned',
  escalatedon: 'Escalated',
  followupby: 'Follow up',
  casetypecode: 'Type',
  description: 'Description',
  k7_customeremail: 'Customer email',
  k7_productversion: 'Version',
  k7_2ndserialnumber: 'Serial',
  resolvebyslastatus: 'Resolve SLA',
  firstresponseslastatus: 'Response SLA',
  k7_srstatus: 'SR status',
  k7_servicerequesttype: 'SR type',
  k7_salespersonname: 'Sales person',
  cit_productcategory: 'Product category',
  new_category: 'Category',
  k7_module: 'Module',
  k7_submodule: 'Sub module',
}
export const columnLabel = (name: string): string => COLUMN_LABEL[name] ?? name.replace(/^(k7_|new_|adx_|cit_|alletec_)/, '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

const LOOKUPS = new Set(['customerid', 'primarycontactid', 'ownerid', 'productid', 'new_issue', 'new_subcategory', 'createdby', 'modifiedby', 'k7_rfe', 'k7_defectnew', 'slaid'])
const DATES = new Set(['createdon', 'modifiedon', 'k7_assigndate', 'escalatedon', 'followupby', 'resolveby', 'responseby'])

/** The display value of a view column on a row. */
export const cellValue = (row: Row, name: string): string => (LOOKUPS.has(name) ? fv(row, `_${name}_value`) : fv(row, name))
export const cellKind = (name: string): 'id' | 'title' | 'date' | 'status' | 'text' =>
  name === 'ticketnumber' ? 'id' : name === 'title' ? 'title' : DATES.has(name) ? 'date' : name === 'statuscode' ? 'status' : 'text'

export const VIEW_PAGE = 25

export type RunViewOptions = { page?: number; q?: string; sort?: string; dir?: 'asc' | 'desc'; pageSize?: number }
export type ViewResult = { rows: Row[]; total?: number; totalLimitExceeded?: boolean; more: boolean; page: number; columns: { name: string; label: string; kind: ReturnType<typeof cellKind> }[]; sort?: string; dir: 'asc' | 'desc' }

/** Runs a view as the signed-in user: its own filters, plus a text search, a sort override and a page. */
export const runCaseView = async (auth: DataverseAuth, view: View, o: RunViewOptions = {}): Promise<ViewResult> => {
  const page = Math.max(1, o.page ?? 1)
  const count = o.pageSize ?? VIEW_PAGE
  const attrs = rootAttributes(view.fetchxml)
  const sortable = o.sort && (attrs.includes(o.sort) || view.columns.some((c) => c.name === o.sort)) ? o.sort : undefined
  const dir = o.dir ?? (sortable && (sortable === 'createdon' || sortable === 'modifiedon') ? 'desc' : 'asc')
  const q = o.q?.trim()
  const conditions: string[] = []
  if (q) conditions.push(/^cs-/i.test(q) ? condition('ticketnumber', 'like', `${q.toUpperCase()}%`) : likeAny(['title', 'ticketnumber', 'k7_customeremail', 'description'], q))
  const xml = shapeFetchXml(view.fetchxml, {
    page,
    count,
    returnTotal: true,
    order: sortable ? { attribute: sortable, descending: dir === 'desc' } : undefined,
    conditions,
    ensureAttributes: ['incidentid', 'statuscode', 'statecode', 'prioritycode', 'ticketnumber', 'title', 'customerid', ...view.columns.map((c) => c.name).filter((n) => !n.includes('.'))],
  })
  const r = await fetchXml<Row>(auth, 'incidents', xml)
  return {
    rows: r.value,
    total: r.total,
    totalLimitExceeded: r.totalLimitExceeded,
    more: Boolean(r.moreRecords),
    page,
    columns: view.columns.filter((c) => !c.name.includes('.')).map((c) => ({ name: c.name, label: columnLabel(c.name), kind: cellKind(c.name) })),
    sort: sortable,
    dir,
  }
}
