import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache'

import type { Post } from '../../../payload-types'

const bust = (slug?: string | null) => {
  try {
    if (slug) revalidatePath(`/research/lab-blog/${slug}`)
    revalidateTag('research_posts', 'max')
    revalidateTag('research', 'max')
    revalidateTag('posts-sitemap', 'max')
  } catch {
    /* outside a request scope */
  }
}

export const revalidatePost: CollectionAfterChangeHook<Post> = ({ doc, previousDoc, req: { context } }) => {
  if (!context.disableRevalidate) {
    bust(doc.slug)
    if (previousDoc?.slug && previousDoc.slug !== doc.slug) bust(previousDoc.slug)
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Post> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) bust(doc?.slug)
  return doc
}
