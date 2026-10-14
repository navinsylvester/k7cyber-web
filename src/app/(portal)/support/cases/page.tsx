import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Empty, Pager, StateTag, Tid, When, qs } from '@/components/support/Parts'
import { CUSTOMER_PAGE, listCustomerCases } from '@/lib/support/cases'
import { htmlToText, truncate } from '@/lib/support/format'
import { requireCustomer } from '@/lib/support/session'

export const metadata: Metadata = { title: 'My cases' }

const PATH = '/support/cases'

/* The customer's cases: open ones first, closed ones a tab away. Each row says where the case stands in plain words. */
export default async function MyCasesPage({ searchParams }: { searchParams: Promise<{ state?: string; page?: string }> }) {
  const sp = await searchParams
  const state: 'open' | 'closed' = sp.state === 'closed' ? 'closed' : 'open'
  const page = Math.max(1, Number(sp.page) || 1)
  const ctx = await requireCustomer(PATH)
  const r = await listCustomerCases(ctx.auth, ctx.scope, { state, page })
  const totalPages = r.total !== undefined ? Math.max(1, Math.ceil(r.total / CUSTOMER_PAGE)) : r.page + (r.nextLink ? 1 : 0)
  const base = { state: state === 'closed' ? 'closed' : undefined }

  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">K7 Support · {ctx.scope.email}</span>
          <h1 className="h-util">My cases.</h1>
          <p className="lede">Every case you have opened with us, with where it stands. Open one to read the replies or add something.</p>
        </div>
        <div className="ws-actions">
          <Link className="btn btn-primary btn-sm" href="/support/cases/new">
            Open a case →
          </Link>
        </div>
      </div>

      <div className="year-filter">
        <div className="seg seg-l" role="group" aria-label="Case state">
          <Link href={PATH} aria-pressed={state === 'open'}>
            Open
          </Link>
          <Link href={`${PATH}?state=closed`} aria-pressed={state === 'closed'}>
            Closed
          </Link>
        </div>
        <span className="label muted">
          {r.total !== undefined ? `${r.total.toLocaleString('en-IN')} ${state} ${r.total === 1 ? 'case' : 'cases'}` : `${state} cases`}
        </span>
      </div>

      {r.value.length === 0 ? (
        <Empty
          label={state === 'open' ? 'No open cases' : 'No closed cases'}
          action={
            state === 'open' ? (
              <Link className="btn btn-line btn-sm" href="/support/cases/new">
                Open a case
              </Link>
            ) : (
              <Link className="link-u" href={PATH}>
                See open cases
              </Link>
            )
          }
        >
          {state === 'open' ? 'Nothing is waiting on us or on you right now. If something is wrong with your K7 product, tell us and we will pick it up.' : 'Cases we have closed will appear here. You can reopen one within 14 days of closing.'}
        </Empty>
      ) : (
        <div className="case-list">
          {r.value.map((c) => {
            const preview = truncate(htmlToText(typeof c.description === 'string' ? c.description : ''), 140)
            return (
              <article className="case-row" key={c.incidentid}>
                <Tid ticket={c.ticketnumber} />
                <span className="when">
                  Updated <When date={c.modifiedon} />
                </span>
                <h3>
                  <Link href={`${PATH}/${encodeURIComponent(c.ticketnumber)}`}>{c.title || 'Untitled case'}</Link>
                </h3>
                {preview && <span className="desc">{preview}</span>}
                <span className="state">
                  <StateTag statuscode={c.statuscode} statecode={c.statecode} />
                  <span className="arrow" aria-hidden="true">
                    →
                  </span>
                </span>
              </article>
            )
          })}
        </div>
      )}

      <Pager page={r.page} totalPages={totalPages} href={(p) => PATH + qs(base, { page: p > 1 ? p : undefined })} label="My cases" newer="Newer" older="Older" />
    </section>
  )
}
