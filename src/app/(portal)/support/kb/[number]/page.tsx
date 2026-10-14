import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { fv } from '@/lib/dataverse/types'
import { dmy } from '@/lib/support/format'
import { getArticle } from '@/lib/support/kb'

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params
  const a = await getArticle({ kind: 'service' }, decodeURIComponent(number), 'customer').catch(() => null)
  return { title: a ? String(a.title) : 'Article' }
}

/* One published article: the number and date as evidence, the body as prose, and the way out when it did not help. */
export default async function ArticlePage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params
  const a = await getArticle({ kind: 'service' }, decodeURIComponent(number), 'customer').catch(() => null)
  if (!a) notFound()
  const keywords = String(a.keywords ?? '')
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 8)
  return (
    <>
      <section className="sheet ws g-panel">
        <span className="label muted">
          <Link href="/support/kb" style={{ textDecoration: 'none' }}>
            Knowledge base
          </Link>{' '}
          / {a.articlepublicnumber}
        </span>
        <div className="article-head" style={{ marginTop: 12, marginBottom: 0 }}>
          <h1>{String(a.title)}</h1>
          {a.description ? <p className="lede">{String(a.description)}</p> : null}
          <div className="meta label">
            <span className="lid">{a.articlepublicnumber}</span>
            <span>Updated {dmy(String(a.modifiedon ?? ''))}</span>
            {fv(a, 'knowledgearticleviews') && Number(a.knowledgearticleviews ?? 0) > 0 ? <span>{fv(a, 'knowledgearticleviews')} views</span> : null}
          </div>
          {keywords.length > 0 && (
            <div className="tags">
              {keywords.map((k) => (
                <Link className="tag" href={`/support/kb?q=${encodeURIComponent(k)}`} key={k}>
                  {k}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="sheet ws g-paper">
        <article className="article">
          {a.html ? <div className="prose" dangerouslySetInnerHTML={{ __html: a.html }} /> : <p className="prose">This article has no body yet.</p>}
        </article>
        <div className="notice" style={{ marginTop: 'clamp(32px, 4cqw, 56px)', maxWidth: 'var(--measure-prose)', flexWrap: 'wrap', alignItems: 'center', gap: '12px 24px' }}>
          <p style={{ flex: '1 1 260px' }}>Did this solve it? If not, tell us what happened and an engineer takes it from here.</p>
          <Link className="btn btn-primary btn-sm" href="/support/cases/new">
            Open a case →
          </Link>
        </div>
      </section>
    </>
  )
}
