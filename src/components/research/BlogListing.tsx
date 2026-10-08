import Link from 'next/link'
import React from 'react'

import { BlogAside, PostFeature, PostRow } from '@/components/research/Blog'
import { Pager, StateTab, Fresh, qs } from '@/components/research/Parts'
import { BLOG_PAGE, listPosts, type PostListArgs } from '@/lib/research/data'

/* The shared body of the blog index, a category page and an author page (FR-LB-01, 02, 03). */
export const BlogListing: React.FC<{
  args: PostListArgs
  path: string
  base: Record<string, string | number | undefined>
  feature?: boolean
  stateTab?: React.ReactNode
  results?: React.ReactNode
  currentCategory?: number
}> = async ({ args, path, base, feature = true, stateTab, results, currentCategory }) => {
  const page = args.page ?? 1
  const r = await listPosts({ ...args, page })
  const [lead, ...rest] = r.docs
  const showFeature = feature && page === 1 && lead && !args.q
  return (
    <section className="sheet g-paper" aria-label="Posts">
      {stateTab ?? (lead && <StateTab><Fresh label="Latest post" date={lead.publishedAt} /></StateTab>)}
      <div className="blog-layout">
        <div>
          {results && <div className="results label">{results}</div>}
          {!r.docs.length && (
            <p style={{ padding: '40px 0', fontSize: 19, margin: 0 }}>
              No posts match. <Link className="link-u" href="/research/lab-blog">All posts</Link>
            </p>
          )}
          {showFeature && <PostFeature post={lead} />}
          <div className="post-list">{(showFeature ? rest : r.docs).map((p, i) => <PostRow post={p} index={i} key={p.id} />)}</div>
          <Pager page={page} totalPages={r.totalPages} href={(n) => path + qs(base, { page: n > 1 ? n : undefined })} label="Blog pages" count={`Page ${page} of ${r.totalPages} · ${r.totalDocs} posts`} newer="Newer" older="Older" />
        </div>
        <BlogAside currentCategory={currentCategory} />
      </div>
    </section>
  )
}

export const perPage = BLOG_PAGE
