/* A test partner organisation and one Partner Admin for development of the partner portal (docs/partner-portal/04-portal-guide.md §1):
     pnpm partner:seed-dev you@example.com ["Your Name"] [--crm] [--collateral] [--editor] [--schemes] [--training] [--trainer]
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
// `--schemes` files three PP-TEST schemes (M7): one open for registration (automatic), one running that asks for K7's approval
// (with the PP-TEST organisation already registered), and one closed last quarter (registered, to compute and publish on the
// desk). Idempotent by name. Slabs on every one; no PDF.
if (process.argv.includes('--schemes')) {
  const d = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  const slabs = [
    { threshold: 500000, benefit: '2% back-end rebate', amount: 10000 },
    { threshold: 1500000, benefit: '4% back-end rebate', amount: 60000 },
    { threshold: 3000000, benefit: '6% back-end rebate and a seat at the partner summit', amount: 180000 },
  ]
  const SCHEMES = [
    { name: 'PP-TEST Festive Push', description: 'Won order value on every product between the festive quarter’s dates.', startDate: d(10), endDate: d(100), registrationDeadline: d(30), approvalRequired: false, register: false },
    { name: 'PP-TEST Endpoint Accelerator', description: 'Endpoint deals won this quarter; K7 approves each registration.', startDate: d(-30), endDate: d(60), registrationDeadline: d(-5), approvalRequired: true, register: true },
    { name: 'PP-TEST Q2 Growth', description: 'Last quarter’s scheme: closed, waiting for the eligibility run.', startDate: d(-120), endDate: d(-10), registrationDeadline: d(-100), approvalRequired: false, register: true },
  ]
  const terms = 'Deals must be registered in the portal and recorded as won in K7’s CRM with a close date inside the scheme’s dates.\n\nThe order value the CRM records is what counts. K7’s review and published result are final subject to the dispute window.\n\nBenefits are paid as a back-end rebate against the partner’s next invoice.'
  for (const sc of SCHEMES) {
    const found = await payload.find({ collection: 'partner-schemes', where: { name: { equals: sc.name } }, limit: 1, depth: 0 })
    let row = found.docs[0]
    if (!row) {
      row = await payload.create({ collection: 'partner-schemes', data: { name: sc.name, description: sc.description, terms, status: 'published', startDate: sc.startDate, endDate: sc.endDate, registrationDeadline: sc.registrationDeadline, approvalRequired: sc.approvalRequired, slabs } as never })
      console.log(`scheme "${sc.name}" created (${row.id})`)
    } else console.log(`scheme "${sc.name}" exists (${row.id})`)
    if (!sc.register) continue
    const reg = await payload.find({ collection: 'partner-scheme-registrations', where: { and: [{ scheme: { equals: row.id } }, { org: { equals: org.id } }] }, limit: 1, depth: 0 })
    if (reg.docs[0]) continue
    await payload.create({
      collection: 'partner-scheme-registrations',
      data: { scheme: row.id, org: org.id, orgPartnerId: org.partnerId, orgName: org.tradeName || org.name, orgType: org.type, status: 'approved', acceptedBy: { userId: '', name: 'PP-TEST seed', email }, acceptedAt: new Date().toISOString() } as never,
    })
    console.log(`  ${org.partnerId} registered for "${sc.name}"`)
  }
}
// `--training` files the two tracks (M10): a Sales course of two modules on two short MDN CC0 clips (flower, friday;
// direct links so no video account is needed in development; production uses Vimeo) with a
// twelve-question bank, and a Technical course with one module and an empty bank, so the desk's "without a bank" view and
// the learner's locked test have something to show. Idempotent by track key and course title.
if (process.argv.includes('--training')) {
  const tracks: Record<string, { name: string; roles: string[]; description: string }> = {
    sales: { name: 'Sales', roles: ['sales'], description: 'Positioning, licensing and deal registration for the new product.' },
    technical: { name: 'Technical', roles: ['technical'], description: 'Deployment, policies and troubleshooting for engineers.' },
  }
  const trackIds: Record<string, number> = {}
  for (const [key, t] of Object.entries(tracks)) {
    const found = await payload.find({ collection: 'partner-tracks', where: { key: { equals: key } }, limit: 1, depth: 0 })
    const row = found.docs[0] ?? (await payload.create({ collection: 'partner-tracks', data: { key, name: t.name, roles: t.roles, description: t.description, status: 'published', order: key === 'sales' ? 10 : 20 } as never }))
    trackIds[key] = Number(row.id)
    console.log(`track ${key} ${found.docs[0] ? 'exists' : 'created'} (${row.id})`)
  }
  const course = async (title: string, track: string, data: Record<string, unknown>) => {
    const found = await payload.find({ collection: 'partner-courses', where: { title: { equals: title } }, limit: 1, depth: 0 })
    if (found.docs[0]) {
      console.log(`course "${title}" exists (${found.docs[0].id})`)
      return { id: Number(found.docs[0].id), fresh: false }
    }
    const row = await payload.create({ collection: 'partner-courses', data: { title, track: trackIds[track], status: 'published', version: 1, ...data } as never })
    console.log(`course "${title}" created (${row.id})`)
    return { id: Number(row.id), fresh: true }
  }
  const sales = await course('PP-TEST Selling the new product', 'sales', { description: 'What it is, who buys it, how to register and protect a deal.', order: 10, questionsPerTest: 5, timeLimitMinutes: 10 })
  if (sales.fresh) {
    const mods = [
      { title: 'The product in three minutes', description: 'Positioning and the three families.', video: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', order: 10, reading: 'The new product is sold per endpoint, per year, in three families: Endpoint Security, Endpoint Detection and Response, and Managed Detection and Response.\n\nRegister every deal before you quote: protection runs from K7’s approval.' },
      { title: 'Registering and protecting a deal', description: 'The form, the conflict check, the window and the one extension.', video: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4', order: 20, reading: 'A registered deal is protected for the configured window from approval. One extension of the same length may be asked for before it ends.' },
    ]
    for (const m of mods) await payload.create({ collection: 'partner-modules', data: { ...m, course: sales.id, status: 'published' } as never })
    const q = (type: string, text: string, options: [string, boolean][], explanation = '', topic = 'Deals') => ({ course: sales.id, type, text, options: options.map(([t, c]) => ({ text: t, correct: c })), explanation, topic, active: true })
    const bank = [
      q('single', 'When does deal protection start?', [['When K7 approves the registration', true], ['When the quote is sent', false], ['When the order is invoiced', false], ['When the partner applies', false]], 'Protection runs from approval.'),
      q('single', 'How many extensions may a deal have?', [['One', true], ['Two', false], ['As many as needed', false], ['None', false]], 'One extension, the same length as the protection period.'),
      q('single', 'Which family is sold per endpoint per month?', [['Managed Detection and Response', true], ['Endpoint Security', false], ['Endpoint Detection and Response', false]], '', 'Products'),
      q('single', 'Who approves a registered deal?', [['The Deal Desk Approver', true], ['The Partner Admin', false], ['The end customer', false], ['Finance', false]]),
      q('multiple', 'Which of these are checked for conflicts? (choose all that apply)', [['The customer name', true], ['The contact email domain', true], ['The partner’s PAN', false], ['The deal value', false]], 'The conflict matcher looks at the customer and the contact.'),
      q('multiple', 'Which roles can register a deal? (choose all that apply)', [['Partner Admin', true], ['Sales', true], ['Technical', false]]),
      q('trueFalse', 'A deal must be registered before the quote is sent.', [['True', true], ['False', false]], 'Registration comes first.'),
      q('trueFalse', 'A Distributor registers deals on a reseller’s behalf.', [['True', true], ['False', false]]),
      q('trueFalse', 'The partner dashboard shows deals registered outside the portal.', [['True', false], ['False', true]], 'Only the portal’s own opportunities are read back.'),
      q('single', 'What does the dashboard read from the CRM?', [['The stage, state and value of the portal’s opportunities', true], ['Every opportunity in Dynamics', false], ['The partner’s invoices', false]], '', 'Dashboard'),
      q('single', 'What is the default protection period?', [['90 days', true], ['30 days', false], ['180 days', false], ['One year', false]]),
      q('trueFalse', 'An expired deal can be extended.', [['True', false], ['False', true]], 'The extension must be asked for before the window ends.'),
    ]
    for (const row of bank) await payload.create({ collection: 'partner-questions', data: row as never })
    console.log(`  2 modules and ${bank.length} questions filed on "PP-TEST Selling the new product"`)
  }
  const tech = await course('PP-TEST Deploying the agent', 'technical', { description: 'Installation, policies and the first week. The bank is empty on purpose: the desk shows it and the test stays locked.', order: 10 })
  if (tech.fresh) {
    await payload.create({ collection: 'partner-modules', data: { course: tech.id, title: 'Installing the agent', description: 'Silent install, the console enrolment and the first policy.', video: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', order: 10, status: 'published', reading: 'Enrol the console first; the agent needs the tenant key at install.' } as never })
    console.log('  1 module filed on "PP-TEST Deploying the agent" (no questions)')
  }
}
// `--trainer` makes (or resets) pp-test-trainer@k7computing.com, a Payload user with the Training editor role, for the /admin side of
// the training collections; the password is PARTNER_DEV_EDITOR_PASSWORD, like the Marketing editor's.
if (process.argv.includes('--trainer')) {
  const password = process.env.PARTNER_DEV_EDITOR_PASSWORD ?? ''
  if (password.length < 12) {
    console.error('--trainer needs PARTNER_DEV_EDITOR_PASSWORD (12 characters or more) in .env')
    process.exit(1)
  }
  const trainerEmail = 'pp-test-trainer@k7computing.com'
  const found = await payload.find({ collection: 'users', where: { email: { equals: trainerEmail } }, limit: 1 })
  if (found.docs[0]) {
    await payload.update({ collection: 'users', id: found.docs[0].id, data: { password, roles: ['trainingEditor'] }, overrideAccess: true })
    console.log(`trainer ${trainerEmail} exists: password reset, Training editor`)
  } else {
    await payload.create({ collection: 'users', data: { email: trainerEmail, name: 'PP-TEST Training editor', roles: ['trainingEditor'], password }, overrideAccess: true })
    console.log(`trainer ${trainerEmail} created (Training editor): sign in at /admin/login`)
  }
}
await payload.create({
  collection: 'partner-audit',
  data: { actorKind: 'system', actorName: 'partner-dev-seed', object: 'partner-orgs', objectId: String(org.id), objectLabel: org.partnerId, action: 'org.seeded', to: 'approved', orgId: String(org.id), comment: 'Development seed' },
})
process.exit(0)
