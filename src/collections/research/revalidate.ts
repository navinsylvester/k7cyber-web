import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidateTag } from 'next/cache'

/* Every research list and detail page reads under one tag per collection, so a publish shows within seconds. */
export const revalidateResearch =
  (tag: string): CollectionAfterChangeHook & CollectionAfterDeleteHook =>
  ({ doc, req: { context } }) => {
    if (!context?.disableRevalidate) {
      try {
        revalidateTag(`research_${tag}`, 'max')
        revalidateTag('research', 'max')
      } catch {
        /* outside a request scope (seed, migration) */
      }
    }
    return doc
  }
