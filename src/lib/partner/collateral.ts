import 'server-only'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import { COLLATERAL_DIR } from '@/collections/partner/PartnerCollateralFiles'

import { audit } from './audit'
import { filterLibrary, readableBy, toCollateralFile, toCollateralItem, type CollateralFile, type CollateralItem, type CollateralStatus, type LibraryFilter, type Reader } from './collateral-model'
import { serveStoredFile } from './files'
import type { PartnerContext } from './session'
import type { PartnerOrg } from './users'

/* The collateral library (01-requirements.md §6, M6). The Marketing Admin writes it in the Payload admin; this file only reads
   it for the two audiences and serves the bytes. The partner side reads through `me`: an item is theirs to see when it is
   published, has a file and its visibility rule (FR-MKT-03) holds for their organisation; the check runs again on the download
   route, which is the only way to the file (the directory is outside public/). Every download is one audit row on the
   organisation, which is what the K7 ledger counts. The K7 side reads every item in every state. */

export const PARTNER_COLLATERAL = '/partners/portal/collateral'
export const K7_COLLATERAL = '/partners/portal/k7/collateral'
const DOWNLOAD_ACTION = 'collateral.download'

const db = () => getPayload({ config: configPromise })
type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const rel = (id: string): number | string => (/^\d+$/.test(id) ? Number(id) : id)

export const readerOf = (org: PartnerOrg): Reader => ({ type: org.type, country: org.country, regions: org.regions, certificate: org.certificate })

const filesOf = async (itemIds: string[]): Promise<Map<string, CollateralFile[]>> => {
  const out = new Map<string, CollateralFile[]>()
  if (!itemIds.length) return out
  const payload = await db()
  for (let i = 0; i < itemIds.length; i += 100) {
    const slice = itemIds.slice(i, i + 100).map(rel)
    const r = await payload.find({ collection: 'partner-collateral-files', where: { item: { in: slice } }, limit: 2000, depth: 0, sort: '-createdAt', overrideAccess: true })
    for (const doc of r.docs as unknown as Doc[]) {
      const f = toCollateralFile(doc)
      const list = out.get(f.itemId) ?? []
      list.push(f)
      out.set(f.itemId, list)
    }
  }
  return out
}

const itemsFrom = async (docs: Doc[]): Promise<CollateralItem[]> => {
  const files = await filesOf(docs.map((d) => s(d.id)))
  return docs.map((d) => toCollateralItem(d, files.get(s(d.id)) ?? []))
}

/** Every item in the given state (K7), newest change first; `'all'` for the whole library. */
export const listCollateral = async (status: CollateralStatus | 'all' = 'all'): Promise<CollateralItem[]> => {
  const payload = await db()
  const where: Where = status === 'all' ? {} : { status: { equals: status } }
  const r = await payload.find({ collection: 'partner-collateral', where, limit: 1000, depth: 1, sort: '-updatedAt', overrideAccess: true })
  return itemsFrom(r.docs as unknown as Doc[])
}

/** The partner's library: the items their organisation may read, then the page's filters over them. `all` is before the
    filters (for the filter options and the empty states); `items` after. */
export const libraryFor = async (me: PartnerContext, filter: LibraryFilter = {}): Promise<{ all: CollateralItem[]; items: CollateralItem[] }> => {
  const reader = readerOf(me.org)
  const published = await listCollateral('published')
  const all = published.filter((i) => readableBy(i, reader))
  return { all, items: filterLibrary(all, filter) }
}

/** How many items the organisation may read, for the home page. */
export const collateralCountFor = async (me: PartnerContext): Promise<number> => (await libraryFor(me)).all.length

const loadItem = async (id: string): Promise<CollateralItem | null> => {
  if (!/^\d+$/.test(id)) return null
  try {
    const payload = await db()
    const doc = (await payload.findByID({ collection: 'partner-collateral', id: Number(id), depth: 1, overrideAccess: true })) as unknown as Doc
    const [item] = await itemsFrom([doc])
    return item ?? null
  } catch {
    return null
  }
}

/** One item for the partner: null unless their organisation may read it (the same rule as the list). */
export const loadCollateralFor = async (me: PartnerContext, id: string): Promise<CollateralItem | null> => {
  const item = await loadItem(id)
  return item && readableBy(item, readerOf(me.org)) ? item : null
}

/** One item for K7, in any state. */
export const loadCollateralK7 = async (id: string): Promise<CollateralItem | null> => loadItem(id)

/** A specific version of an item's file (K7 reads earlier versions; partners get the newest through `item.file`). */
export const collateralFileById = async (item: CollateralItem, fileId: string): Promise<CollateralFile | null> => {
  if (!/^\d+$/.test(fileId)) return null
  try {
    const payload = await db()
    const doc = (await payload.findByID({ collection: 'partner-collateral-files', id: Number(fileId), depth: 0, overrideAccess: true })) as unknown as Doc
    const f = toCollateralFile(doc)
    return f.itemId === item.id ? f : null
  } catch {
    return null
  }
}

/** One audit row per download, on the organisation: who took which version of what. */
export const recordDownload = async (me: PartnerContext, item: CollateralItem, file: CollateralFile): Promise<void> => {
  await audit({ actor: me.actor, object: 'partner-collateral', objectId: item.id, objectLabel: item.title, action: DOWNLOAD_ACTION, orgId: me.scope.orgId, comment: `v${file.version} · ${file.name}`, meta: { fileId: file.id, version: file.version, size: file.size, category: item.category, productId: item.productId } })
}

export type DownloadTally = { total: number; last30: number; orgs: number }

/** Downloads per item from the audit rows: all time, the last 30 days, and how many organisations. */
export const downloadTallies = async (itemIds?: string[]): Promise<Map<string, DownloadTally>> => {
  const payload = await db()
  const where: Where = { and: [{ object: { equals: 'partner-collateral' } }, { action: { equals: DOWNLOAD_ACTION } }, ...(itemIds?.length ? [{ objectId: { in: itemIds } }] : [])] }
  const r = await payload.find({ collection: 'partner-audit', where, limit: 10000, depth: 0, sort: '-createdAt', overrideAccess: true, select: { objectId: true, orgId: true, createdAt: true } })
  const since = Date.now() - 30 * 24 * 3600 * 1000
  const out = new Map<string, DownloadTally & { set: Set<string> }>()
  for (const doc of r.docs as unknown as Doc[]) {
    const id = s(doc.objectId)
    const t = out.get(id) ?? { total: 0, last30: 0, orgs: 0, set: new Set<string>() }
    t.total += 1
    if (new Date(s(doc.createdAt)).getTime() >= since) t.last30 += 1
    if (s(doc.orgId)) t.set.add(s(doc.orgId))
    out.set(id, t)
  }
  const result = new Map<string, DownloadTally>()
  for (const [id, t] of out) result.set(id, { total: t.total, last30: t.last30, orgs: t.set.size })
  return result
}

export type CollateralCounts = { published: number; draft: number; retired: number; withoutFile: number; downloads30: number }

/** The K7 desk's counters. */
export const collateralCounts = async (): Promise<CollateralCounts> => {
  const [items, tallies] = await Promise.all([listCollateral('all'), downloadTallies()])
  let downloads30 = 0
  for (const t of tallies.values()) downloads30 += t.last30
  return {
    published: items.filter((i) => i.status === 'published').length,
    draft: items.filter((i) => i.status === 'draft').length,
    retired: items.filter((i) => i.status === 'retired').length,
    withoutFile: items.filter((i) => i.status !== 'retired' && !i.file).length,
    downloads30,
  }
}

/** The bytes, after the caller's check (the shared helper in files.ts): whole or by range, inline for PDFs, images and video. */
export const serveCollateralFile = (file: { name: string; mime: string }, req: Request, o: { inline?: boolean } = {}): Response => serveStoredFile(COLLATERAL_DIR, file, req, o)
