import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Ledger } from '@/components/support/Ledger'
import { Field, PageHead } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv } from '@/lib/dataverse/types'
import { dmy } from '@/lib/support/format'
import { listArticles } from '@/lib/support/kb'
import { requireAgent } from '@/lib/support/session'

export const metadata: Metadata = { title: 'Knowledge' }

const PATH = `${WS}/kb`
type State = 'published' | 'draft' | 'all'

/* Knowledge for agents (01-requirements.md §4.5): everything, including drafts and internal articles. Publishing stays in Dynamics. */
export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ q?: string; state?: string }> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const q = sp.q?.trim() ?? ''
  const state: State = sp.state === 'draft' || sp.state === 'all' ? sp.state : 'published'
  const rows = await listArticles(me.auth, { q, audience: 'agent', state, top: 50 })
  const href = (s: State) => `${PATH}?state=${s}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  return (
    <>
      <WorkspaceBar active="kb" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Knowledge · {rows.length} shown</span>}
          title="Knowledge articles."
          lede="Search what the desk has written, read it, or draft a new article. Approval and publishing stay in the Customer Service Hub."
          actions={
            <Link className="btn btn-primary btn-sm" href={`${PATH}/new`}>
              New draft →
            </Link>
          }
        />
        <form className="filters-inline" action={PATH} method="get" role="search">
          <input type="hidden" name="state" value={state} />
          <Field id="q" label="Title, keywords or description">
            <input id="q" name="q" type="search" defaultValue={q} placeholder="activation" autoComplete="off" />
          </Field>
          <div className="seg seg-l" role="group" aria-label="State">
            <Link href={href('published')} aria-pressed={state === 'published'}>
              Published
            </Link>
            <Link href={href('draft')} aria-pressed={state === 'draft'}>
              Drafts
            </Link>
            <Link href={href('all')} aria-pressed={state === 'all'}>
              All
            </Link>
          </div>
          <div className="filters-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Search
            </button>
            {q && (
              <Link className="link-u" href={href(state)}>
                Clear
              </Link>
            )}
          </div>
        </form>
        <Ledger caption="Knowledge articles" heads={[{ label: 'Number' }, { label: 'Title' }, { label: 'State' }, { label: 'Audience' }, { label: 'Views' }, { label: 'Modified' }]}>
          {rows.length === 0 && (
            <tr className="empty">
              <td colSpan={6}>No articles match.</td>
            </tr>
          )}
          {rows.map((a) => (
            <tr className="row" key={a.knowledgearticleid}>
              <td className="id">
                <Link className="lid" href={`${PATH}/${a.knowledgearticleid}`}>
                  {a.articlepublicnumber}
                </Link>
              </td>
              <td className="title">
                <Link href={`${PATH}/${a.knowledgearticleid}`}>{a.title}</Link>
                {a.description ? <span className="muted" style={{ display: 'block', fontWeight: 400 }}>{String(a.description)}</span> : null}
              </td>
              <td className="status">
                <span className={`tag${a.statecode === 3 ? ' tag-solid' : ''}`}>{fv(a, 'statecode')}</span>
              </td>
              <td className="text">{a.isinternal ? 'Internal' : 'Customers'}</td>
              <td className="num">{String(a.knowledgearticleviews ?? 0)}</td>
              <td className="date">{dmy(String(a.modifiedon ?? ''))}</td>
            </tr>
          ))}
        </Ledger>
      </section>
    </>
  )
}
