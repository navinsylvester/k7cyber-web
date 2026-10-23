import { describe, expect, it } from 'vitest'

import { maxUpload } from '@/collections/uploadLimit'
import { acceptedCollateral, COLLATERAL_CATEGORIES, fileExt, fileKind, filterLibrary, groupLibrary, isCertified, nextVersion, OPEN_VISIBILITY, parseRange, readableBy, toCollateralFile, toCollateralItem, toVisibility, visibilityText, visibleTo, type CollateralItem, type Reader } from '@/lib/partner/collateral-model'
import { DEFAULT_PARTNER_SETTINGS, normalisePartnerSettings, PARTNER_TYPE_LABEL } from '@/lib/partner/settings-model'

/* The collateral library without a tenant (docs/partner-portal/04-portal-guide.md M6): the visibility rule of FR-MKT-03, the
   file kinds of FR-MKT-02, the filters and the grouping of FR-MKT-01, the version bump, the Range header the download route
   honours, the size cap and its setting. */

const varIndia: Reader = { type: 'var', country: 'India', regions: ['S', 'N'], certificate: { status: 'none', until: null } }
const distLanka: Reader = { type: 'distributor', country: 'Sri Lanka', regions: ['INTL'], certificate: { status: 'valid', until: '2027-06-30' } }

const item = (over: Partial<CollateralItem> & { id: string }): CollateralItem => ({
  title: `Item ${over.id}`,
  description: '',
  productId: '',
  productName: '',
  productFamily: '',
  category: 'brochure',
  tags: [],
  status: 'published',
  visibility: OPEN_VISIBILITY,
  order: 100,
  publishedAt: null,
  retiredAt: null,
  updatedAt: '2026-10-23T00:00:00.000Z',
  createdAt: '2026-10-23T00:00:00.000Z',
  file: { id: `f${over.id}`, itemId: over.id, version: '1', note: '', name: `item-${over.id}.pdf`, mime: 'application/pdf', size: 1024, kind: 'pdf', uploadedBy: '', at: '2026-10-23T00:00:00.000Z' },
  versions: 1,
  ...over,
})

describe('the visibility rule (FR-MKT-03)', () => {
  it('an empty rule is everyone', () => {
    expect(visibleTo(OPEN_VISIBILITY, varIndia)).toBe(true)
    expect(visibleTo(OPEN_VISIBILITY, distLanka)).toBe(true)
  })
  it('by partner type', () => {
    const v = { ...OPEN_VISIBILITY, types: ['distributor' as const] }
    expect(visibleTo(v, varIndia)).toBe(false)
    expect(visibleTo(v, distLanka)).toBe(true)
  })
  it('by certification, which nobody holds until M11 unless the row says valid', () => {
    const v = { ...OPEN_VISIBILITY, certified: true }
    expect(visibleTo(v, varIndia)).toBe(false)
    expect(visibleTo(v, distLanka)).toBe(true)
    expect(isCertified({ ...distLanka, certificate: { status: 'valid', until: '2020-01-01' } })).toBe(false)
    expect(isCertified({ ...distLanka, certificate: { status: 'expired', until: null } })).toBe(false)
    expect(isCertified({ ...distLanka, certificate: { status: 'valid', until: null } })).toBe(true)
  })
  it('by country, ignoring case and spaces, and by region, any of mine', () => {
    expect(visibleTo({ ...OPEN_VISIBILITY, countries: [' india '] }, varIndia)).toBe(true)
    expect(visibleTo({ ...OPEN_VISIBILITY, countries: ['India'] }, distLanka)).toBe(false)
    expect(visibleTo({ ...OPEN_VISIBILITY, regions: ['N'] }, varIndia)).toBe(true)
    expect(visibleTo({ ...OPEN_VISIBILITY, regions: ['WCE'] }, varIndia)).toBe(false)
  })
  it('the rules that are set must all hold', () => {
    const v = { ...OPEN_VISIBILITY, types: ['var' as const], countries: ['Sri Lanka'] }
    expect(visibleTo(v, varIndia)).toBe(false)
    expect(visibleTo(v, distLanka)).toBe(false)
  })
  it('a partner reads only published items with a file', () => {
    expect(readableBy(item({ id: '1' }), varIndia)).toBe(true)
    expect(readableBy(item({ id: '2', status: 'draft' }), varIndia)).toBe(false)
    expect(readableBy(item({ id: '3', status: 'retired' }), varIndia)).toBe(false)
    expect(readableBy(item({ id: '4', file: null, versions: 0 }), varIndia)).toBe(false)
  })
  it('says the rule in words', () => {
    const label = (t: keyof typeof PARTNER_TYPE_LABEL) => PARTNER_TYPE_LABEL[t]
    expect(visibilityText(OPEN_VISIBILITY, label)).toBe('Every partner')
    expect(visibilityText({ types: ['var', 'distributor'], certified: true, countries: ['India'], regions: ['S'] }, label, (c) => (c === 'S' ? 'South' : c))).toBe('Value Added Reseller, Distributor · certified only · India · regions South')
  })
  it('reads the raw group, dropping unknown types', () => {
    expect(toVisibility({ types: ['var', 'oem'], certified: 'yes', countries: [' India', ''], regions: null })).toEqual({ types: ['var'], certified: false, countries: ['India'], regions: [] })
    expect(toVisibility(undefined)).toEqual(OPEN_VISIBILITY)
  })
})

describe('the file kinds (FR-MKT-02)', () => {
  it('maps the mime types and falls back to the extension', () => {
    expect(fileKind('application/pdf')).toBe('pdf')
    expect(fileKind('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('presentation')
    expect(fileKind('application/octet-stream', 'deck.PPTX')).toBe('presentation')
    expect(fileKind('video/mp4')).toBe('video')
    expect(fileKind('image/svg+xml')).toBe('image')
    expect(fileKind('application/x-zip-compressed', 'logos.zip')).toBe('archive')
    expect(fileKind('text/html', 'page.html')).toBe('other')
  })
  it('accepts only the listed types', () => {
    expect(acceptedCollateral('brochure.pdf', 'application/pdf')).toBe(true)
    expect(acceptedCollateral('tool.exe', 'application/octet-stream')).toBe(false)
  })
  it('shows the extension', () => {
    expect(fileExt('K7 Brochure v2.pdf')).toBe('PDF')
    expect(fileExt('noext')).toBe('')
  })
})

describe('the library (FR-MKT-01)', () => {
  const items = [
    item({ id: '1', title: 'Programme guide', category: 'brochure' }),
    item({ id: '2', title: 'EPS datasheet', productId: '10', productName: 'Endpoint Security', productFamily: 'Endpoint', category: 'datasheet', tags: ['SMB'] }),
    item({ id: '3', title: 'EPS deck', productId: '10', productName: 'Endpoint Security', productFamily: 'Endpoint', category: 'presentation', order: 10, file: { id: 'f3', itemId: '3', version: '2', note: '', name: 'deck.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: 2048, kind: 'presentation', uploadedBy: '', at: '2026-10-22T00:00:00.000Z' } }),
    item({ id: '4', title: 'EPS brochure', productId: '10', productName: 'Endpoint Security', productFamily: 'Endpoint', category: 'brochure', order: 20 }),
    item({ id: '5', title: 'MDR case study', productId: '11', productName: 'MDR', productFamily: 'Services', category: 'caseStudy' }),
  ]
  it('groups by product (the programme first, then by family and name), then category in the catalogue order, then order', () => {
    const g = groupLibrary(items)
    expect(g.map((x) => x.product)).toEqual(['K7 and the programme', 'Endpoint Security', 'MDR'])
    expect(g[1]!.categories.map((c) => c.category)).toEqual(['brochure', 'datasheet', 'presentation'])
    expect(COLLATERAL_CATEGORIES.indexOf('brochure')).toBeLessThan(COLLATERAL_CATEGORIES.indexOf('presentation'))
  })
  it('filters by search words over title, tags, product and file name, by product, category and kind', () => {
    expect(filterLibrary(items, { q: 'smb' }).map((i) => i.id)).toEqual(['2'])
    expect(filterLibrary(items, { q: 'endpoint deck' }).map((i) => i.id)).toEqual(['3'])
    expect(filterLibrary(items, { q: 'deck.pptx' }).map((i) => i.id)).toEqual(['3'])
    expect(filterLibrary(items, { productId: '11' }).map((i) => i.id)).toEqual(['5'])
    expect(filterLibrary(items, { productId: 'none' }).map((i) => i.id)).toEqual(['1'])
    expect(filterLibrary(items, { category: 'brochure' }).map((i) => i.id)).toEqual(['1', '4'])
    expect(filterLibrary(items, { kind: 'presentation' }).map((i) => i.id)).toEqual(['3'])
    expect(filterLibrary(items, {})).toHaveLength(5)
  })
  it('reads a raw item with its files, newest first as the current one', () => {
    const files = [
      toCollateralFile({ id: 7, item: 3, version: '1', filename: 'a.pdf', mimeType: 'application/pdf', filesize: 10, createdAt: '2026-10-01T00:00:00.000Z' }),
      toCollateralFile({ id: 9, item: { id: 3 }, version: '', filename: 'b.pdf', mimeType: 'application/pdf', filesize: 20, createdAt: '2026-10-05T00:00:00.000Z', note: 'Prices updated' }),
    ]
    const i = toCollateralItem({ id: 3, title: 'T', status: 'published', category: 'datasheet', product: { id: 10, name: 'EPS', family: 'Endpoint' }, tags: ['a'], visibility: { types: ['var'] }, order: 5, updatedAt: 'x', createdAt: 'y' }, files)
    expect(i.file?.id).toBe('9')
    expect(i.file?.version).toBe('1')
    expect(i.file?.note).toBe('Prices updated')
    expect(i.versions).toBe(2)
    expect(i.productId).toBe('10')
    expect(i.productFamily).toBe('Endpoint')
    expect(i.visibility.types).toEqual(['var'])
    expect(toCollateralItem({ id: 4, title: 'Empty', category: 'nonsense', status: 'odd' }).category).toBe('other')
    expect(toCollateralItem({ id: 4, title: 'Empty', category: 'nonsense', status: 'odd' }).status).toBe('draft')
  })
})

describe('versions and the Range header', () => {
  it('bumps the previous version', () => {
    expect(nextVersion(undefined)).toBe('1')
    expect(nextVersion('1')).toBe('2')
    expect(nextVersion('2.3')).toBe('2.4')
    expect(nextVersion('v9')).toBe('v10')
    expect(nextVersion('final')).toBe('final.1')
  })
  it('parses one byte range, suffixes and open ends, and refuses what it cannot serve', () => {
    expect(parseRange(null, 100)).toBeNull()
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 })
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=0-5000', 1000)).toEqual({ start: 0, end: 999 })
    expect(parseRange('bytes=1000-', 1000)).toBe('invalid')
    expect(parseRange('bytes=-', 1000)).toBe('invalid')
    expect(parseRange('bytes=0-10,20-30', 1000)).toBeNull() // several ranges: the whole file, as RFC 9110 allows
    expect(parseRange('items=0-1', 1000)).toBeNull()
  })
})

describe('the size cap', () => {
  const run = async (size: number, max: number) => {
    const hook = maxUpload(max)
    return hook({ req: { file: { name: 'big.pdf', size } }, data: { ok: true }, operation: 'create', collection: {}, context: {} } as never)
  }
  it('refuses a file over the cap and passes the rest', async () => {
    await expect(run(5, 10)).resolves.toEqual({ ok: true })
    await expect(run(11, 10)).rejects.toThrow(/up to 0 MB/)
    const noFile = maxUpload(10)
    await expect(noFile({ req: {}, data: { ok: true }, operation: 'create', collection: {}, context: {} } as never)).resolves.toEqual({ ok: true })
  })
  it('reads the size Payload recorded when the request file has none (a non-image upload through the admin)', async () => {
    // generateFileData rebuilds req.file for non-image files with size undefined; the document's filesize is what counts.
    const hook = maxUpload(10)
    const call = (file: Record<string, unknown>, data: Record<string, unknown>) => hook({ req: { file }, data, operation: 'create', collection: {}, context: {} } as never)
    await expect(call({ name: 'big.pdf', size: undefined, data: Buffer.alloc(11) }, { filesize: 11 })).rejects.toThrow(/big\.pdf is 0\.0 MB/)
    await expect(call({ name: 'big.pdf', size: undefined, data: Buffer.alloc(11) }, {})).rejects.toThrow(/up to 0 MB/)
    await expect(call({ name: 'small.pdf', size: undefined, data: Buffer.alloc(4) }, { filesize: 4 })).resolves.toEqual({ filesize: 4 })
    await expect(call({ name: 'odd.pdf' }, {})).resolves.toEqual({})
  })
  it('is a setting at most the server ceiling', () => {
    expect(DEFAULT_PARTNER_SETTINGS.collateral.maxMb).toBe(200)
    expect(normalisePartnerSettings({ collateral: { maxMb: 50 } }).collateral.maxMb).toBe(50)
    expect(normalisePartnerSettings({ collateral: { maxMb: 900 } }).collateral.maxMb).toBe(200)
    expect(normalisePartnerSettings({ collateral: { maxMb: 0 } }).collateral.maxMb).toBe(200)
    expect(normalisePartnerSettings({}).collateral.maxMb).toBe(200)
  })
})
