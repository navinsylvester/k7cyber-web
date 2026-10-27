/* Reseeds one page from the seed definitions without touching the rest of the site:
     pnpm tsx scripts/seed-page.ts home
   The page is deleted and recreated by slug, as the full seed does. Forms are looked up, not recreated; a seed form the database
   does not have yet is created, so a new page's form arrives with it. */
import 'dotenv/config'
import config from '@payload-config'
import { getPayload } from 'payload'

import { forms as seedForms } from '../src/endpoints/seed/forms'
import { pages } from '../src/endpoints/seed/pages'
import { morePages } from '../src/endpoints/seed/pages2'

const slug = process.argv[2]
if (!slug) {
  console.error('Usage: pnpm tsx scripts/seed-page.ts <slug>')
  process.exit(1)
}

const payload = await getPayload({ config })
const forms = await payload.find({ collection: 'forms', limit: 100, pagination: false })
const formIds = Object.fromEntries(forms.docs.map((f) => [f.title, f.id])) as Record<string, number>
for (const f of seedForms.filter((f) => !(f.title in formIds))) {
  formIds[f.title] = (await payload.create({ collection: 'forms', data: f })).id
  console.log(`Created form "${f.title}" (id ${formIds[f.title]})`)
}

const page = [...pages, ...morePages(formIds)].find((p) => p.slug === slug)
if (!page) {
  console.error(`No seed page with slug "${slug}". Known: ${[...pages, ...morePages(formIds)].map((p) => p.slug).join(', ')}`)
  process.exit(1)
}

// Outside Next, revalidatePath has no request to act on; the running dev server picks the change up on its next render.
const context = { disableRevalidate: true }
await payload.delete({ collection: 'pages', where: { slug: { equals: slug } }, context })
const doc = await payload.create({ collection: 'pages', data: page, context })
console.log(`Seeded page /${slug} (id ${doc.id}, ${page.layout.length} sheets)`)
process.exit(0)
