import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { ResearchBar } from '@/components/research/Bar'
import { BlogListing } from '@/components/research/BlogListing'
import { Avatar, StateTab, UHead } from '@/components/research/Parts'
import { getAuthor } from '@/lib/research/data'
import { getServerSideURL } from '@/utilities/getURL'

type Args = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const a = await getAuthor((await params).slug)
  return a ? { title: `${a.name} | Lab Blog | K7 Labs`, description: a.bio || `Posts by ${a.name}, ${a.role ?? 'K7 Labs'}.`, alternates: { canonical: `${getServerSideURL()}/research/lab-blog/author/${a.slug}` } } : { title: 'Author not found' }
}

export default async function AuthorPage({ params, searchParams }: Args) {
  const a = await getAuthor((await params).slug)
  if (!a) notFound()
  const page = Math.max(1, Number((await searchParams).page) || 1)
  return (
    <>
      <ResearchBar active="lab-blog" crumbs={[{ label: 'Research', href: '/research' }, { label: 'Lab Blog', href: '/research/lab-blog' }, { label: a.name }]} section />
      <main id="main">
        <UHead back={{ href: '/research/lab-blog', label: 'All posts' }} title={a.name}>
          <div className="uhead-grid">
            <div className="uhead-main">
              <div className="uhead-title">
                <Avatar name={a.name} photo={a.photo} large />
                <h1 className="h-util">{a.name}</h1>
              </div>
              <p className="lede">{a.bio || a.role}</p>
            </div>
          </div>
        </UHead>
        <BlogListing
          args={{ page, authorId: a.id }}
          path={`/research/lab-blog/author/${a.slug}`}
          base={{}}
          feature={false}
          stateTab={
            <StateTab>
              <span className="pixel" aria-hidden="true" />
              Posts by {a.name}
            </StateTab>
          }
        />
      </main>
    </>
  )
}
