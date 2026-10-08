import Link from 'next/link'
import React from 'react'

import type { Author, Category, Post } from '@/payload-types'
import { byline } from '@/lib/research/format'
import { categoryPath, getCategoryTree, getFeaturedPosts, getRecentPosts, type CategoryNode } from '@/lib/research/data'

import { Avatar, Placeholder } from './Parts'

const authorsOf = (p: Post): Author[] => (p.authors ?? []).filter((a): a is Author => typeof a === 'object')
const catsOf = (p: Post): Category[] => (p.categories ?? []).filter((c): c is Category => typeof c === 'object')
const catHref = (c: Category) => `/research/lab-blog/category/${categoryPath(c)}`

export const Byline: React.FC<{ post: Post; link?: boolean }> = ({ post, link }) => {
  const authors = authorsOf(post)
  if (!authors.length) return null
  const a = authors[0]!
  return (
    <div className="byline">
      <Avatar name={a.name} photo={a.photo} />
      {link ? (
        <Link className="name" href={`/research/lab-blog/author/${a.slug}`} style={{ textDecoration: 'none' }}>
          {authors.map((x) => x.name).join(' and ')}
        </Link>
      ) : (
        <span className="name">{authors.map((x) => x.name).join(' and ')}</span>
      )}
    </div>
  )
}

export const CategoryTags: React.FC<{ post: Post; max?: number }> = ({ post, max }) => {
  const cats = catsOf(post)
  const shown = max ? cats.slice(0, max) : cats
  return (
    <>
      {shown.map((c) => (
        <Link className="tag" href={catHref(c)} key={c.id}>
          {c.title}
        </Link>
      ))}
      {max && cats.length > max && <span className="tag tag-quiet">+{cats.length - max}</span>}
    </>
  )
}

/* The lead post of a listing: a feature panel with the image, the latest label and the categories. */
export const PostFeature: React.FC<{ post: Post }> = ({ post }) => (
  <article className="feature g-panel">
    <Placeholder caption="Featured image · 1200 × 600" image={post.featuredImage} size="large" />
    <div className="feature-body">
      <span className="label">Latest · {byline(post.publishedAt)}</span>
      <h2 className="h-title">
        <Link href={`/research/lab-blog/${post.slug}`}>{post.title}</Link>
      </h2>
      <p>{post.excerpt}</p>
      <Byline post={post} />
      <div className="tags">
        <CategoryTags post={post} />
      </div>
    </div>
  </article>
)

const PX = ['62%', '30%', '74%', '44%', '20%', '56%']
export const PostRow: React.FC<{ post: Post; index: number }> = ({ post, index }) => (
  <article className="post-row">
    <div className="date label">{byline(post.publishedAt)}</div>
    <div>
      <h2>
        <Link href={`/research/lab-blog/${post.slug}`}>{post.title}</Link>
      </h2>
      <p>{post.excerpt}</p>
      <div className="byline">
        {authorsOf(post)[0] && <Avatar name={authorsOf(post)[0]!.name} photo={authorsOf(post)[0]!.photo} />}
        <span className="name">{authorsOf(post).map((a) => a.name).join(' and ')}</span>
        <span className="tags">
          <CategoryTags post={post} max={3} />
        </span>
      </div>
    </div>
    <figure className="ph" style={{ '--px': PX[index % 6], '--py': '36%' } as React.CSSProperties} aria-hidden="true">
      {post.featuredImage && typeof post.featuredImage === 'object' && (post.featuredImage.sizes?.small?.url ?? post.featuredImage.url) && (
        <img src={post.featuredImage.sizes?.small?.url ?? post.featuredImage.url!} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </figure>
  </article>
)

const CatItem: React.FC<{ c: CategoryNode; current?: number; child?: boolean }> = ({ c, current, child }) => (
  <>
    <li className={child ? 'child' : undefined}>
      <Link href={catHref(c)} {...(current === c.id ? { 'aria-current': 'page' } : {})}>
        {c.title}
      </Link>
    </li>
    {c.children.map((k) => (
      <CatItem c={k} current={current} child key={k.id} />
    ))}
  </>
)

/* FR-LB-04: Categories, Featured Posts (three) and Recent Posts (three, with thumbnails). */
export const BlogAside: React.FC<{ currentCategory?: number }> = async ({ currentCategory }) => {
  const [tree, featured, recent] = await Promise.all([getCategoryTree(), getFeaturedPosts(), getRecentPosts()])
  const top = tree.slice(0, 10)
  const count = tree.reduce((n, c) => n + 1 + c.children.length, 0)
  return (
    <aside className="blog-aside" aria-label="Browse the blog">
      <div className="aside-block">
        <h2 className="label">Categories</h2>
        <ul className="cat-list">
          {top.map((c) => (
            <CatItem c={c} current={currentCategory} key={c.id} />
          ))}
        </ul>
        <details className="more">
          <summary className="label">All {count} categories</summary>
          <ul className="cat-list" style={{ marginTop: 14 }}>
            {tree.map((c) => (
              <CatItem c={c} current={currentCategory} key={c.id} />
            ))}
          </ul>
        </details>
      </div>
      {featured.length > 0 && (
        <div className="aside-block">
          <h2 className="label">Featured posts</h2>
          <ul className="mini-list">
            {featured.map((p) => (
              <li key={p.id}>
                <Link href={`/research/lab-blog/${p.slug}`}>
                  <span className="t">{p.title}</span>
                  <span className="label muted">{byline(p.publishedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="aside-block">
        <h2 className="label">Recent posts</h2>
        <ul className="mini-list">
          {recent.map((p) => (
            <li key={p.id}>
              <Link className="with-thumb" href={`/research/lab-blog/${p.slug}`}>
                <Placeholder image={p.featuredImage} size="thumbnail" />
                <span>
                  <span className="t">{p.title}</span>
                  <br />
                  <span className="label muted">{byline(p.publishedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="aside-block">
        <a className="rss label" href="/research/lab-blog/feed.xml">
          <span className="pixel" aria-hidden="true" />
          Subscribe by RSS
        </a>
      </div>
    </aside>
  )
}

export const BlogSearch: React.FC<{ q?: string }> = ({ q }) => (
  <form className="field search-field" role="search" action="/research/lab-blog" method="get" style={{ flex: 'none' }}>
    <label className="label" htmlFor="q">
      Search the blog
    </label>
    <span className="control">
      <input id="q" name="q" type="search" placeholder="Title, malware family, technique" defaultValue={q} />
      <button className="go" type="submit" aria-label="Search">
        →
      </button>
    </span>
  </form>
)
