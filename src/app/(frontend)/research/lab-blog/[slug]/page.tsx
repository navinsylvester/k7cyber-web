import type { Metadata } from 'next'
import Link from 'next/link'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import React from 'react'

import { LivePreviewListener } from '@/components/LivePreviewListener'
import { ResearchBar } from '@/components/research/Bar'
import { Byline, CategoryTags } from '@/components/research/Blog'
import { CopyButton } from '@/components/research/Copy.client'
import { Avatar, LidDet, Placeholder } from '@/components/research/Parts'
import { headingsOf, Prose } from '@/components/research/Prose'
import { Toc } from '@/components/research/Toc.client'
import { getAdjacentPosts, getPost } from '@/lib/research/data'
import { byline, iso, readingTime } from '@/lib/research/format'
import type { Author, Media, Threat } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

type Args = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const post = await getPost((await params).slug)
  if (!post) return { title: 'Post not found' }
  const site = getServerSideURL()
  const url = `${site}/research/lab-blog/${post.slug}`
  const image = (post.meta?.image ?? post.featuredImage) as Media | number | null | undefined
  const img = image && typeof image === 'object' ? site + (image.sizes?.og?.url ?? image.url) : undefined
  const title = post.meta?.title || `${post.title} | K7 Labs`
  const description = post.meta?.description || post.excerpt || undefined
  return {
    title,
    description,
    alternates: { canonical: url, types: { 'application/rss+xml': `${site}/research/lab-blog/feed.xml` } },
    openGraph: { type: 'article', title, description, url, publishedTime: post.publishedAt, images: img ? [{ url: img }] : undefined, siteName: 'K7 CyberSecurity' },
    twitter: { card: img ? 'summary_large_image' : 'summary', title, description, images: img ? [img] : undefined },
  }
}

/* FR-LB-05, FR-LB-07: the post with its body, author block, date, categories, previous and next, share links and JSON-LD. */
export default async function PostPage({ params }: Args) {
  const { slug } = await params
  const { isEnabled: draft } = await draftMode()
  const post = await getPost(slug, draft)
  if (!post) notFound()
  const site = getServerSideURL()
  const url = `${site}/research/lab-blog/${post.slug}`
  const authors = (post.authors ?? []).filter((a): a is Author => typeof a === 'object')
  const detections = (post.detections ?? []).filter((t): t is Threat => typeof t === 'object')
  const toc = headingsOf(post.content)
  const adj = await getAdjacentPosts(post.publishedAt)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: post.title,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: authors.map((a) => ({ '@type': 'Person', name: a.name })),
    publisher: { '@type': 'Organization', name: 'K7 Labs' },
    mainEntityOfPage: url,
    description: post.excerpt,
  }

  return (
    <>
      {draft && <LivePreviewListener />}
      <ResearchBar active="lab-blog" crumbs={[{ label: 'Research', href: '/research' }, { label: 'Lab Blog', href: '/research/lab-blog' }, { label: 'Post' }]} section />
      <main id="main">
        <article>
          <section className="sheet hero-u g-panel">
            <div className="post-hero">
              <Link className="backlink label" href="/research/lab-blog" style={{ marginBottom: 0 }}>
                <span aria-hidden="true">←</span>All posts
              </Link>
              <div className="tags">
                <CategoryTags post={post} />
              </div>
              <div className="post-hero-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                  <h1>{post.title}</h1>
                  <div className="post-meta">
                    <Byline post={post} link />
                    <span className="label">
                      <time dateTime={iso(post.publishedAt)}>{byline(post.publishedAt)}</time>
                    </span>
                    <span className="label muted">{readingTime(post.searchText)}</span>
                  </div>
                </div>
                <Placeholder className="post-figure" caption="Featured image · 1200 × 600" image={post.featuredImage} size="large" />
              </div>
            </div>
          </section>
          <section className="sheet g-paper" aria-label="Article">
            <div className="article-grid">
              <Toc items={toc} />
              <div>
                <Prose data={post.content} />
                {detections.length > 0 && (
                  <div className="det label" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 32, paddingTop: 12, borderTop: '1px solid var(--fg)' }}>
                    <span className="pixel" aria-hidden="true" />
                    <span>K7 detects</span>
                    {detections.map((t) => (
                      <LidDet name={t.detectionName} href={`/research/top-threats/${t.slug}`} key={t.id} />
                    ))}
                  </div>
                )}
                <div className="share label">
                  <span className="muted">Share</span>
                  <a href={`https://www.linkedin.com/shareArticle?url=${encodeURIComponent(url)}`} style={{ fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: 0 }}>
                    LinkedIn
                  </a>
                  <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`} style={{ fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: 0 }}>
                    X
                  </a>
                  <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} style={{ fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: 0 }}>
                    Facebook
                  </a>
                  <CopyButton url label="Copy link" className="textbtn" />
                </div>
                {authors.map((a) => (
                  <div className="author-card" key={a.id}>
                    <Avatar name={a.name} photo={a.photo} large />
                    <div>
                      <span className="label muted">Written by</span>
                      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.025em', marginTop: 4 }}>{a.name}</div>
                      <p>
                        {a.bio || a.role || 'K7 Labs'}{' '}
                        <Link className="link-u" href={`/research/lab-blog/author/${a.slug}`}>
                          More posts by {a.name}
                        </Link>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </article>
        <section className="sheet g-panel" aria-label="More from the Lab Blog">
          <nav className="pn" aria-label="Previous and next post">
            <div className="irow">
              {adj.prev ? (
                <>
                  <span className="label">← Previous post · {byline(adj.prev.publishedAt)}</span>
                  <span className="irow-title">
                    <Link href={`/research/lab-blog/${adj.prev.slug}`}>{adj.prev.title}</Link>
                  </span>
                </>
              ) : (
                <span className="label muted">This is the first post</span>
              )}
            </div>
            <div className="irow">
              {adj.next ? (
                <>
                  <span className="label">Next post · {byline(adj.next.publishedAt)} →</span>
                  <span className="irow-title">
                    <Link href={`/research/lab-blog/${adj.next.slug}`}>{adj.next.title}</Link>
                  </span>
                </>
              ) : (
                <span className="label muted">This is the latest post</span>
              )}
            </div>
          </nav>
          {adj.more.length > 0 && (
            <>
              <h2 className="label" style={{ margin: '64px 0 14px' }}>
                More from the Lab Blog
              </h2>
              <div className="ilist">
                {adj.more.map((q) => (
                  <div className="irow" key={q.id}>
                    <span className="label" style={{ flex: 'none', width: 112 }}>
                      {byline(q.publishedAt)}
                    </span>
                    <span className="irow-title" style={{ flex: 1 }}>
                      <Link href={`/research/lab-blog/${q.slug}`}>{q.title}</Link>
                    </span>
                    <span className="arrow" aria-hidden="true">
                      →
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  )
}
