import { PARTNER_TYPES, type PartnerType } from './settings-model'

/* The collateral library as the code reads it (01-requirements.md §6, 02-build-plan.md M6): an item is a title filed under a
   product and a category with a visibility rule; its file is the newest row of `partner-collateral-files`, each row one
   version. Everything here is pure (the visibility rule, the file kinds, the filters, the grouping, the Range header) and tested
   without a tenant; `collateral.ts` does the reading. */

export const COLLATERAL_CATEGORIES = ['brochure', 'datasheet', 'presentation', 'caseStudy', 'video', 'brand', 'social', 'email', 'other'] as const
export type CollateralCategory = (typeof COLLATERAL_CATEGORIES)[number]
export const COLLATERAL_CATEGORY_LABEL: Record<CollateralCategory, string> = {
  brochure: 'Brochures',
  datasheet: 'Datasheets',
  presentation: 'Presentations',
  caseStudy: 'Case studies',
  video: 'Videos',
  brand: 'Logos and brand guidelines',
  social: 'Social media creatives',
  email: 'Email templates',
  other: 'Other',
}
export const COLLATERAL_CATEGORY_OPTIONS = COLLATERAL_CATEGORIES.map((value) => ({ value, label: COLLATERAL_CATEGORY_LABEL[value] }))

export const COLLATERAL_STATUSES = ['draft', 'published', 'retired'] as const
export type CollateralStatus = (typeof COLLATERAL_STATUSES)[number]
export const COLLATERAL_STATUS_LABEL: Record<CollateralStatus, string> = { draft: 'Draft', published: 'Published', retired: 'Retired' }

/** FR-MKT-02: PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, JPG/PNG, SVG, MP4 and ZIP. The kinds group them for the filter and the tag. */
export const COLLATERAL_KINDS = ['pdf', 'presentation', 'document', 'spreadsheet', 'image', 'video', 'archive', 'other'] as const
export type CollateralKind = (typeof COLLATERAL_KINDS)[number]
export const COLLATERAL_KIND_LABEL: Record<CollateralKind, string> = { pdf: 'PDF', presentation: 'Presentation', document: 'Document', spreadsheet: 'Spreadsheet', image: 'Image', video: 'Video', archive: 'Zip', other: 'File' }

const MIME_KIND: Record<string, CollateralKind> = {
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/svg+xml': 'image',
  'video/mp4': 'video',
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
}
export const COLLATERAL_MIME = Object.keys(MIME_KIND)
const EXT_KIND: Record<string, CollateralKind> = { pdf: 'pdf', ppt: 'presentation', pptx: 'presentation', doc: 'document', docx: 'document', xls: 'spreadsheet', xlsx: 'spreadsheet', jpg: 'image', jpeg: 'image', png: 'image', svg: 'image', mp4: 'video', zip: 'archive' }

/** The kind of a file from its mime type, falling back to the extension (browsers send `application/octet-stream` for some). */
export const fileKind = (mime: string, name = ''): CollateralKind => MIME_KIND[mime.toLowerCase()] ?? EXT_KIND[(name.split('.').pop() ?? '').toLowerCase()] ?? 'other'

/** The file extension in upper case for the ledger (PDF, PPTX, MP4). */
export const fileExt = (name: string): string => {
  const ext = name.includes('.') ? (name.split('.').pop() ?? '') : ''
  return ext.slice(0, 5).toUpperCase()
}

/** The hard ceiling the server accepts (payload.config's upload limit); the settings may only lower it. */
export const COLLATERAL_HARD_MAX_MB = 200

export type Visibility = { types: PartnerType[]; certified: boolean; countries: string[]; regions: string[] }
export const OPEN_VISIBILITY: Visibility = { types: [], certified: false, countries: [], regions: [] }

export type CollateralFile = { id: string; itemId: string; version: string; note: string; name: string; mime: string; size: number; kind: CollateralKind; uploadedBy: string; at: string }

export type CollateralItem = {
  id: string
  title: string
  description: string
  productId: string
  productName: string
  productFamily: string
  category: CollateralCategory
  tags: string[]
  status: CollateralStatus
  visibility: Visibility
  order: number
  publishedAt: string | null
  retiredAt: string | null
  updatedAt: string
  createdAt: string
  /** The newest file; null while nothing has been uploaded (the item cannot be shown). */
  file: CollateralFile | null
  /** How many files the item carries (its versions). */
  versions: number
}

type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => s(x).trim()).filter(Boolean) : [])
const d = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

export const toVisibility = (x: unknown): Visibility => {
  const v = (x && typeof x === 'object' ? x : {}) as Doc
  return {
    types: strs(v.types).filter((t): t is PartnerType => (PARTNER_TYPES as readonly string[]).includes(t)),
    certified: v.certified === true,
    countries: strs(v.countries),
    regions: strs(v.regions),
  }
}

export const toCollateralFile = (x: Doc): CollateralFile => {
  const item = x.item
  const name = s(x.filename)
  const mime = s(x.mimeType)
  return {
    id: s(x.id),
    itemId: s(typeof item === 'object' && item !== null ? (item as Doc).id : item),
    version: s(x.version).trim() || '1',
    note: s(x.note),
    name,
    mime,
    size: typeof x.filesize === 'number' ? x.filesize : Number(x.filesize) || 0,
    kind: fileKind(mime, name),
    uploadedBy: s(x.uploadedBy),
    at: s(x.createdAt),
  }
}

export const toCollateralItem = (x: Doc, files: CollateralFile[] = []): CollateralItem => {
  const product = x.product
  const p = (typeof product === 'object' && product !== null ? product : {}) as Doc
  const sorted = [...files].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : Number(b.id) - Number(a.id)))
  return {
    id: s(x.id),
    title: s(x.title),
    description: s(x.description),
    productId: s(typeof product === 'object' && product !== null ? p.id : product),
    productName: s(p.name),
    productFamily: s(p.family),
    category: (COLLATERAL_CATEGORIES as readonly string[]).includes(s(x.category)) ? (s(x.category) as CollateralCategory) : 'other',
    tags: strs(x.tags),
    status: (COLLATERAL_STATUSES as readonly string[]).includes(s(x.status)) ? (s(x.status) as CollateralStatus) : 'draft',
    visibility: toVisibility(x.visibility),
    order: typeof x.order === 'number' ? x.order : 100,
    publishedAt: d(x.publishedAt),
    retiredAt: d(x.retiredAt),
    updatedAt: s(x.updatedAt),
    createdAt: s(x.createdAt),
    file: sorted[0] ?? null,
    versions: sorted.length,
  }
}

/** What the rule needs to know about the reading organisation. */
export type Reader = { type: PartnerType; country: string; regions: string[]; certificate: { status: string; until: string | null } }

const norm = (v: string): string => v.trim().toLowerCase()

/** Whether the organisation holds a valid certificate today (M11 issues them; until then nobody does). */
export const isCertified = (r: Reader, today = new Date()): boolean => {
  if (r.certificate.status !== 'valid') return false
  if (!r.certificate.until) return true
  return new Date(r.certificate.until).getTime() >= today.getTime() - 24 * 3600 * 1000
}

/** FR-MKT-03: the item's rule against the organisation. An empty list means everyone; the lists are ANDed. */
export const visibleTo = (v: Visibility, r: Reader, today = new Date()): boolean => {
  if (v.types.length && !v.types.includes(r.type)) return false
  if (v.certified && !isCertified(r, today)) return false
  if (v.countries.length && !v.countries.some((c) => norm(c) === norm(r.country))) return false
  if (v.regions.length && !v.regions.some((c) => r.regions.some((mine) => norm(mine) === norm(c)))) return false
  return true
}

/** What the partner may read: published, with a file, visible. */
export const readableBy = (item: CollateralItem, r: Reader, today = new Date()): boolean => item.status === 'published' && item.file !== null && visibleTo(item.visibility, r, today)

/** The rule in words, for the K7 ledger. */
export const visibilityText = (v: Visibility, typeLabel: (t: PartnerType) => string, regionName: (code: string) => string = (c) => c): string => {
  const parts: string[] = []
  if (v.types.length) parts.push(v.types.map(typeLabel).join(', '))
  if (v.certified) parts.push('certified only')
  if (v.countries.length) parts.push(v.countries.join(', '))
  if (v.regions.length) parts.push(`regions ${v.regions.map(regionName).join(', ')}`)
  return parts.length ? parts.join(' · ') : 'Every partner'
}

export type LibraryFilter = { q?: string; productId?: string; category?: string; kind?: string }

const hay = (i: CollateralItem): string => [i.title, i.description, i.productName, i.productFamily, COLLATERAL_CATEGORY_LABEL[i.category], ...i.tags, i.file?.name ?? '', i.file?.version ?? ''].join(' ').toLowerCase()

/** The library's filters: a search over title, description, product, category, tags and the file name; product; category; kind. */
export const filterLibrary = (items: CollateralItem[], f: LibraryFilter): CollateralItem[] => {
  const words = (f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  return items.filter((i) => {
    if (f.productId && (f.productId === 'none' ? i.productId !== '' : i.productId !== f.productId)) return false
    if (f.category && i.category !== f.category) return false
    if (f.kind && (i.file?.kind ?? 'other') !== f.kind) return false
    if (words.length) {
      const h = hay(i)
      if (!words.every((w) => h.includes(w))) return false
    }
    return true
  })
}

export type LibraryGroup = { key: string; product: string; family: string; categories: { category: CollateralCategory; items: CollateralItem[] }[] }

const byOrder = (a: CollateralItem, b: CollateralItem): number => a.order - b.order || a.title.localeCompare(b.title)

/** FR-MKT-01: by product (the programme's own material first, then products by family and name), within that by category in
    the catalogue's order, within that by the item's order and title. */
export const groupLibrary = (items: CollateralItem[], programmeLabel = 'K7 and the programme'): LibraryGroup[] => {
  const groups = new Map<string, LibraryGroup>()
  for (const i of items) {
    const key = i.productId || ''
    let g = groups.get(key)
    if (!g) {
      g = { key, product: i.productId ? i.productName || 'Product' : programmeLabel, family: i.productFamily, categories: [] }
      groups.set(key, g)
    }
    let c = g.categories.find((x) => x.category === i.category)
    if (!c) {
      c = { category: i.category, items: [] }
      g.categories.push(c)
    }
    c.items.push(i)
  }
  const out = [...groups.values()]
  for (const g of out) {
    g.categories.sort((a, b) => COLLATERAL_CATEGORIES.indexOf(a.category) - COLLATERAL_CATEGORIES.indexOf(b.category))
    for (const c of g.categories) c.items.sort(byOrder)
  }
  return out.sort((a, b) => (a.key === '' ? -1 : b.key === '' ? 1 : a.family.localeCompare(b.family) || a.product.localeCompare(b.product)))
}

/** The RFC 9110 Range header for a file of `size` bytes: one range, or null when there is none, or 'invalid' when it cannot
    be served (416). A 200 MB video and a resumed download both need it. */
export const parseRange = (header: string | null | undefined, size: number): { start: number; end: number } | null | 'invalid' => {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || size <= 0) return m ? 'invalid' : null
  const [, a, b] = m
  if (a === '' && b === '') return 'invalid'
  let start: number
  let end: number
  if (a === '') {
    const suffix = Number(b)
    if (suffix === 0) return 'invalid'
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(a)
    end = b === '' ? size - 1 : Math.min(Number(b), size - 1)
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= size || start > end) return 'invalid'
  return { start, end }
}

/** Whether a name and mime are one of FR-MKT-02's types (the admin upload is checked by Payload; the seed and tests use this). */
export const acceptedCollateral = (name: string, mime: string): boolean => fileKind(mime, name) !== 'other'

/** The version string a new upload should carry when the admin leaves it blank: the previous one bumped, or 1. */
export const nextVersion = (previous: string | null | undefined): string => {
  if (!previous) return '1'
  const m = /^(.*?)(\d+)$/.exec(previous.trim())
  if (!m) return `${previous.trim()}.1`
  return `${m[1]}${Number(m[2]) + 1}`
}
