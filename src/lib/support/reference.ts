import 'server-only'

import { buildQuery, guid, list, nextPage, type DataverseAuth, type Row, fv } from '@/lib/dataverse'

import { HOUR, memo } from './memo'

/* Reference data (01-requirements.md §4.5, 02-dataverse-integration.md §4b): products, issue categories and sub-categories,
   geography, agents, teams and public queues. Cached per process for an hour; the first caller's token fetches them. */

/** Walks every page of a query (reference tables only; never for per-user lists). */
const all = async <T extends Row = Row>(auth: DataverseAuth, query: string, pageSize = 500): Promise<T[]> => {
  const out: T[] = []
  let page = await list<T>(auth, query, pageSize)
  out.push(...page.value)
  while (page.nextLink) {
    page = await nextPage<T>(auth, page.nextLink, pageSize)
    out.push(...page.value)
  }
  return out
}

export type Product = { id: string; name: string; marketingName: string; number: string; users: string; years: string; family: string }

/** Marketing name over CRM name; the family strips the user/year suffix ("Total Security - 5U3Y" → "Total Security"). */
export const productFamily = (name: string): string =>
  name
    .replace(/\s*[-–]?\s*\d+\s*U\s*\d+\s*[MY]\b.*$/i, '') // "Total Security - 5U3Y"
    .replace(/\s*[-–]\s*\d+\s*U\s*\/\s*\d+\s*Y.*$/i, '') // "Total Security - 10U/1Y"
    .replace(/\s*[-–]\s*>?\s*\d+(?:\s*to\s*\d+)?\s*U?\s*[-–]\s*\d+\s*Y\b.*$/i, '') // "CS - Grp - 10 to 99U - 3 Y", "ES - Grp - > 5000 - 1 Y"
    .replace(/\s+with\s+\d+\s+Year.*$/i, '') // "… Graphene with 1 Year Support - Fresh"
    .replace(/\s+(?:Infiniti\s+Edition\s+)?\d+\s*U$/i, '') // "Ultimate Security Infiniti Edition 5U"
    .replace(/\s*[-–]\s*$/, '')
    .trim() || name

export const getProducts = (auth: DataverseAuth): Promise<Product[]> =>
  memo('ref:products', HOUR, async () => {
    const rows = await all(auth, buildQuery('products', { select: ['productid', 'name', 'productnumber', 'alletec_productnamecrm', 'alletec_noofssers', 'alletec_noofyears'], filter: 'statecode eq 0 and productstructure eq 1', orderby: 'name' }))
    return rows.map((r) => {
      const name = String(r.name ?? '')
      const marketingName = String(r.alletec_productnamecrm ?? '') || name
      return { id: String(r.productid), name, marketingName, number: String(r.productnumber ?? ''), users: String(r.alletec_noofssers ?? ''), years: String(r.alletec_noofyears ?? ''), family: productFamily(marketingName) }
    })
  })

export type ProductFamily = { name: string; representativeId: string; count: number }

/** The catalogue folded to what a customer recognises: one entry per family, carrying the first SKU's id. */
export const getProductFamilies = async (auth: DataverseAuth): Promise<ProductFamily[]> => {
  const products = await getProducts(auth)
  const fams = new Map<string, ProductFamily>()
  for (const p of products) {
    const key = p.family.toLowerCase().replace(/^k7\s+/, '')
    const f = fams.get(key)
    if (f) f.count++
    else fams.set(key, { name: p.family, representativeId: p.id, count: 1 })
  }
  return [...fams.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const getProduct = async (auth: DataverseAuth, id: string): Promise<Product | undefined> => (await getProducts(auth)).find((p) => p.id === id)

export type Category = { id: string; name: string }
export type Subcategory = { id: string; name: string; categoryId: string }

export const getCategories = (auth: DataverseAuth): Promise<Category[]> =>
  memo('ref:categories', HOUR, async () => {
    const rows = await all(auth, buildQuery('new_issuecategories', { select: ['new_issuecategoryid', 'new_issuecategory'], filter: 'statecode eq 0', orderby: 'new_issuecategory' }))
    return rows.map((r) => ({ id: String(r.new_issuecategoryid), name: String(r.new_issuecategory ?? '') }))
  })

export const getSubcategories = (auth: DataverseAuth): Promise<Subcategory[]> =>
  memo('ref:subcategories', HOUR, async () => {
    const rows = await all(auth, buildQuery('new_subcategories', { select: ['new_subcategoryid', 'new_categoryname', '_new_subtype_value'], filter: 'statecode eq 0', orderby: 'new_categoryname' }), 1000)
    return rows.map((r) => ({ id: String(r.new_subcategoryid), name: String(r.new_categoryname ?? ''), categoryId: String(r._new_subtype_value ?? '') }))
  })

/** Categories a customer may pick, with friendlier wording where the CRM label is internal shorthand. The CRM id is kept. */
export const CUSTOMER_CATEGORY_LABELS: Record<string, string> = {
  Activation: 'Activating my product',
  'Activation Procedure': 'How to activate',
  Connectivity: 'Internet or connectivity',
  Console: 'Management console',
  'Customer Support': 'Account, licence or billing',
  Endpoint: 'Endpoint protection',
  'High Security Alerts': 'Security alert',
  'Installation hang': 'Installing the product',
  Malware: 'Virus or malware',
  'Mobile Security': 'Mobile security app',
  'Operating System': 'Operating system compatibility',
  'Product Information': 'Product information',
  'protection disabled': 'Protection shows as disabled',
  'Renewals & Fresh Purchase': 'Renewal or purchase',
  'Scanning & Config': 'Scanning and settings',
  Update: 'Updates',
  'UTM - Configuration': 'UTM configuration',
  'UTM - Installation/Activation': 'UTM installation or activation',
  'UTM - Others': 'UTM, other',
}
/** CRM categories that are internal routing buckets, not something a customer would choose. */
const CUSTOMER_CATEGORY_HIDDEN = new Set(['Email ticket', 'pro', 'New Activation Flow - SMS', 'New Activation Procedure', 'VH Activation Flow & Queries'])

export const getCustomerCategories = async (auth: DataverseAuth): Promise<(Category & { label: string })[]> =>
  (await getCategories(auth))
    .filter((c) => !CUSTOMER_CATEGORY_HIDDEN.has(c.name))
    .map((c) => ({ ...c, label: CUSTOMER_CATEGORY_LABELS[c.name] ?? c.name }))
    .sort((a, b) => a.label.localeCompare(b.label))

export type Region = { id: string; name: string }
export type State = { id: string; name: string; regionId: string }
export type City = { id: string; name: string; stateId: string }

export const getRegions = (auth: DataverseAuth): Promise<Region[]> =>
  memo('ref:regions', HOUR, async () => (await all(auth, buildQuery('k7_regions', { select: ['k7_regionid', 'k7_name'], filter: 'statecode eq 0', orderby: 'k7_name' }))).map((r) => ({ id: String(r.k7_regionid), name: String(r.k7_name ?? '') })))

export const getStates = (auth: DataverseAuth): Promise<State[]> =>
  memo('ref:states', HOUR, async () => (await all(auth, buildQuery('k7_states', { select: ['k7_stateid', 'k7_state', '_k7_region_value'], filter: 'statecode eq 0', orderby: 'k7_state' }))).map((r) => ({ id: String(r.k7_stateid), name: String(r.k7_state ?? ''), regionId: String(r._k7_region_value ?? '') })))

export const getCities = (auth: DataverseAuth, stateId: string): Promise<City[]> =>
  memo(`ref:cities:${guid(stateId)}`, HOUR, async () => (await all(auth, buildQuery('alletec_cities', { select: ['alletec_cityid', 'alletec_name', '_alletec_state_value'], filter: `_alletec_state_value eq ${guid(stateId)} and statecode eq 0`, orderby: 'alletec_name' }), 1000)).map((r) => ({ id: String(r.alletec_cityid), name: String(r.alletec_name ?? ''), stateId: String(r._alletec_state_value ?? '') })))

export type Agent = { id: string; name: string; email: string }
export const getAgents = (auth: DataverseAuth): Promise<Agent[]> =>
  memo('ref:agents', HOUR, async () =>
    (await all(auth, buildQuery('systemusers', { select: ['systemuserid', 'fullname', 'internalemailaddress'], filter: 'isdisabled eq false and accessmode eq 0 and islicensed eq true', orderby: 'fullname' }))).map((r) => ({ id: String(r.systemuserid), name: String(r.fullname ?? ''), email: String(r.internalemailaddress ?? '') })),
  )

export type Team = { id: string; name: string }
export const getTeams = (auth: DataverseAuth): Promise<Team[]> =>
  memo('ref:teams', HOUR, async () =>
    (await all(auth, buildQuery('teams', { select: ['teamid', 'name'], filter: "teamtype eq 0 and not contains(name,'_1')", orderby: 'name' })))
      .map((r) => ({ id: String(r.teamid), name: String(r.name ?? '') }))
      .filter((t) => !/^[0-9a-f]{32}_\d+$/i.test(t.name)),
  )

export type Queue = { id: string; name: string }
export const getPublicQueues = (auth: DataverseAuth): Promise<Queue[]> =>
  memo('ref:queues', HOUR, async () => (await all(auth, buildQuery('queues', { select: ['queueid', 'name'], filter: 'queueviewtype eq 0 and statecode eq 0', orderby: 'name' }))).map((r) => ({ id: String(r.queueid), name: String(r.name ?? '') })))

/** Display name for a product id, for rows that only carry the lookup. */
export const productLabel = (row: Row): string => fv(row, '_productid_value')
