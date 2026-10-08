import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { ResearchBar } from '@/components/research/Bar'
import { BlogListing } from '@/components/research/BlogListing'
import { StateTab, UHead } from '@/components/research/Parts'
import { findCategoryByPath } from '@/lib/research/data'
import { getServerSideURL } from '@/utilities/getURL'

type Args = { params: Promise<{ path: string[] }>; searchParams: Promise<{ page?: string }> }

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { path } = await params
  const hit = await findCategoryByPath(path)
  if (!hit) return { title: 'Category not found' }
  return {
    title: `${hit.category.title} | Lab Blog | K7 Labs`,
    description: hit.category.description || `Lab Blog posts in ${hit.category.title}.`,
    alternates: { canonical: `${getServerSideURL()}/research/lab-blog/category/${path.join('/')}` },
  }
}

/* FR-LB-03: a category page lists every post in the category and its subcategories. */
export default async function CategoryPage({ params, searchParams }: Args) {
  const { path } = await params
  const sp = await searchParams
  const hit = await findCategoryByPath(path)
  if (!hit) notFound()
  const { category, ids, trail } = hit
  const page = Math.max(1, Number(sp.page) || 1)
  const crumbs = [{ label: 'Research', href: '/research' }, { label: 'Lab Blog', href: '/research/lab-blog' }, ...trail.map((c, i) => ({ label: c.title, href: i < trail.length - 1 ? `/research/lab-blog/category/${path.slice(0, i + 1).join('/')}` : undefined }))]
  return (
    <>
      <ResearchBar active="lab-blog" crumbs={crumbs} section />
      <main id="main">
        <UHead
          icon="surface"
          title={category.title}
          lede={category.description || (category.children.length ? 'Posts filed under a subcategory appear here too.' : undefined)}
          back={{ href: '/research/lab-blog', label: 'All posts' }}
          side={
            category.children.length ? (
              <div>
                <span className="label muted">Includes subcategories</span>
                <div className="subcats">
                  {category.children.map((c) => (
                    <Link className="tag" href={`/research/lab-blog/category/${path.join('/')}/${c.slug}`} key={c.id}>
                      {c.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : undefined
          }
        />
        <BlogListing
          args={{ page, categoryIds: ids }}
          path={`/research/lab-blog/category/${path.join('/')}`}
          base={{}}
          feature={false}
          currentCategory={category.id}
          stateTab={
            <StateTab>
              <span className="pixel" aria-hidden="true" />
              {[category.title, ...category.children.map((c) => c.title)].join(' + ')}
            </StateTab>
          }
          results={
            <>
              <span>Newest first</span>
              <Link className="link-u" href="/research/lab-blog" style={{ fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>
                Clear category
              </Link>
            </>
          }
        />
      </main>
    </>
  )
}
