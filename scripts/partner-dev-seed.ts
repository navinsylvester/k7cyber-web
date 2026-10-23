/* A test partner organisation and one Partner Admin for development of the partner portal (docs/partner-portal/04-portal-guide.md §1):
     pnpm partner:seed-dev you@example.com ["Your Name"] [--crm] [--collateral] [--editor]
   Idempotent: the organisation PP-TEST (partner ID K7P-00000) is created once, three PP-TEST products once (M4), and the user is created or moved into it. Test rows carry the
   PP-TEST prefix the build plan asks for (02-build-plan.md §0) and never reach the CRM. `--editor` makes (or resets) a Payload admin user with the
   Marketing editor role, pp-test-editor@k7computing.com, whose password is PARTNER_DEV_EDITOR_PASSWORD in .env, for clicking the /admin side of the library. */
import 'dotenv/config'
import config from '@payload-config'
import { getPayload } from 'payload'

const email = (process.argv[2] ?? '').trim().toLowerCase()
const name = process.argv[3] ?? 'Test Partner Admin'
if (!email.includes('@')) {
  console.error('Usage: pnpm partner:seed-dev <email> ["Name"]')
  process.exit(1)
}

const payload = await getPayload({ config })
const existing = await payload.find({ collection: 'partner-orgs', where: { partnerId: { equals: 'K7P-00000' } }, limit: 1 })
const org =
  existing.docs[0] ??
  (await payload.create({
    collection: 'partner-orgs',
    data: { partnerId: 'K7P-00000', type: 'var', status: 'approved', name: 'PP-TEST Partner Private Limited', tradeName: 'PP-TEST Partner', country: 'India', state: 'Tamil Nadu', city: 'Chennai', regions: ['S'], website: 'https://example.com' },
  }))
console.log(`organisation ${org.partnerId} (${org.id}) ${existing.docs[0] ? 'exists' : 'created'}`)

const users = await payload.find({ collection: 'partner-users', where: { email: { equals: email } }, limit: 1 })
const u = users.docs[0]
if (u) {
  await payload.update({ collection: 'partner-users', id: u.id, data: { org: org.id, status: 'active', roles: ['admin', 'sales', 'technical'] } })
  console.log(`user ${email} updated: active, every role, in ${org.partnerId}`)
} else {
  await payload.create({ collection: 'partner-users', data: { org: org.id, email, name, roles: ['admin', 'sales', 'technical'], status: 'active', invitedAt: new Date().toISOString() } })
  console.log(`user ${email} created in ${org.partnerId}`)
}
// A small catalogue so the deal form has something to offer (decision 19); idempotent by SKU, PP-TEST like the rest.
const PRODUCTS = [
  { name: 'PP-TEST Endpoint Security', sku: 'PPT-EPS-001', family: 'Endpoint', order: 10, description: 'Per endpoint, one year.' },
  { name: 'PP-TEST Endpoint Detection and Response', sku: 'PPT-EDR-001', family: 'Endpoint', order: 20, description: 'Per endpoint, one year.' },
  { name: 'PP-TEST Managed Detection and Response', sku: 'PPT-MDR-001', family: 'Services', order: 30, description: 'Per endpoint per month.' },
]
for (const p of PRODUCTS) {
  const found = await payload.find({ collection: 'partner-products', where: { sku: { equals: p.sku } }, limit: 1 })
  if (found.docs[0]) continue
  await payload.create({ collection: 'partner-products', data: { ...p, active: true } })
  console.log(`product ${p.sku} created`)
}
// `--crm` queues the organisation's account job (pending, run from the K7 partner page) so a deal's opportunity job has a partner account on UAT to bind to.
if (process.argv.includes('--crm')) {
  const jobs = await payload.find({ collection: 'partner-outbox', where: { and: [{ kind: { equals: 'account.create' } }, { objectId: { equals: String(org.id) } }] }, limit: 1 })
  if (jobs.docs[0]) console.log(`account job for ${org.partnerId} exists (${jobs.docs[0].state})`)
  else {
    await payload.create({
      collection: 'partner-outbox',
      data: { kind: 'account.create', state: 'pending', attempts: 0, orgId: String(org.id), object: 'partner-orgs', objectId: String(org.id), objectLabel: org.partnerId, payload: { approvedAt: new Date().toISOString(), ownerRule: 'none' }, actor: 'partner-dev-seed' },
    })
    console.log(`account job for ${org.partnerId} queued (pending): run it from /partners/portal/k7/partners/${org.partnerId}`)
  }
}
// `--collateral` files four PP-TEST items with one-page PDFs (M6): open to everyone, VARs only, India only, and a draft, so the
// library and the K7 ledger have something to show; idempotent by title.
if (process.argv.includes('--collateral')) {
  const pdf = (text: string) => {
    const stream = `BT /F1 24 Tf 72 720 Td (${text.replace(/[()\\]/g, '')}) Tj ET`
    const objs = ['<</Type/Catalog/Pages 2 0 R>>', '<</Type/Pages/Kids[3 0 R]/Count 1>>', '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>', `<</Length ${stream.length}>>stream\n${stream}\nendstream`, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>']
    let out = '%PDF-1.4\n'
    const offsets: number[] = []
    objs.forEach((o, i) => {
      offsets.push(out.length)
      out += `${i + 1} 0 obj\n${o}\nendobj\n`
    })
    const xref = out.length
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`
    return Buffer.from(out, 'latin1')
  }
  const eps = await payload.find({ collection: 'partner-products', where: { sku: { equals: 'PPT-EPS-001' } }, limit: 1 })
  const ITEMS: { title: string; category: string; product?: number; description: string; tags: string[]; status: string; visibility?: Record<string, unknown> }[] = [
    { title: 'PP-TEST Partner programme guide', category: 'brochure', description: 'How the programme works: tiers to come, deal protection, schemes.', tags: ['programme'], status: 'published' },
    { title: 'PP-TEST Endpoint Security datasheet', category: 'datasheet', product: eps.docs[0] ? Number(eps.docs[0].id) : undefined, description: 'Two pages of features and system requirements.', tags: ['SMB', 'EPS'], status: 'published' },
    { title: 'PP-TEST Reseller price list (VARs only)', category: 'other', product: eps.docs[0] ? Number(eps.docs[0].id) : undefined, description: 'Partner pricing for value added resellers in India.', tags: ['pricing'], status: 'published', visibility: { types: ['var'], countries: ['India'] } },
    { title: 'PP-TEST Launch deck (draft)', category: 'presentation', description: 'Not published yet; the K7 ledger lists it as a draft.', tags: [], status: 'draft' },
  ]
  for (const it of ITEMS) {
    const found = await payload.find({ collection: 'partner-collateral', where: { title: { equals: it.title } }, limit: 1 })
    if (found.docs[0]) continue
    const item = await payload.create({ collection: 'partner-collateral', data: { ...it, visibility: it.visibility ?? {} } as never })
    const bytes = pdf(it.title)
    await payload.create({ collection: 'partner-collateral-files', data: { item: item.id, version: '1', note: 'First version from the development seed.', uploadedBy: 'partner-dev-seed' }, file: { data: bytes, mimetype: 'application/pdf', name: `${it.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`, size: bytes.length } })
    console.log(`collateral "${it.title}" created (${it.status})`)
  }
}
// `--editor` makes a Payload admin user with the Marketing editor role (`src/access/roles.ts`) so the collateral collections can be
// edited in /admin without anybody's real admin password; the password comes from .env and is reset on every run.
if (process.argv.includes('--editor')) {
  const password = process.env.PARTNER_DEV_EDITOR_PASSWORD ?? ''
  if (password.length < 12) {
    console.error('--editor needs PARTNER_DEV_EDITOR_PASSWORD (12 characters or more) in .env')
    process.exit(1)
  }
  const editorEmail = 'pp-test-editor@k7computing.com'
  const found = await payload.find({ collection: 'users', where: { email: { equals: editorEmail } }, limit: 1 })
  if (found.docs[0]) {
    await payload.update({ collection: 'users', id: found.docs[0].id, data: { password, roles: ['marketingEditor'] }, overrideAccess: true })
    console.log(`editor ${editorEmail} exists: password reset, Marketing editor`)
  } else {
    await payload.create({ collection: 'users', data: { email: editorEmail, name: 'PP-TEST Marketing editor', roles: ['marketingEditor'], password }, overrideAccess: true })
    console.log(`editor ${editorEmail} created (Marketing editor): sign in at /admin/login`)
  }
}
await payload.create({
  collection: 'partner-audit',
  data: { actorKind: 'system', actorName: 'partner-dev-seed', object: 'partner-orgs', objectId: String(org.id), objectLabel: org.partnerId, action: 'org.seeded', to: 'approved', orgId: String(org.id), comment: 'Development seed' },
})
process.exit(0)
