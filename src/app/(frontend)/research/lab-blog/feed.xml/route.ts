import { listPosts } from '@/lib/research/data'
import { getServerSideURL } from '@/utilities/getURL'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* FR-LB-08: RSS feed of the Lab Blog, newest 20 posts. */
export async function GET() {
  const site = getServerSideURL()
  const { docs } = await listPosts({ page: 1, limit: 20 })
  const items = docs
    .map((p) => {
      const url = `${site}/research/lab-blog/${p.slug}`
      const authors = (p.authors ?? []).map((a) => (typeof a === 'object' ? a.name : '')).filter(Boolean).join(', ')
      const cats = (p.categories ?? []).map((c) => (typeof c === 'object' ? `<category>${esc(c.title)}</category>` : '')).join('')
      return `<item><title>${esc(p.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>${authors ? `<dc:creator>${esc(authors)}</dc:creator>` : ''}${cats}<description>${esc(p.excerpt ?? '')}</description></item>`
    })
    .join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>K7 Lab Blog</title><link>${site}/research/lab-blog</link><atom:link href="${site}/research/lab-blog/feed.xml" rel="self" type="application/rss+xml"/><description>Malware analysis and threat research from K7 Labs.</description><language>en</language>${items}</channel></rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } })
}
