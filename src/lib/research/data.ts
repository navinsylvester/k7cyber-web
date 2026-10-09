import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { getPayload, type PaginatedDocs, type Where } from 'payload'

import type { Category, Post, Threat, ThreatReport, Vulnerability } from '@/payload-types'

const db = () => getPayload({ config: configPromise })
const cached = <A extends unknown[], R>(name: string, tags: string[], fn: (...a: A) => Promise<R>) =>
  unstable_cache(fn, [name], { tags: ['research', ...tags], revalidate: 600 })

export const BLOG_PAGE = 10
export const TABLE_PAGE = 25

/* ---------------- Landing ---------------- */
export const getLabsStats = cached('labs-stats', ['research_posts', 'research_vulnerabilities', 'research_threats', 'research_threat-reports'], async () => {
  const p = await db()
  const [post, cve, threat, report, counts] = await Promise.all([
    p.find({ collection: 'posts', where: { _status: { equals: 'published' } }, sort: '-publishedAt', limit: 1, depth: 0, select: { publishedAt: true, title: true, slug: true } }),
    p.find({ collection: 'vulnerabilities', where: { _status: { equals: 'published' } }, sort: '-date', limit: 1, depth: 0, select: { date: true } }),
    p.find({ collection: 'threats', where: { _status: { equals: 'published' }, retired: { not_equals: true } }, sort: '-lastSeen', limit: 1, depth: 0, select: { lastSeen: true, avDefinitionVersion: true } }),
    p.find({ collection: 'threat-reports', where: { _status: { equals: 'published' } }, sort: '-publishedAt', limit: 1, depth: 0, select: { publishedAt: true } }),
    Promise.all([
      p.count({ collection: 'posts', where: { _status: { equals: 'published' } } }),
      p.count({ collection: 'vulnerabilities', where: { _status: { equals: 'published' } } }),
      p.count({ collection: 'threats', where: { _status: { equals: 'published' }, retired: { not_equals: true } } }),
      p.count({ collection: 'threat-reports', where: { _status: { equals: 'published' } } }),
    ]),
  ])
  return {
    latestPost: post.docs[0] ?? null,
    latestBatch: cve.docs[0]?.date ?? null,
    latestThreat: threat.docs[0]?.lastSeen ?? null,
    definitions: threat.docs[0]?.avDefinitionVersion ?? null,
    latestReport: report.docs[0]?.publishedAt ?? null,
    counts: { posts: counts[0].totalDocs, vulnerabilities: counts[1].totalDocs, threats: counts[2].totalDocs, reports: counts[3].totalDocs },
  }
})

/* ---------------- Blog ---------------- */
export type CategoryNode = Category & { children: CategoryNode[] }

export const getCategoryTree = cached('category-tree', ['research_posts'], async (): Promise<CategoryNode[]> => {
  const p = await db()
  const { docs } = await p.find({ collection: 'categories', limit: 500, depth: 0, sort: 'title', pagination: false })
  const byId = new Map<number, CategoryNode>(docs.map((c) => [c.id, { ...c, children: [] }]))
  const roots: CategoryNode[] = []
  for (const c of byId.values()) {
    const parentId = typeof c.parent === 'object' && c.parent ? c.parent.id : (c.parent as number | null | undefined)
    const parent = parentId ? byId.get(parentId) : undefined
    if (parent) parent.children.push(c)
    else roots.push(c)
  }
  return roots
})

export const findCategoryByPath = async (path: string[]): Promise<{ category: CategoryNode; ids: number[]; trail: CategoryNode[] } | null> => {
  const tree = await getCategoryTree()
  let level = tree
  const trail: CategoryNode[] = []
  for (const slug of path) {
    const hit = level.find((c) => c.slug === slug)
    if (!hit) return null
    trail.push(hit)
    level = hit.children
  }
  const cat = trail[trail.length - 1]
  if (!cat) return null
  const ids: number[] = []
  const walk = (n: CategoryNode) => {
    ids.push(n.id)
    n.children.forEach(walk)
  }
  walk(cat)
  return { category: cat, ids, trail }
}

export const categoryPath = (cat: Category): string => {
  const crumbs = (cat.breadcrumbs ?? []).map((b) => b.url?.replace(/^\//, '')).filter(Boolean)
  return crumbs.length ? crumbs[crumbs.length - 1]! : cat.slug!
}

export type PostListArgs = { page?: number; q?: string; categoryIds?: number[]; authorId?: number; limit?: number }

/* Search terms become a prefix tsquery ("trick" finds Trickbot); every term must match. "CVE-2017-0199" is three terms. */
const searchTerms = (q: string): string[] =>
  q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
    .slice(0, 8)

const emptyPage = (page: number, limit: number): PaginatedDocs<Post> => ({ docs: [], totalDocs: 0, limit, totalPages: 1, page, pagingCounter: 0, hasPrevPage: page > 1, hasNextPage: false, prevPage: page > 1 ? page - 1 : null, nextPage: null })

/* Postgres full-text search over title and tags (weight A), excerpt (B) and body (C), ranked by relevance, then date.
   Falls back to a title or tag match when the query has no searchable term (stop words only). */
const searchPosts = async ({ page, q, categoryIds, authorId, limit }: Required<Pick<PostListArgs, 'page' | 'q' | 'limit'>> & PostListArgs): Promise<PaginatedDocs<Post>> => {
  const p = await db()
  const terms = searchTerms(q)
  const phrase = `%${q.trim()}%`
  let ranked: number[] = []
  // The tag chips on a post are its categories, so their titles are indexed with the title.
  const tags = sql`(select string_agg(c.title, ' ') from posts_rels r join categories c on c.id = r.categories_id where r.parent_id = posts.id and r.path = 'categories')`
  if (terms.length) {
    const tsq = terms.map((t) => `${t}:*`).join(' & ')
    // Hyphens become spaces first: Postgres reads "CVE-2024-49112" as cve, -2024, -49112 and the digit terms would never match.
    const doc = sql`setweight(to_tsvector('english', translate(coalesce(title, '') || ' ' || coalesce(${tags}, ''), '-_/', '   ')), 'A') || setweight(to_tsvector('english', translate(coalesce(excerpt, ''), '-_/', '   ')), 'B') || setweight(to_tsvector('english', translate(coalesce(search_text, ''), '-_/', '   ')), 'C')`
    const { rows } = await (p.db as unknown as PostgresAdapter).drizzle.execute<{ id: number }>(
      sql`select id from posts, to_tsquery('english', ${tsq}) q
          where _status = 'published' and (${doc}) @@ q
          order by (title ilike ${phrase}) desc, ts_rank_cd(${doc}, q, 1) desc, published_at desc`,
    )
    ranked = rows.map((r) => Number(r.id))
  }
  if (!ranked.length && terms.length) {
    // Stop words only ("the"): match them as whole words in the title or tags instead.
    const words = terms.map((t) => sql`(coalesce(title, '') || ' ' || coalesce(${tags}, '')) ~* ${`\\m${t.replace(/[\\^$.|?*+()[\]{}]/g, '\\$&')}\\M`}`)
    const { rows } = await (p.db as unknown as PostgresAdapter).drizzle.execute<{ id: number }>(
      sql`select id from posts where _status = 'published' and ${sql.join(words, sql` and `)} order by published_at desc`,
    )
    ranked = rows.map((r) => Number(r.id))
  }
  if (!ranked.length) return emptyPage(page, limit)
  // Narrow by category or author without losing the rank order.
  if (categoryIds?.length || authorId) {
    const and: Where[] = [{ id: { in: ranked } }]
    if (categoryIds?.length) and.push({ categories: { in: categoryIds } })
    if (authorId) and.push({ authors: { in: [authorId] } })
    const keep = new Set((await p.find({ collection: 'posts', where: { and }, limit: ranked.length, depth: 0, select: {}, pagination: false })).docs.map((d) => d.id))
    ranked = ranked.filter((id) => keep.has(id))
  }
  const totalDocs = ranked.length
  const totalPages = Math.max(1, Math.ceil(totalDocs / limit))
  const ids = ranked.slice((page - 1) * limit, page * limit)
  const byId = new Map((await p.find({ collection: 'posts', where: { id: { in: ids } }, limit: ids.length || 1, depth: 1, pagination: false })).docs.map((d) => [d.id, d]))
  const docs = ids.map((id) => byId.get(id)).filter((d): d is Post => Boolean(d))
  return { docs, totalDocs, limit, totalPages, page, pagingCounter: (page - 1) * limit + 1, hasPrevPage: page > 1, hasNextPage: page < totalPages, prevPage: page > 1 ? page - 1 : null, nextPage: page < totalPages ? page + 1 : null }
}

export const listPosts = cached('posts', ['research_posts'], async ({ page = 1, q, categoryIds, authorId, limit = BLOG_PAGE }: PostListArgs): Promise<PaginatedDocs<Post>> => {
  if (q?.trim()) return searchPosts({ page, q, categoryIds, authorId, limit })
  const p = await db()
  const and: Where[] = [{ _status: { equals: 'published' } }]
  if (categoryIds?.length) and.push({ categories: { in: categoryIds } })
  if (authorId) and.push({ authors: { in: [authorId] } })
  return p.find({ collection: 'posts', where: { and }, sort: '-publishedAt', limit, page, depth: 1 })
})

export const getFeaturedPosts = cached('featured-posts', ['research_posts'], async () => {
  const p = await db()
  return (await p.find({ collection: 'posts', where: { _status: { equals: 'published' }, featured: { equals: true } }, sort: '-publishedAt', limit: 3, depth: 0, select: { title: true, slug: true, publishedAt: true } })).docs
})

export const getRecentPosts = cached('recent-posts', ['research_posts'], async () => {
  const p = await db()
  return (await p.find({ collection: 'posts', where: { _status: { equals: 'published' } }, sort: '-publishedAt', limit: 3, depth: 1, select: { title: true, slug: true, publishedAt: true, featuredImage: true } })).docs
})

export const getPost = async (slug: string, draft = false): Promise<Post | null> => {
  const p = await db()
  const r = await p.find({ collection: 'posts', where: { slug: { equals: slug } }, limit: 1, depth: 2, draft, overrideAccess: draft })
  return r.docs[0] ?? null
}

export const getAdjacentPosts = cached('adjacent-posts', ['research_posts'], async (publishedAt: string) => {
  const p = await db()
  const sel = { title: true, slug: true, publishedAt: true } as const
  const [prev, next] = await Promise.all([
    p.find({ collection: 'posts', where: { _status: { equals: 'published' }, publishedAt: { less_than: publishedAt } }, sort: '-publishedAt', limit: 4, depth: 0, select: sel }),
    p.find({ collection: 'posts', where: { _status: { equals: 'published' }, publishedAt: { greater_than: publishedAt } }, sort: 'publishedAt', limit: 1, depth: 0, select: sel }),
  ])
  return { prev: prev.docs[0] ?? null, next: next.docs[0] ?? null, more: prev.docs.slice(1) }
})

export const getAuthor = async (slug: string) => {
  const p = await db()
  return (await p.find({ collection: 'authors', where: { slug: { equals: slug } }, limit: 1, depth: 1 })).docs[0] ?? null
}

/* ---------------- Vulnerabilities ---------------- */
export type VulnArgs = { cve?: string; product?: string; severity?: string; sort?: string; dir?: 'asc' | 'desc'; page?: number; limit?: number }
const VULN_SORT: Record<string, string> = { cve: 'cveId', title: 'title', severity: 'severity', date: 'date' }

export const vulnWhere = ({ cve, product, severity }: VulnArgs): Where => {
  const and: Where[] = [{ _status: { equals: 'published' } }]
  if (cve?.trim()) and.push({ cveId: { like: cve.trim() } })
  if (product) and.push({ products: { in: [Number(product)] } })
  if (severity) and.push({ severity: { equals: severity } })
  return { and }
}

export const listVulnerabilities = cached('vulns', ['research_vulnerabilities'], async (args: VulnArgs) => {
  const p = await db()
  const sortKey = VULN_SORT[args.sort ?? 'date'] ?? 'date'
  const dir = args.dir ?? (args.sort && args.sort !== 'date' ? 'asc' : 'desc')
  const primary = `${dir === 'desc' ? '-' : ''}${sortKey}`
  // Within a batch, newest CVE numbers first keeps the table stable between loads.
  return p.find({ collection: 'vulnerabilities', where: vulnWhere(args), sort: sortKey === 'cveId' ? primary : [primary, '-cveId'], limit: args.limit ?? TABLE_PAGE, page: args.page ?? 1, depth: 1 })
})

export const getProducts = cached('products', ['research_vulnerabilities'], async () => {
  const p = await db()
  return (await p.find({ collection: 'products', limit: 1000, sort: 'name', pagination: false, depth: 0 })).docs
})

export const getVulnerability = async (slug: string, draft = false): Promise<Vulnerability | null> => {
  const p = await db()
  return (await p.find({ collection: 'vulnerabilities', where: { slug: { equals: slug } }, limit: 1, depth: 1, draft, overrideAccess: draft })).docs[0] ?? null
}

export const sameBatch = cached('same-batch', ['research_vulnerabilities'], async (date: string, excludeId: number) => {
  const p = await db()
  const day = date.slice(0, 10)
  return (
    await p.find({
      collection: 'vulnerabilities',
      where: { _status: { equals: 'published' }, date: { greater_than_equal: `${day}T00:00:00.000Z`, less_than: `${day}T23:59:59.999Z` }, id: { not_equals: excludeId } },
      sort: '-severity',
      limit: 6,
      depth: 0,
      select: { cveId: true, slug: true, title: true, severity: true },
    })
  ).docs
})

/* ---------------- Threats ---------------- */
export type ThreatArgs = { os?: string; prevalence?: string; sort?: string; dir?: 'asc' | 'desc'; page?: number; limit?: number }
const THREAT_SORT: Record<string, string> = { name: 'detectionName', os: 'affectedOs', prevalence: 'prevalence', seen: 'lastSeen', version: 'avDefinitionVersion' }

export const listThreats = cached('threats', ['research_threats'], async (args: ThreatArgs) => {
  const p = await db()
  const and: Where[] = [{ _status: { equals: 'published' } }, { retired: { not_equals: true } }]
  if (args.os) and.push({ affectedOs: { contains: args.os } })
  if (args.prevalence) and.push({ prevalence: { equals: args.prevalence } })
  const sortKey = THREAT_SORT[args.sort ?? 'seen'] ?? 'lastSeen'
  const dir = args.dir ?? (args.sort && args.sort !== 'seen' ? 'asc' : 'desc')
  return p.find({ collection: 'threats', where: { and }, sort: `${dir === 'desc' ? '-' : ''}${sortKey}`, limit: args.limit ?? TABLE_PAGE, page: args.page ?? 1, depth: 0 })
})

export const getThreat = async (slug: string, draft = false): Promise<Threat | null> => {
  const p = await db()
  return (await p.find({ collection: 'threats', where: { slug: { equals: slug } }, limit: 1, depth: 0, draft, overrideAccess: draft })).docs[0] ?? null
}

export const getThreatsUpdated = cached('threats-updated', ['research_threats'], async () => {
  const p = await db()
  const r = await p.find({ collection: 'threats', where: { _status: { equals: 'published' }, retired: { not_equals: true } }, sort: '-updatedAt', limit: 1, depth: 0, select: { updatedAt: true, lastSeen: true } })
  return r.docs[0] ?? null
})

/* ---------------- Threat reports ---------------- */
export const listReports = cached('reports', ['research_threat-reports'], async (year?: number) => {
  const p = await db()
  const and: Where[] = [{ _status: { equals: 'published' } }]
  if (year) and.push({ year: { equals: year } })
  return (await p.find({ collection: 'threat-reports', where: { and }, sort: '-publishedAt', limit: 100, depth: 1 })).docs
})

export const getReportYears = cached('report-years', ['research_threat-reports'], async () => {
  const p = await db()
  const r = await p.find({ collection: 'threat-reports', where: { _status: { equals: 'published' } }, limit: 500, depth: 0, select: { year: true }, pagination: false })
  return [...new Set(r.docs.map((d) => d.year).filter((y): y is number => typeof y === 'number'))].sort((a, b) => b - a)
})

export const getReport = async (id: number): Promise<ThreatReport | null> => {
  const p = await db()
  try {
    return await p.findByID({ collection: 'threat-reports', id, depth: 1 })
  } catch {
    return null
  }
}
