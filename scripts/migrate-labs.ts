/* Migrates labs.k7computing.com (WordPress) into Payload.
   pnpm migrate:labs --phase=data|posts|all [--limit=N] [--force]
   Phase data: authors, categories, products, vulnerabilities, threats. Phase posts: the Lab Blog with its media. */
import 'dotenv/config'
import config from '@payload-config'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { getPayload, type Payload } from 'payload'

import { htmlToLexical, lexicalCounts, sourceCounts, stripHtml } from './migration/lexical'
import { failures as imageFailures, importImage } from './migration/media'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string | undefined]).map(([k, v]) => [k, v ?? 'true']))
const PHASE = args.phase || 'all'
const LIMIT = args.limit ? Number(args.limit) : Infinity
const FORCE = args.force === 'true'
const SITE = 'https://labs.k7computing.com'
const ctx = { context: { disableRevalidate: true }, overrideAccess: true } as const

type Row = Record<string, string | number | null>
const db = await mysql.createConnection({ host: '172.25.0.5', user: 'wp', password: 'wp', database: 'wp', dateStrings: true, charset: 'utf8mb4' })
const q = async <T = Row>(sql: string, params: unknown[] = []): Promise<T[]> => (await db.query(sql, params))[0] as T[]
const metaOf = async (postId: number): Promise<Record<string, string>> => {
  const rows = await q<{ meta_key: string; meta_value: string }>('select meta_key, meta_value from serv_postmeta where post_id=? order by meta_id', [postId])
  const m: Record<string, string> = {}
  for (const r of rows) if (!(r.meta_key in m)) m[r.meta_key] = r.meta_value ?? ''
  return m
}

const report: Record<string, unknown> = { ranAt: new Date().toISOString(), phase: PHASE }
const redirects: [string, string][] = [
  ['/', '/research'],
  ['/index.php/lab-blog/', '/research/lab-blog'],
  ['/index.php/vulnerability-information/', '/research/vulnerability-information'],
  ['/index.php/top-threats/', '/research/top-threats'],
]
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a)

const isoDate = (v: string | null | undefined): string | undefined => {
  if (!v) return undefined
  const s = v.trim()
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00.000Z`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`
  // Textual dates ("Aug 11, 2026") are calendar days: parse them as UTC so the day does not shift with the machine's zone.
  const d = new Date(s.endsWith('Z') || /\d{2}:\d{2}/.test(s) ? s : `${s} 00:00:00 UTC`)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}
const gmt = (s: string) => new Date(s.replace(' ', 'T') + 'Z').toISOString()
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&#8217;|&rsquo;/g, '’').replace(/&nbsp;/g, ' ')

const findBy = async (payload: Payload, collection: 'authors' | 'categories' | 'vulnerabilities' | 'threats' | 'posts', field: string, value: unknown) =>
  (await payload.find({ collection, where: { [field]: { equals: value } }, limit: 1, pagination: false, depth: 0, draft: true, overrideAccess: true })).docs[0]

/* ---------------- Authors ---------------- */
const GENERIC = new Set(['administrator', 'admin', 'K7CTO', 'k7masteracc', 'root', 'ameex'])
const authorIdByLogin = new Map<string, number>()

const migrateAuthors = async (payload: Payload) => {
  const users = await q<{ ID: number; user_login: string; display_name: string; photo: string | null }>(
    "select u.ID, u.user_login, u.display_name, (select meta_value from serv_usermeta where user_id=u.ID and meta_key='userphoto_image_file') photo from serv_users u",
  )
  const credited = new Set<string>()
  for (const r of await q<{ login: string }>("select distinct t.name login from serv_terms t join serv_term_taxonomy tt on tt.term_id=t.term_id where tt.taxonomy='author' and tt.count>0")) credited.add(r.login)
  for (const r of await q<{ login: string }>("select distinct u.user_login login from serv_posts p join serv_users u on u.ID=p.post_author where p.post_type='post' and p.post_status='publish'")) credited.add(r.login)
  credited.add('k7tcl')
  let created = 0, skipped = 0
  for (const u of users) {
    if (!credited.has(u.user_login) || GENERIC.has(u.user_login)) continue
    const existing = await findBy(payload, 'authors', 'wpLogin', u.user_login)
    if (existing && !FORCE) {
      authorIdByLogin.set(u.user_login, existing.id)
      skipped++
      continue
    }
    const photo = u.photo ? await importImage(payload, `${SITE}/wp-content/uploads/userphoto/${u.photo}`, u.display_name) : null
    const data = { name: u.display_name, slug: u.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), wpLogin: u.user_login, role: 'Threat researcher at K7 Labs', ...(photo ? { photo } : {}) }
    const doc = existing ? await payload.update({ collection: 'authors', id: existing.id, data, ...ctx }) : await payload.create({ collection: 'authors', data, ...ctx })
    authorIdByLogin.set(u.user_login, doc.id)
    created++
  }
  report.authors = { created, skipped, total: authorIdByLogin.size }
  log('authors', report.authors)
}

/* ---------------- Categories ---------------- */
const catIdByTerm = new Map<number, number>()
const catPathByTerm = new Map<number, string>()

const migrateCategories = async (payload: Payload) => {
  type Term = { term_id: number; name: string; slug: string; parent: number; count: number }
  const terms = await q<Term>("select t.term_id, t.name, t.slug, tt.parent, tt.count from serv_terms t join serv_term_taxonomy tt on tt.term_id=t.term_id where tt.taxonomy='category' order by tt.count desc, t.term_id")
  const byId = new Map(terms.map((t) => [t.term_id, t]))
  const fixName = (t: Term) => (t.slug === 'artificial-intelliigence' ? 'Artificial Intelligence' : t.name)
  // Titles that collide get the parent in brackets, except the most-used one.
  const seen = new Map<string, number>()
  const title = (t: Term): string => {
    const base = fixName(t)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    if (n === 0) return base
    const parent = t.parent ? fixName(byId.get(t.parent)!) : ''
    return parent ? `${base} (${parent})` : `${base} ${n + 1}`
  }
  const titles = new Map(terms.map((t) => [t.term_id, title(t)]))
  let created = 0, skipped = 0
  const pathOf = (t: Term): string => (t.parent && byId.get(t.parent) ? `${pathOf(byId.get(t.parent)!)}/${t.slug}` : t.slug)
  // parents first
  const ordered = [...terms].sort((a, b) => (a.parent === 0 ? 0 : 1) - (b.parent === 0 ? 0 : 1))
  for (const t of ordered) {
    catPathByTerm.set(t.term_id, pathOf(t))
    const existing = await findBy(payload, 'categories', 'wpId', t.term_id)
    if (existing && !FORCE) {
      catIdByTerm.set(t.term_id, existing.id)
      skipped++
      continue
    }
    const data = { title: titles.get(t.term_id)!, slug: t.slug, parent: t.parent ? catIdByTerm.get(t.parent) : undefined, wpId: t.term_id }
    const doc = existing ? await payload.update({ collection: 'categories', id: existing.id, data, ...ctx }) : await payload.create({ collection: 'categories', data, ...ctx })
    catIdByTerm.set(t.term_id, doc.id)
    created++
  }
  for (const t of terms) redirects.push([`/index.php/category/${pathOf(t)}/`, `/research/lab-blog/category/${pathOf(t)}`])
  for (const r of await q<{ slug: string }>("select t.slug from serv_terms t join serv_term_taxonomy tt on tt.term_id=t.term_id where tt.taxonomy='post_tag'")) redirects.push([`/index.php/tag/${r.slug}/`, '/research/lab-blog'])
  report.categories = { created, skipped, total: terms.length, renamed: terms.filter((t) => titles.get(t.term_id) !== t.name).map((t) => `${t.name} → ${titles.get(t.term_id)} (${t.slug})`) }
  log('categories', report.categories)
}

/* ---------------- Products + vulnerabilities ---------------- */
const productIdByKey = new Map<string, number>()
const PRODUCT_FIX: Record<string, string> = { 'microsoft office microsoft 365 apps': 'Microsoft Office, Microsoft 365 Apps', 'microsoft 365 app': 'Microsoft 365 Apps' }
const splitProducts = (raw: string): string[] => {
  let s = decode(raw).replace(/["“”]/g, '').replace(/\s+/g, ' ').trim()
  const fixed = PRODUCT_FIX[s.toLowerCase()]
  if (fixed) s = fixed
  return s
    .split(/\s*[,;]\s*|\s+and\s+/)
    .map((p) => p.trim().replace(/[.\s]+$/, ''))
    .map((p) => PRODUCT_FIX[p.toLowerCase()] ?? p)
    .filter(Boolean)
}
const productKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()
const productId = async (payload: Payload, name: string): Promise<number> => {
  const key = productKey(name)
  const hit = productIdByKey.get(key)
  if (hit) return hit
  const existing = (await payload.find({ collection: 'products', where: { key: { equals: key } }, limit: 1, pagination: false, depth: 0 })).docs[0]
  const doc = existing ?? (await payload.create({ collection: 'products', data: { name }, ...ctx }))
  productIdByKey.set(key, doc.id)
  return doc.id
}

const parseVulnDetail = (html: string): { detail: string; advisoryUrl?: string; patchDate?: string } => {
  const out: { detail: string; advisoryUrl?: string; patchDate?: string } = { detail: '' }
  const m = html.match(/Patch release date:\s*([A-Za-z]{3,9}\.? \d{1,2},? \d{4}|\d{1,2}[-/ ][A-Za-z]{3,9}[-/ ]\d{4}|\d{4}-\d{2}-\d{2})/i)
  if (m) out.patchDate = isoDate(m[1]!.replace('.', ''))
  const a = html.match(/<a[^>]+href=["']([^"']+)["']/i)
  if (a) out.advisoryUrl = a[1]
  let s = html.replace(/Patch release date:[^<\n]*/i, '').replace(/Further information[^<]*(<a[\s\S]*?<\/a>)?\.?/gi, '')
  s = stripHtml(s).replace(/^\s*Detailed Information on the risk:\s*$/gim, '').replace(/^\s*Brief overview of the risk:\s*$/gim, '').replace(/\n{3,}/g, '\n\n').trim()
  out.detail = s
  return out
}

const migrateVulnerabilities = async (payload: Payload) => {
  type V = { ID: number; post_title: string; post_name: string; post_date: string; post_content: string }
  const rows = await q<V>("select ID, post_title, post_name, post_date, post_content from serv_posts where post_type='vulnerability' and post_status='publish' order by post_date desc, ID desc")
  const keptByCve = new Map<string, V>()
  const duplicates: { cveId: string; skippedSlug: string; keptSlug: string }[] = []
  const toImport: V[] = []
  for (const r of rows) {
    const cve = r.post_title.trim().replace(/\s+/g, ' ').toUpperCase()
    const kept = keptByCve.get(cve)
    if (kept) {
      duplicates.push({ cveId: cve, skippedSlug: r.post_name, keptSlug: kept.post_name })
      redirects.push([`/index.php/vulnerability/${r.post_name}/`, `/research/vulnerability/${kept.post_name}`])
      continue
    }
    keptByCve.set(cve, r)
    toImport.push(r)
  }
  let created = 0, skipped = 0, failed = 0
  const sevMap: Record<string, string> = { critical: 'critical', high: 'high', important: 'important', medium: 'medium', moderate: 'medium', low: 'low', informative: 'informative', informational: 'informative' }
  for (const [i, r] of toImport.entries()) {
    if (i >= LIMIT) break
    redirects.push([`/index.php/vulnerability/${r.post_name}/`, `/research/vulnerability/${r.post_name}`])
    const existing = await findBy(payload, 'vulnerabilities', 'wpId', r.ID)
    if (existing && !FORCE) {
      skipped++
      continue
    }
    try {
      const m = await metaOf(r.ID)
      const products: number[] = []
      for (const p of splitProducts(m.product || '')) products.push(await productId(payload, p))
      const parsed = parseVulnDetail(r.post_content || '')
      const data = {
        cveId: r.post_title.trim().replace(/\s+/g, ' ').toUpperCase(),
        slug: r.post_name,
        title: decode(m.vulnerability_information || r.post_title).trim(),
        products: [...new Set(products)],
        severity: (sevMap[(m.severity || '').trim().toLowerCase()] ?? 'informative') as 'critical',
        date: isoDate(m.date) ?? gmt(r.post_date),
        detail: parsed.detail || undefined,
        advisoryUrl: parsed.advisoryUrl,
        patchDate: parsed.patchDate,
        affectedSoftware: m.affected_software ? decode(stripHtml(m.affected_software)).split(/\n|,\s*(?=\S)/).map((s) => s.trim().replace(/,$/, '')).filter(Boolean).join('\n') : undefined,
        wpId: r.ID,
        _status: 'published' as const,
      }
      if (existing) await payload.update({ collection: 'vulnerabilities', id: existing.id, data, ...ctx })
      else await payload.create({ collection: 'vulnerabilities', data, ...ctx })
      created++
    } catch (e) {
      failed++
      log('vulnerability failed', r.post_name, (e as Error).message.slice(0, 200))
    }
    if ((i + 1) % 250 === 0) log('vulnerabilities', i + 1, '/', toImport.length)
  }
  report.vulnerabilities = { source: rows.length, unique: toImport.length, created, skipped, failed, duplicatesSkipped: duplicates.length, duplicates }
  report.products = { total: productIdByKey.size }
  log('vulnerabilities', { source: rows.length, unique: toImport.length, created, skipped, failed, duplicates: duplicates.length }, 'products', productIdByKey.size)
}

/* ---------------- Threats ---------------- */
const migrateThreats = async (payload: Payload) => {
  type T = { ID: number; post_title: string; post_name: string; post_date: string }
  const rows = await q<T>("select ID, post_title, post_name, post_date from serv_posts where post_type='virusthreat' and post_status='publish' order by post_date desc, ID desc")
  const kept = new Map<string, T>()
  const duplicates: { name: string; skippedSlug: string; keptSlug: string }[] = []
  let created = 0, skipped = 0, failed = 0
  for (const r of rows) {
    const name = decode(r.post_title).replace(/\s+/g, ' ').trim()
    const k = kept.get(name)
    if (k) {
      duplicates.push({ name, skippedSlug: r.post_name, keptSlug: k.post_name })
      redirects.push([`/index.php/virusthreat/${r.post_name}/`, `/research/top-threats/${k.post_name}`])
      continue
    }
    kept.set(name, r)
    redirects.push([`/index.php/virusthreat/${r.post_name}/`, `/research/top-threats/${r.post_name}`])
    const existing = await findBy(payload, 'threats', 'wpId', r.ID)
    if (existing && !FORCE) {
      skipped++
      continue
    }
    try {
      const m = await metaOf(r.ID)
      const os = (m.affected_os || 'Windows').split(/[,/]/).map((s) => s.trim().toLowerCase()).map((s) => (s === 'mac' || s === 'mac os' ? 'macos' : s)).filter((s) => ['windows', 'android', 'linux', 'macos'].includes(s))
      const data = {
        detectionName: decode(m.k7_detection_name || r.post_title).replace(/\s+/g, ' ').trim(),
        slug: r.post_name,
        affectedOs: (os.length ? os : ['windows']) as ('windows' | 'android' | 'linux' | 'macos')[],
        prevalence: ((m.prevalence || 'Low').trim().toLowerCase() === 'high' ? 'high' : 'low') as 'high' | 'low',
        firstSeen: isoDate(m.first_seen),
        lastSeen: isoDate(m.last_seen) ?? gmt(r.post_date),
        avDefinitionVersion: (m.av_definition_version || '').trim() || 'n/a',
        md5: (m.md5 || '').trim() || undefined,
        sha256: (m.sha256 || '').trim() || undefined,
        fileSize: m.file_size && /^\d+$/.test(m.file_size.replace(/[,\s]/g, '')) ? Number(m.file_size.replace(/[,\s]/g, '')) : undefined,
        packer: (m.packer_information || '').trim() || undefined,
        aliases: (m.aliases || '').trim() || undefined,
        behaviourDetails: decode(stripHtml(m.behavior_details || '')).replace(/\t/g, '  ') || undefined,
        removalInstructions: decode(stripHtml(m.removal_instructions || '')).replace(/\t/g, '  ') || undefined,
        retired: false,
        wpId: r.ID,
        _status: 'published' as const,
      }
      if (existing) await payload.update({ collection: 'threats', id: existing.id, data, ...ctx })
      else await payload.create({ collection: 'threats', data, ...ctx })
      created++
    } catch (e) {
      failed++
      log('threat failed', r.post_name, (e as Error).message.slice(0, 200))
    }
  }
  report.threats = { source: rows.length, unique: kept.size, created, skipped, failed, duplicates }
  log('threats', { source: rows.length, created, skipped, failed, duplicates: duplicates.length })
}

/* ---------------- Posts ---------------- */
const migratePosts = async (payload: Payload) => {
  if (!authorIdByLogin.size) for (const a of (await payload.find({ collection: 'authors', limit: 500, pagination: false, depth: 0 })).docs) if (a.wpLogin) authorIdByLogin.set(a.wpLogin, a.id)
  if (!catIdByTerm.size) for (const c of (await payload.find({ collection: 'categories', limit: 500, pagination: false, depth: 0 })).docs) if (c.wpId) catIdByTerm.set(c.wpId, c.id)
  const labs = authorIdByLogin.get('k7tcl')
  type P = { ID: number; post_title: string; post_name: string; post_date_gmt: string; post_author: number; post_content: string; post_excerpt: string; login: string }
  const rows = await q<P>("select p.ID, p.post_title, p.post_name, p.post_date_gmt, p.post_author, p.post_content, p.post_excerpt, u.user_login login from serv_posts p left join serv_users u on u.ID=p.post_author where p.post_type='post' and p.post_status='publish' order by p.post_date desc, p.ID desc")
  let created = 0, skipped = 0, failed = 0
  const perPost: Record<string, { source: ReturnType<typeof sourceCounts>; lexical: ReturnType<typeof lexicalCounts> }> = {}
  let embeds = 0
  for (const [i, r] of rows.entries()) {
    if (i >= LIMIT) break
    redirects.push([`/index.php/${r.post_name}/`, `/research/lab-blog/${r.post_name}`])
    const existing = await findBy(payload, 'posts', 'wpId', r.ID)
    if (existing && !FORCE) {
      skipped++
      continue
    }
    try {
      const m = await metaOf(r.ID)
      const coauthors = (await q<{ login: string }>("select t.name login from serv_term_relationships tr join serv_term_taxonomy tt on tt.term_taxonomy_id=tr.term_taxonomy_id join serv_terms t on t.term_id=tt.term_id where tr.object_id=? and tt.taxonomy='author' order by tr.term_taxonomy_id", [r.ID])).map((x) => x.login)
      const logins = (coauthors.length ? coauthors : [r.login]).map((l) => (GENERIC.has(l) ? 'k7tcl' : l))
      const authors = [...new Set(logins.map((l) => authorIdByLogin.get(l) ?? labs).filter((x): x is number => typeof x === 'number'))]
      const cats = (await q<{ term_id: number }>("select tt.term_id from serv_term_relationships tr join serv_term_taxonomy tt on tt.term_taxonomy_id=tr.term_taxonomy_id where tr.object_id=? and tt.taxonomy='category'", [r.ID])).map((x) => catIdByTerm.get(x.term_id)).filter((x): x is number => typeof x === 'number')
      let featuredImage: number | undefined
      if (m._thumbnail_id) {
        const f = (await q<{ meta_value: string }>("select meta_value from serv_postmeta where post_id=? and meta_key='_wp_attached_file'", [Number(m._thumbnail_id)]))[0]?.meta_value
        if (f) featuredImage = (await importImage(payload, `${SITE}/wp-content/uploads/${f}`, decode(r.post_title))) ?? undefined
      }
      const converted = await htmlToLexical(r.post_content || '', (src, alt) => importImage(payload, src, alt))
      embeds += converted.embeds
      perPost[r.post_name] = { source: sourceCounts(r.post_content || ''), lexical: lexicalCounts(converted.root) }
      const yoastTitle = (m._yoast_wpseo_title || '').trim()
      const data = {
        title: decode(r.post_title).trim(),
        slug: r.post_name,
        publishedAt: gmt(r.post_date_gmt),
        authors,
        categories: cats,
        featuredImage,
        excerpt: r.post_excerpt?.trim() ? decode(stripHtml(r.post_excerpt)) : undefined,
        content: { root: converted.root } as never,
        featured: (m['meta-checkbox'] || '').trim().toLowerCase() === 'yes',
        meta: { title: yoastTitle && !yoastTitle.includes('%%') ? yoastTitle : undefined, description: (m._yoast_wpseo_metadesc || '').trim() || undefined, image: featuredImage },
        wpId: r.ID,
        _status: 'published' as const,
      }
      if (existing) await payload.update({ collection: 'posts', id: existing.id, data, ...ctx })
      else await payload.create({ collection: 'posts', data, ...ctx })
      created++
    } catch (e) {
      failed++
      log('post failed', r.post_name, (e as Error).message.slice(0, 300), JSON.stringify((e as { data?: unknown }).data ?? (e as { cause?: { message?: string } }).cause?.message ?? '').slice(0, 800))
    }
    if ((i + 1) % 25 === 0) log('posts', i + 1, '/', rows.length, 'image failures so far', imageFailures.length)
  }
  const mismatches = Object.entries(perPost).filter(([, c]) => c.source.tables !== c.lexical.tables || c.source.images !== c.lexical.images || c.source.code !== c.lexical.code).map(([slug, c]) => ({ slug, ...c }))
  report.posts = { source: rows.length, created, skipped, failed, embeds, imageFailures, countMismatches: mismatches }
  log('posts', { source: rows.length, created, skipped, failed, embeds, imageFailures: imageFailures.length, mismatches: mismatches.length })
}

/* ---------------- Run ---------------- */
const payload = await getPayload({ config })
log('migration start', { PHASE, LIMIT, FORCE })
if (PHASE === 'data' || PHASE === 'all') {
  await migrateAuthors(payload)
  await migrateCategories(payload)
  await migrateVulnerabilities(payload)
  await migrateThreats(payload)
}
if (PHASE === 'posts' || PHASE === 'all') {
  if (PHASE === 'posts') {
    // redirects for the data collections are still needed in the CSV
    for (const r of await q<{ post_name: string; post_type: string }>("select post_name, post_type from serv_posts where post_status='publish' and post_type in ('vulnerability','virusthreat')")) redirects.push([`/index.php/${r.post_type === 'vulnerability' ? 'vulnerability' : 'virusthreat'}/${r.post_name}/`, `/research/${r.post_type === 'vulnerability' ? 'vulnerability' : 'top-threats'}/${r.post_name}`])
  }
  await migratePosts(payload)
}
await db.end()
const outDir = path.resolve(process.cwd(), 'migration')
mkdirSync(outDir, { recursive: true })
const seen = new Set<string>()
const csv = ['old_path,new_path', ...redirects.filter(([o]) => (seen.has(o) ? false : (seen.add(o), true))).map(([o, n]) => `${JSON.stringify(o)},${JSON.stringify(n)}`)].join('\n') + '\n'
writeFileSync(path.join(outDir, PHASE === 'posts' ? 'redirects.posts.csv' : 'redirects.csv'), csv)
writeFileSync(path.join(outDir, PHASE === 'posts' ? 'report.posts.json' : PHASE === 'data' ? 'report.data.json' : 'report.json'), JSON.stringify(report, null, 2))
log('done; redirects', seen.size)
process.exit(0)
