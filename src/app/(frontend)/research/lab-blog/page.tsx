import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { ResearchBar } from '@/components/research/Bar'
import { BlogSearch } from '@/components/research/Blog'
import { BlogListing } from '@/components/research/BlogListing'
import { UHead } from '@/components/research/Parts'
import { getServerSideURL } from '@/utilities/getURL'

export const metadata: Metadata = {
  title: 'Lab Blog | K7 Labs',
  description: 'Malware analysis and threat research from K7 Labs researchers: how attacks work, what they target, and the indicators to look for.',
  alternates: { canonical: `${getServerSideURL()}/research/lab-blog`, types: { 'application/rss+xml': `${getServerSideURL()}/research/lab-blog/feed.xml` } },
}

export default async function LabBlogPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const q = sp.q?.trim() || undefined
  return (
    <>
      <ResearchBar active="lab-blog" crumbs={[{ label: 'Research', href: '/research' }, { label: 'Lab Blog' }]} />
      <main id="main">
        <UHead icon="surface" title="Lab Blog" lede="Malware analysis and threat research from K7 Labs researchers: how attacks work, what they target, and the indicators to look for." side={<BlogSearch q={q} />} />
        <BlogListing
          args={{ page, q }}
          path="/research/lab-blog"
          base={{ q }}
          results={
            q ? (
              <>
                <span>Results for “{q}” · best match first</span>
                <Link className="link-u" href="/research/lab-blog" style={{ fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>
                  Clear search
                </Link>
              </>
            ) : undefined
          }
        />
      </main>
    </>
  )
}
