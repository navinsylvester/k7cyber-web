import { getServerSideSitemap } from 'next-sitemap'
import { unstable_cache } from 'next/cache'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'

/* MG-06: the Research section in the sitemap: the five tabs, every category, CVE and detection. Posts have their own sitemap. */
const getResearchSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config: configPromise })
    const site = getServerSideURL()
    const now = new Date().toISOString()
    const fixed = ['/research', '/research/lab-blog', '/research/vulnerability-information', '/research/top-threats', '/research/threat-reports'].map((loc) => ({ loc: site + loc, lastmod: now }))
    const [cats, vulns, threats] = await Promise.all([
      payload.find({ collection: 'categories', limit: 500, pagination: false, depth: 0, select: { slug: true, breadcrumbs: true, updatedAt: true } }),
      payload.find({ collection: 'vulnerabilities', where: { _status: { equals: 'published' } }, limit: 10000, pagination: false, depth: 0, select: { slug: true, updatedAt: true } }),
      payload.find({ collection: 'threats', where: { _status: { equals: 'published' } }, limit: 1000, pagination: false, depth: 0, select: { slug: true, updatedAt: true } }),
    ])
    return [
      ...fixed,
      ...cats.docs.map((c) => ({ loc: `${site}/research/lab-blog/category${(c.breadcrumbs?.length ? c.breadcrumbs[c.breadcrumbs.length - 1]!.url : `/${c.slug}`) ?? `/${c.slug}`}`, lastmod: c.updatedAt })),
      ...vulns.docs.map((v) => ({ loc: `${site}/research/vulnerability/${v.slug}`, lastmod: v.updatedAt })),
      ...threats.docs.map((t) => ({ loc: `${site}/research/top-threats/${t.slug}`, lastmod: t.updatedAt })),
    ]
  },
  ['research-sitemap'],
  { tags: ['research'] },
)

export async function GET() {
  return getServerSideSitemap(await getResearchSitemap())
}
