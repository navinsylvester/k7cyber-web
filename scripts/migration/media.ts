/* Downloads a file from the old site (cached under migration/cache) and uploads it to the media collection once. */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'

const CACHE = path.resolve(process.cwd(), 'migration/cache')
mkdirSync(CACHE, { recursive: true })

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf' }
const sharpSafe = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export const failures: string[] = []
const known = new Map<string, number | null>()

const fetchBytes = async (url: string): Promise<Buffer | null> => {
  const key = createHash('sha1').update(url).digest('hex')
  const ext = (path.extname(new URL(url).pathname) || '.bin').toLowerCase()
  const file = path.join(CACHE, key + ext)
  if (existsSync(file)) return readFileSync(file)
  if (existsSync(file + '.missing')) return null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'k7-migration/1.0' } })
      if (res.status === 404) break
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (!buf.length) break
      writeFileSync(file, buf)
      return buf
    } catch {
      /* retry */
    }
  }
  writeFileSync(file + '.missing', '')
  return null
}

const normaliseUrl = (src: string): string => {
  let u = src.trim().replace(/^http:\/\/172\.104\.56\.202\//, 'https://labs.k7computing.com/').replace(/^http:\/\/labs\.k7computing\.com\//, 'https://labs.k7computing.com/')
  if (u.startsWith('//')) u = 'https:' + u
  if (u.startsWith('/')) u = 'https://labs.k7computing.com' + u
  return u
}

/** The original file behind a WordPress resized variant (…-1024x338.jpg → ….jpg). */
const originalOf = (url: string): string => url.replace(/-\d{2,4}x\d{2,4}(\.[a-z]{3,4})$/i, '$1')

export const importImage = async (payload: Payload, src: string, alt: string): Promise<number | null> => {
  const url = normaliseUrl(src)
  if (!/^https?:\/\//.test(url)) return null
  if (known.has(url)) return known.get(url)!
  const existing = await payload.find({ collection: 'media', where: { sourceUrl: { equals: url } }, limit: 1, pagination: false, depth: 0 })
  if (existing.docs[0]) {
    known.set(url, existing.docs[0].id)
    return existing.docs[0].id
  }
  let fetched = url
  let buf = originalOf(url) !== url ? await fetchBytes(originalOf(url)) : null
  if (buf) fetched = originalOf(url)
  else buf = await fetchBytes(url)
  if (!buf) {
    failures.push(url)
    known.set(url, null)
    return null
  }
  const name = path.basename(new URL(fetched).pathname).replace(/[^a-zA-Z0-9._-]/g, '-') || 'file'
  const ext = path.extname(name).slice(1).toLowerCase()
  let mimetype = MIME[ext] || 'application/octet-stream'
  if (!sharpSafe.has(mimetype) && mimetype.startsWith('image/')) mimetype = 'application/octet-stream'
  const create = (mt: string) =>
    payload.create({
      collection: 'media',
      data: { alt: alt || name, sourceUrl: url },
      file: { data: buf!, mimetype: mt, name, size: buf!.length },
      context: { disableRevalidate: true },
      overrideAccess: true,
    })
  try {
    const doc = await create(mimetype)
    known.set(url, doc.id)
    return doc.id
  } catch (e) {
    try {
      const doc = await create('application/octet-stream')
      known.set(url, doc.id)
      return doc.id
    } catch (e2) {
      failures.push(`${url} (${(e2 as Error).message.slice(0, 80)})`)
      known.set(url, null)
      return null
    }
  }
}
