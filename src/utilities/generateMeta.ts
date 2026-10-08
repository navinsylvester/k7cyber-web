import type { Metadata } from 'next'

import type { Media, Page, Post, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'

const getImageURL = (image?: Media | Config['db']['defaultIDType'] | null): string | undefined => {
  if (image && typeof image === 'object' && 'url' in image) {
    const ogUrl = image.sizes?.og?.url
    return getServerSideURL() + (ogUrl || image.url)
  }
  return undefined
}

/* Title, description, canonical and Open Graph for a page or post. The SEO tab's title is used as written;
   without one, the document title gets the site suffix. */
export const generateMeta = async (args: { doc: Partial<Page> | Partial<Post> | null; pathname?: string }): Promise<Metadata> => {
  const { doc, pathname } = args
  // No document: the not-found page. No canonical, and keep it out of the index.
  if (!doc) return { title: 'Page not found | K7 CyberSecurity', robots: { index: false, follow: true } }
  const ogImage = getImageURL(doc?.meta?.image)
  const title = doc?.meta?.title || (doc?.title ? `${doc.title} | K7 CyberSecurity` : 'K7 CyberSecurity')
  const description = doc?.meta?.description || undefined
  const path = pathname ?? (doc?.slug === 'home' ? '/' : doc?.slug ? `/${doc.slug}` : '/')
  const url = getServerSideURL() + path

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: mergeOpenGraph({
      title,
      description,
      url,
      images: ogImage ? [{ url: ogImage }] : undefined,
    }),
  }
}
