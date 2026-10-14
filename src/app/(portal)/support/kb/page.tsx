import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Empty } from '@/components/support/Parts'
import { listArticles } from '@/lib/support/kb'
import { optionalSession } from '@/lib/support/session'

export const metadata: Metadata = { title: 'Knowledge base', description: 'Answers about installing, activating, renewing and using K7 products.' }

const PATH = '/support/kb'

/* The public knowledge base: one search field, a numbered list of answers. Agents who land here get the workspace link. */
export default async function KnowledgeBasePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams
  const q = sp.q?.trim().slice(0, 100) ?? ''
  const [articles, user] = await Promise.all([listArticles({ kind: 'service' }, { audience: 'customer', q: q || undefined, top: 50 }).catch(() => []), optionalSession()])
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">K7 Support · Knowledge base</span>
          <h1 className="h-util">{q ? `Answers for “${q}”.` : 'Answers, written by the engineers.'}</h1>
          <p className="lede">Installing, activating, renewing and setting up K7 products. If an article does not settle it, open a case from the bottom of the page.</p>
        </div>
        {user?.kind === 'agent' && (
          <div className="ws-actions">
            <Link className="btn btn-line btn-sm" href="/support/workspace/kb">
              Manage articles
            </Link>
          </div>
        )}
      </div>

      <form className="help-search" action={PATH} method="get" role="search" style={{ marginTop: 0, marginBottom: 'clamp(28px, 3cqw, 44px)' }}>
        <label className="sr-only" htmlFor="kb-q">
          Search the knowledge base
        </label>
        <span className="control">
          <input id="kb-q" name="q" type="search" defaultValue={q} placeholder="Search: activation, renewal, installation…" autoComplete="off" />
          <button type="submit" aria-label="Search">
            →
          </button>
        </span>
      </form>

      <div className="results label">
        <span>
          {articles.length === 0 ? 'No articles' : `${articles.length} ${articles.length === 1 ? 'article' : 'articles'}`}
          {q ? ' match' : ''}
        </span>
        {q && (
          <Link className="link-u" href={PATH}>
            Clear search
          </Link>
        )}
      </div>

      {articles.length === 0 ? (
        <Empty
          label={q ? 'Nothing matched' : 'Nothing published yet'}
          action={
            <Link className="btn btn-primary btn-sm" href="/support/cases/new">
              Open a case →
            </Link>
          }
        >
          {q ? 'Try a shorter word, such as the product name or the error, or tell us about it in a case.' : 'Articles are on their way. In the meantime, open a case and an engineer will help.'}
        </Empty>
      ) : (
        <div className="kb-list ilist">
          {articles.map((a, i) => (
            <div className="irow irow-grid" key={a.knowledgearticleid}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <span className="irow-title">
                <Link href={`${PATH}/${encodeURIComponent(a.articlepublicnumber)}`}>{String(a.title)}</Link>
              </span>
              <span className="arrow" aria-hidden="true">
                →
              </span>
              {a.description ? <span className="desc">{String(a.description)}</span> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
