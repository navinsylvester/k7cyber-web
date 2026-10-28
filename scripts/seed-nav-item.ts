/* Rewrites one item of the live header menu from the seed definitions, leaving the other items, the primary action and the
   footer exactly as they are (edited in /admin or not):
     pnpm tsx scripts/seed-nav-item.ts Partners
   Revalidation is off outside Next, as in seed-nav.ts: restart the server (or save the Header global once in /admin). */
import 'dotenv/config'
import config from '@payload-config'
import { getPayload } from 'payload'

import { headerMenu } from '../src/endpoints/seed/index'

const label = process.argv[2]
const item = headerMenu.find((i) => i.label === label)
if (!item) {
  console.error(`No seed menu item "${label}". Known: ${headerMenu.map((i) => i.label).join(', ')}`)
  process.exit(1)
}

const payload = await getPayload({ config })
const live = await payload.findGlobal({ slug: 'header', depth: 0 })
const items = live.navItems ?? []
const at = items.findIndex((i) => i.label === label)
if (at < 0) {
  console.error(`The live menu has no item "${label}"; add it in /admin first.`)
  process.exit(1)
}
const navItems = items.map((i, n) => (n === at ? { ...item, id: i.id } : i))
await payload.updateGlobal({ slug: 'header', data: { navItems } as never, context: { disableRevalidate: true } })
console.log(`header: "${label}" rewritten with ${item.columns.length} columns (${item.columns.map((c) => `${c.label} ${c.items.length}`).join(', ')}); ${items.length} items kept`)
process.exit(0)
