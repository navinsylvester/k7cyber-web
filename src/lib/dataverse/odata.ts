/* Tiny OData helpers: safe literals, filter composition and query building. No raw query strings leave src/lib. */

/** A string literal for an OData filter: single quotes doubled. */
export const str = (s: string): string => `'${String(s).replace(/'/g, "''")}'`

/** A GUID literal (no quotes in Dataverse filters); refuses anything that is not a GUID. */
export const guid = (id: string): string => {
  if (!isGuid(id)) throw new Error('Invalid identifier')
  return id.toLowerCase()
}

export const isGuid = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export const and = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).map((p) => `(${p})`).join(' and ')
export const or = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).map((p) => `(${p})`).join(' or ')

/** `contains(field,'needle')` with the needle escaped. */
export const contains = (field: string, needle: string): string => `contains(${field},${str(needle)})`

export type Query = {
  select?: string[]
  filter?: string
  orderby?: string
  top?: number
  expand?: string
  count?: boolean
}

/** Builds `entitySet?$select=…&$filter=…`. Parameters are URL-encoded; `$select` always present when given. */
export const buildQuery = (entitySet: string, q: Query): string => {
  const parts: string[] = []
  if (q.select?.length) parts.push(`$select=${q.select.join(',')}`)
  if (q.filter) parts.push(`$filter=${encodeURIComponent(q.filter)}`)
  if (q.orderby) parts.push(`$orderby=${encodeURIComponent(q.orderby)}`)
  if (q.expand) parts.push(`$expand=${encodeURIComponent(q.expand)}`)
  if (q.top) parts.push(`$top=${q.top}`)
  if (q.count) parts.push('$count=true')
  return parts.length ? `${entitySet}?${parts.join('&')}` : entitySet
}

/** `entitySet(id)` with the id validated. */
export const entity = (entitySet: string, id: string): string => `${entitySet}(${guid(id)})`

/** `@odata.bind` value for a lookup. */
export const bind = (entitySet: string, id: string): string => `/${entitySet}(${guid(id)})`
