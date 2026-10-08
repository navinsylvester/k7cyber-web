import type { Page, Post } from '@/payload-types'

type Ref = { relationTo: 'pages' | 'posts'; value: Page | Post | number | string } | null | undefined

export const pageHref = (page: Page | number | string | null | undefined): string | null => {
  if (!page || typeof page !== 'object' || !page.slug) return null
  return page.slug === 'home' ? '/' : `/${page.slug}`
}

/** href for the `link` group field (type reference | custom). */
export const linkHref = (link: { type?: string | null; reference?: Ref; url?: string | null } | null | undefined): string => {
  if (!link) return '#'
  if (link.type === 'reference' && link.reference && typeof link.reference.value === 'object') {
    const doc = link.reference.value
    if (link.reference.relationTo === 'posts') return `/posts/${doc.slug}`
    return pageHref(doc as Page) ?? '#'
  }
  return link.url || '#'
}

/** href for the compact nav link (page | url). */
export const navHref = (item: { page?: Page | number | string | null; url?: string | null } | null | undefined): string =>
  pageHref(item?.page) ?? item?.url ?? '#'
