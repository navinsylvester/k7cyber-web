/* FetchXML helpers: run a saved view's own FetchXML with paging, sort and search added, so the 21 case views are reused
   as the model-driven app defines them (01-requirements.md §4.3) while the portal controls page size and ordering. */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type FetchOptions = {
  page?: number
  count?: number
  pagingCookie?: string
  /** Replace the view's own order. */
  order?: { attribute: string; descending: boolean } | null
  /** Extra conditions on the root entity, each an XML fragment such as `<condition attribute="title" operator="like" value="%x%" />`. */
  conditions?: string[]
  /** Attributes that must be in the result even if the view lacks them. */
  ensureAttributes?: string[]
  returnTotal?: boolean
}

/** A `<condition>` fragment with the value escaped. */
export const condition = (attribute: string, operator: string, value?: string): string =>
  value === undefined ? `<condition attribute="${esc(attribute)}" operator="${esc(operator)}" />` : `<condition attribute="${esc(attribute)}" operator="${esc(operator)}" value="${esc(value)}" />`

/** Search across several text attributes with `like`. */
export const likeAny = (attributes: string[], needle: string): string =>
  `<filter type="or">${attributes.map((a) => condition(a, 'like', `%${needle}%`)).join('')}</filter>`

/** Rewrites a saved view's FetchXML (or any FetchXML) with the given paging, order and extra filters. Pure string surgery,
   kept deliberately small: the views are well-formed and the fragments we add are escaped. */
export const shapeFetchXml = (xml: string, o: FetchOptions): string => {
  let out = xml
  // <fetch …>: drop existing paging attributes, add ours.
  out = out.replace(/<fetch\b([^>]*)>/, (_m, attrs: string) => {
    let a = attrs.replace(/\s(count|page|paging-cookie|returntotalrecordcount|savedqueryid|userqueryid)="[^"]*"/g, '')
    if (o.count) a += ` count="${o.count}"`
    if (o.page) a += ` page="${o.page}"`
    if (o.pagingCookie) a += ` paging-cookie="${esc(o.pagingCookie)}"`
    if (o.returnTotal) a += ' returntotalrecordcount="true"'
    return `<fetch${a}>`
  })
  // The root entity opens once; everything we add goes right after it (attributes) or into/after its filter.
  const entityOpen = out.match(/<entity\b[^>]*>/)
  if (!entityOpen) throw new Error('FetchXML without an entity')
  const at = out.indexOf(entityOpen[0]) + entityOpen[0].length
  let inject = ''
  for (const attr of o.ensureAttributes ?? []) {
    if (!new RegExp(`<attribute name="${attr}"\\s*/>`).test(out)) inject += `<attribute name="${esc(attr)}" />`
  }
  if (o.conditions?.length) inject += `<filter type="and">${o.conditions.join('')}</filter>`
  if (o.order !== undefined) {
    // Remove every root-level <order> (those inside link-entity are rare in these views and left alone by matching the root entity's direct children).
    out = out.slice(0, at) + out.slice(at).replace(/<order\b[^>]*\/>/g, (m, offset: number, s: string) => (insideLinkEntity(s, offset) ? m : ''))
    if (o.order) inject += `<order attribute="${esc(o.order.attribute)}" descending="${o.order.descending ? 'true' : 'false'}" />`
  }
  return out.slice(0, at) + inject + out.slice(at)
}

const insideLinkEntity = (s: string, offset: number): boolean => {
  const before = s.slice(0, offset)
  const opens = (before.match(/<link-entity\b/g) ?? []).length
  const closes = (before.match(/<\/link-entity>/g) ?? []).length
  return opens > closes
}

/** The attribute names a FetchXML selects on its root entity (for building table columns). */
export const rootAttributes = (xml: string): string[] => {
  const root = xml.replace(/<link-entity\b[\s\S]*?<\/link-entity>/g, '')
  return [...root.matchAll(/<attribute name="([^"]+)"/g)].map((m) => m[1]!)
}

/** The `<cell name>` list of a view's layoutxml, in display order. */
export const layoutCells = (layoutxml: string): { name: string; width: number }[] =>
  [...layoutxml.matchAll(/<cell name="([^"]+)"(?:\s+width="(\d+)")?/g)].map((m) => ({ name: m[1]!, width: Number(m[2] ?? 100) }))
