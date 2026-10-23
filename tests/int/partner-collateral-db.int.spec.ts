// @vitest-environment node
// (file-type, which Payload runs on every upload, checks Buffers against the global Uint8Array; under jsdom that is another realm and detection throws)
import configPromise from '@payload-config'
import { getPayload, type Payload, type Where } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { collateralCounts, collateralFileById, downloadTallies, libraryFor, loadCollateralFor, loadCollateralK7, recordDownload, serveCollateralFile } from '@/lib/partner/collateral'
import { orgRel } from '@/lib/partner/scope'
import type { PartnerContext } from '@/lib/partner/session'
import { toOrg, toUser } from '@/lib/partner/users'

/* The collateral library against the local Postgres (docs/partner-portal/04-portal-guide.md M6): a Marketing Admin's items in
   every state and with every rule, read by two organisations (a VAR in India, South; a Distributor in Sri Lanka), the newest
   file as the current version with the blank version bumped, the download counted on the organisation, the bytes served whole
   and by range, and the other organisation's item unreadable by id. Runs only with PARTNER_DB_TESTS=1; rows and files are
   removed again. */

const enabled = process.env.PARTNER_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)
const stamp = Date.now()
// The smallest PDF Payload's validator accepts: the header, an xref table and the EOF marker in the tail.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 1\n0000000000 65535 f \ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n0\n%%EOF\n')

describe.skipIf(!enabled)('the collateral library (database)', () => {
  let payload: Payload
  const orgIds: string[] = []
  const userIds: string[] = []
  const itemIds: string[] = []
  const fileIds: string[] = []
  let productId = ''
  let A: PartnerContext
  let B: PartnerContext
  const ids: Record<string, string> = {}

  const makeOrg = async (tag: string, n: number, type: 'var' | 'distributor', country: string, regions: string[]) => {
    const doc = await payload.create({ collection: 'partner-orgs', overrideAccess: true, depth: 0, data: { partnerId: `K7P-7${String(stamp % 1000).padStart(3, '0')}${n}`, type, status: 'approved', name: `PP-TEST Collateral ${tag} ${stamp}`, country, city: 'City', state: 'State', address: '1 Test Road', pin: '600001', regions } as never })
    orgIds.push(String(doc.id))
    return toOrg(doc as unknown as Record<string, unknown>)
  }
  const makeUser = async (orgId: string, tag: string) => {
    const doc = await payload.create({ collection: 'partner-users', overrideAccess: true, depth: 0, data: { org: orgRel({ orgId }), email: `pp-test-collateral-${tag}-${stamp}@k7computing.com`, name: `Collateral ${tag}`, roles: ['technical'], status: 'active', lastSignInAt: new Date().toISOString() } as never })
    userIds.push(String(doc.id))
    return toUser(doc as unknown as Record<string, unknown>)
  }
  const ctx = (org: ReturnType<typeof toOrg>, user: ReturnType<typeof toUser>): PartnerContext => ({ kind: 'partner', user, org, scope: { orgId: org.id }, roles: user.roles, actor: { kind: 'partner', id: user.id, name: user.name, email: user.email } })
  const makeItem = async (key: string, data: Record<string, unknown>, withFile = true) => {
    const doc = await payload.create({ collection: 'partner-collateral', overrideAccess: true, depth: 0, data: { title: `PP-TEST ${key} ${stamp}`, category: 'brochure', status: 'published', ...data } as never })
    itemIds.push(String(doc.id))
    ids[key] = String(doc.id)
    if (withFile) await makeFile(String(doc.id), '1', `pp-test-${key}-${stamp}.pdf`)
    return String(doc.id)
  }
  const makeFile = async (item: string, version: string, name: string) => {
    const doc = await payload.create({ collection: 'partner-collateral-files', overrideAccess: true, depth: 0, data: { item: Number(item), version }, file: { data: PDF, mimetype: 'application/pdf', name, size: PDF.length } })
    fileIds.push(String(doc.id))
    return String(doc.id)
  }

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })
    const p = await payload.create({ collection: 'partner-products', overrideAccess: true, depth: 0, data: { name: `PP-TEST Collateral Product ${stamp}`, sku: `PPTC-${stamp}`, family: 'Test', active: true, order: 999 } as never })
    productId = String(p.id)
    const [oa, ob] = await Promise.all([makeOrg('A', 1, 'var', 'India', ['S']), makeOrg('B', 2, 'distributor', 'Sri Lanka', ['INTL'])])
    const [ua, ub] = await Promise.all([makeUser(oa.id, 'a'), makeUser(ob.id, 'b')])
    A = ctx(oa, ua)
    B = ctx(ob, ub)
    await makeItem('open', { product: Number(productId), category: 'datasheet', tags: ['smb'] })
    await makeItem('varOnly', { visibility: { types: ['var'] } })
    await makeItem('certified', { visibility: { certified: true } })
    await makeItem('india', { visibility: { countries: ['india'] } })
    await makeItem('north', { visibility: { regions: ['N'] } })
    await makeItem('draft', { status: 'draft' })
    await makeItem('retired', { status: 'retired' })
    await makeItem('noFile', {}, false)
  })

  afterAll(async () => {
    for (const id of fileIds) await payload.delete({ collection: 'partner-collateral-files', id, overrideAccess: true }).catch(() => null)
    for (const id of itemIds) await payload.delete({ collection: 'partner-collateral', id, overrideAccess: true }).catch(() => null)
    for (const c of ['partner-users', 'partner-audit'] as const) {
      for (const orgId of orgIds) {
        const where: Where = c === 'partner-users' ? { org: { equals: orgId } } : { orgId: { equals: orgId } }
        const r = await payload.find({ collection: c, where, limit: 200, depth: 0, overrideAccess: true })
        for (const d of r.docs) await payload.delete({ collection: c, id: d.id, overrideAccess: true }).catch(() => null)
      }
    }
    if (productId) await payload.delete({ collection: 'partner-products', id: productId, overrideAccess: true }).catch(() => null)
    for (const id of orgIds) await payload.delete({ collection: 'partner-orgs', id, overrideAccess: true }).catch(() => null)
  })

  it('shows each organisation what its rule allows and nothing in draft, retired or without a file', async () => {
    const a = await libraryFor(A)
    const b = await libraryFor(B)
    const mine = (r: typeof a) => r.all.filter((i) => itemIds.includes(i.id)).map((i) => i.id).sort()
    expect(mine(a)).toEqual([ids.open, ids.varOnly, ids.india].sort())
    expect(mine(b)).toEqual([ids.open].sort())
    const filtered = await libraryFor(A, { q: 'smb' })
    expect(filtered.items.filter((i) => itemIds.includes(i.id)).map((i) => i.id)).toEqual([ids.open])
    const byProduct = await libraryFor(A, { productId })
    expect(byProduct.items.map((i) => i.id)).toEqual([ids.open])
    const open = a.all.find((i) => i.id === ids.open)!
    expect(open.productName).toContain('PP-TEST Collateral Product')
    expect(open.file?.version).toBe('1')
    expect(open.file?.kind).toBe('pdf')
  })

  it('reads an item by id only under the same rule', async () => {
    expect((await loadCollateralFor(A, ids.varOnly!))?.id).toBe(ids.varOnly)
    expect(await loadCollateralFor(B, ids.varOnly!)).toBeNull()
    expect(await loadCollateralFor(A, ids.draft!)).toBeNull()
    expect(await loadCollateralFor(A, ids.noFile!)).toBeNull()
    expect(await loadCollateralFor(A, 'abc')).toBeNull()
    expect((await loadCollateralK7(ids.draft!))?.status).toBe('draft')
  })

  it('serves the newest version, bumps a blank version, keeps the earlier file for K7', async () => {
    const second = await payload.create({ collection: 'partner-collateral-files', overrideAccess: true, depth: 0, data: { item: Number(ids.open), note: 'Prices updated' }, file: { data: PDF, mimetype: 'application/pdf', name: `pp-test-open-v2-${stamp}.pdf`, size: PDF.length } })
    fileIds.push(String(second.id))
    expect(second.version).toBe('2')
    const item = (await loadCollateralFor(A, ids.open!))!
    expect(item.file?.id).toBe(String(second.id))
    expect(item.file?.note).toBe('Prices updated')
    expect(item.versions).toBe(2)
    const first = fileIds.find((f) => f !== String(second.id) && f === fileIds[0])!
    expect((await collateralFileById(item, first))?.version).toBe('1')
    expect(await collateralFileById(item, fileIds[1]!)).toBeNull()
  })

  it('streams the bytes whole and by range', async () => {
    const item = (await loadCollateralFor(A, ids.open!))!
    const whole = serveCollateralFile(item.file!, new Request('http://localhost/x'))
    expect(whole.status).toBe(200)
    expect(whole.headers.get('Content-Length')).toBe(String(PDF.length))
    expect(whole.headers.get('Content-Disposition')).toMatch(/^attachment/)
    expect(Buffer.from(await whole.arrayBuffer()).equals(PDF)).toBe(true)
    const part = serveCollateralFile(item.file!, new Request('http://localhost/x', { headers: { range: 'bytes=0-7' } }), { inline: true })
    expect(part.status).toBe(206)
    expect(part.headers.get('Content-Range')).toBe(`bytes 0-7/${PDF.length}`)
    expect(part.headers.get('Content-Disposition')).toMatch(/^inline/)
    expect(Buffer.from(await part.arrayBuffer()).toString()).toBe('%PDF-1.4')
    const bad = serveCollateralFile(item.file!, new Request('http://localhost/x', { headers: { range: 'bytes=99999-' } }))
    expect(bad.status).toBe(416)
    expect(serveCollateralFile({ name: '../../etc/passwd', mime: 'text/plain' }, new Request('http://localhost/x')).status).toBe(404)
  })

  it('counts downloads on the organisation and on the K7 desk', async () => {
    const item = (await loadCollateralFor(A, ids.open!))!
    await recordDownload(A, item, item.file!)
    await recordDownload(A, item, item.file!)
    const bItem = (await loadCollateralFor(B, ids.open!))!
    await recordDownload(B, bItem, bItem.file!)
    const t = (await downloadTallies([ids.open!])).get(ids.open!)
    expect(t).toEqual({ total: 3, last30: 3, orgs: 2 })
    const trail = await payload.find({ collection: 'partner-audit', where: { and: [{ orgId: { equals: A.scope.orgId } }, { action: { equals: 'collateral.download' } }] }, limit: 10, depth: 0, overrideAccess: true })
    expect(trail.totalDocs).toBe(2)
    expect(String(trail.docs[0]!.comment)).toContain('v2')
    const counts = await collateralCounts()
    expect(counts.published).toBeGreaterThanOrEqual(5)
    expect(counts.draft).toBeGreaterThanOrEqual(1)
    expect(counts.retired).toBeGreaterThanOrEqual(1)
    expect(counts.withoutFile).toBeGreaterThanOrEqual(1)
    expect(counts.downloads30).toBeGreaterThanOrEqual(3)
  })
})
