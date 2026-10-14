import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Icon } from '@/components/k7/Icon'
import { countCustomerCases } from '@/lib/support/cases'
import { listArticles } from '@/lib/support/kb'
import { optionalSession } from '@/lib/support/session'

export const metadata: Metadata = { title: 'K7 Support', description: 'Open a case, follow its progress and find answers about your K7 products.' }

/* The help centre: one question, three ways in, the answers people read most, and one signal sheet for the case nobody could find an answer for. */
export default async function SupportHome() {
  const user = await optionalSession()
  const customer = user?.kind === 'customer' && user.contactId ? { contactId: user.contactId, accountId: user.accountId ?? null, email: user.email ?? '' } : null
  const [counts, articles] = await Promise.all([
    customer ? countCustomerCases({ kind: 'service' }, customer).catch(() => null) : Promise.resolve(null),
    listArticles({ kind: 'service' }, { audience: 'customer', top: 6 }).catch(() => []),
  ])
  const first = (user?.name ?? '').split(' ')[0]
  return (
    <>
      <section className="sheet help-hero g-panel" aria-labelledby="help-h">
        <div className="hero-meta label">
          <span>K7 Support · Help centre</span>
          <span>{user?.kind === 'agent' ? <Link href="/support/workspace">Open the workspace →</Link> : customer ? `Signed in as ${user?.email}` : 'Mon–Sat 09:00–18:00 IST'}</span>
        </div>
        <h1 id="help-h" className="h-page">
          {first && customer ? `Hello ${first}. ` : ''}How can we help?
        </h1>
        <form className="help-search" action="/support/kb" method="get" role="search">
          <label className="sr-only" htmlFor="help-q">
            Search the knowledge base
          </label>
          <span className="control">
            <input id="help-q" name="q" type="search" placeholder="Search answers: activation, renewal, installation…" autoComplete="off" />
            <button type="submit" aria-label="Search">
              →
            </button>
          </span>
        </form>
        {customer && counts ? (
          <div className="mine-strip">
            <Link href="/support/cases">
              <span className="n">{counts.open}</span>
              <span className="label">Open cases</span>
            </Link>
            <Link href="/support/cases">
              <span className="n">{counts.waiting}</span>
              <span className="label">Waiting for you</span>
            </Link>
            <Link href="/support/cases?state=closed">
              <span className="n">{counts.closed}</span>
              <span className="label">Closed</span>
            </Link>
            <Link href="/support/cases/new">
              <span className="n">+</span>
              <span className="label">Open a new case</span>
            </Link>
          </div>
        ) : (
          !user && (
            <div className="actions" style={{ marginTop: 'clamp(24px, 3cqw, 40px)' }}>
              <Link className="btn btn-primary" href="/support/cases/new">
                Open a case →
              </Link>
              <Link className="btn btn-line" href="/support/sign-in">
                Sign in to see my cases
              </Link>
            </div>
          )
        )}
      </section>

      <section className="sheet g-paper" aria-labelledby="ways-h">
        <div className="sheet-tab label" style={{ '--k': 1 } as React.CSSProperties}>
          <span>
            <span className="pixel" aria-hidden="true" />
            <span>02/04</span>
          </span>
          <span>Three ways in</span>
        </div>
        <div className="sheet-head">
          <h2 id="ways-h" className="h-sheet">
            Tell us, track it, <span className="dim">or read it.</span>
          </h2>
          <p className="body-l">A case is a conversation with a K7 engineer. You can follow every step here and reply when we need something from you.</p>
        </div>
        <div className="paths ilist" style={{ marginTop: 'clamp(32px, 4cqw, 56px)' }}>
          <div className="irow">
            <Icon name="document" />
            <span className="irow-title">
              <Link href="/support/cases/new">Open a case</Link>
            </span>
            <span className="desc">Describe the problem once. We route it to the right engineer and keep you posted by email and here.</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </div>
          <div className="irow">
            <Icon name="ledger" />
            <span className="irow-title">
              <Link href="/support/cases">Track my cases</Link>
            </span>
            <span className="desc">See where each case stands, read the replies, add a screenshot, or reopen one that closed too soon.</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </div>
          <div className="irow">
            <Icon name="surface" />
            <span className="irow-title">
              <Link href="/support/kb">Browse answers</Link>
            </span>
            <span className="desc">Activation, renewals, installation and settings, written by the engineers who handle those cases.</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </div>
        </div>
      </section>

      <section className="sheet g-panel" aria-labelledby="kb-h">
        <div className="sheet-tab label" style={{ '--k': 0.5 } as React.CSSProperties}>
          <span>
            <span className="pixel" aria-hidden="true" />
            <span>03/04</span>
          </span>
          <span>Answers</span>
        </div>
        <div className="sheet-head">
          <h2 id="kb-h" className="h-sheet">
            Read first. <span className="dim">Most cases end here.</span>
          </h2>
          <p className="body-l">The articles our customers open most. Each one says exactly what to click.</p>
        </div>
        <div className="kb-list ilist" style={{ marginTop: 'clamp(32px, 4cqw, 56px)' }}>
          {articles.length === 0 && <p className="hint" style={{ padding: '24px 0' }}>Articles are on their way.</p>}
          {articles.map((a, i) => (
            <div className="irow irow-grid" key={a.knowledgearticleid}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <span className="irow-title">
                <Link href={`/support/kb/${encodeURIComponent(a.articlepublicnumber)}`}>{String(a.title)}</Link>
              </span>
              <span className="arrow" aria-hidden="true">
                →
              </span>
              {a.description ? <span className="desc">{String(a.description)}</span> : null}
            </div>
          ))}
        </div>
        <div className="actions" style={{ marginTop: 28 }}>
          <Link className="link-u" href="/support/kb">
            All articles
          </Link>
        </div>
      </section>

      <section className="sheet g-signal cta-sheet" aria-labelledby="cta-h">
        <div className="sheet-tab label" style={{ '--k': 0 } as React.CSSProperties}>
          <span>
            <span className="pixel" aria-hidden="true" />
            <span>04/04</span>
          </span>
          <span>Still stuck</span>
        </div>
        <div className="sheet-head">
          <h2 id="cta-h" className="h-sheet">
            Could not find it? <span className="dim">Tell us.</span>
          </h2>
          <p>Open a case and a K7 engineer picks it up. Most consumer cases are resolved within two hours of first contact; enterprise cases within four.</p>
        </div>
        <div className="cta-actions">
          <Link className="btn btn-primary" href="/support/cases/new">
            Open a case →
          </Link>
          <Link className="link-u" href="/contact-us">
            Call or write to us
          </Link>
        </div>
      </section>
    </>
  )
}
