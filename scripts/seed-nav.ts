/* Rewrites the header menu and the footer from the seed definitions without touching any page:
     pnpm seed:nav
   The same data the full seed writes (src/endpoints/seed/index.ts), for when a link is added to the menu. Restart `pnpm dev`
   (or save the Header global in /admin) afterwards: the site caches both globals by tag. */
import 'dotenv/config'
import config from '@payload-config'
import { getPayload } from 'payload'

import { footer, headerMenu } from '../src/endpoints/seed/index'

const payload = await getPayload({ config })
// Outside Next the globals' revalidateTag hooks have no store and throw, so revalidation is off: the site's cached header and footer
// refresh when the dev server restarts or the global is saved once in /admin; in production the deploy's build reads the new rows.
const context = { disableRevalidate: true }
await payload.updateGlobal({ slug: 'header', data: { navItems: headerMenu } as never, context })
await payload.updateGlobal({ slug: 'footer', data: footer as never, context })
console.log(`header: ${headerMenu.length} items; footer: ${footer.columns.length} columns`)
process.exit(0)
