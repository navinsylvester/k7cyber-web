import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Ledger } from '@/components/support/Ledger'
import { Empty, PageHead, StatusTag, Tid, When } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv } from '@/lib/dataverse/types'
import { searchCases } from '@/lib/support/cases'
import { searchAccounts, searchContacts } from '@/lib/support/customers'
import { dmy } from '@/lib/support/format'
import { listArticles } from '@/lib/support/kb'
import { requireAgent } from '@/lib/support/session'

export const metadata: Metadata = { title: 'Search' }

/* Quick search across the desk: cases first, then the people, then the articles. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const me = await requireAgent()
  const all = sp.all === '1'
  const [found, contacts, accounts, articles] = q
    ? await Promise.all([
        searchCases(me.auth, q, all ? 500 : 20).catch(() => ({ rows: [], total: 0 })),
        searchContacts(me.auth, q, 10).catch(() => []),
        searchAccounts(me.auth, q, 10).catch(() => []),
        listArticles(me.auth, { q, audience: 'agent', state: 'all', top: 10 }).catch(() => []),
      ])
    : [{ rows: [], total: 0 }, [], [], []]
  const cases = found.rows
  const total = found.total + contacts.length + accounts.length + articles.length
  return (
    <>
      <WorkspaceBar active="search" q={q} />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Search</span>}
          title={q ? <>“{q}”</> : 'Search the desk.'}
          lede={q ? `${total} result${total === 1 ? '' : 's'} across cases, customers and articles.` : 'Type a case number, a title, a customer name, an email or a phone number in the bar above.'}
        />

        {q && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(32px, 4cqw, 48px)' }}>
            <div>
              <h2 className="sub-head">
                Cases <span className="label">{found.total > cases.length ? `${cases.length} of ${found.total}` : cases.length}</span>
              </h2>
              {cases.length === 0 ? (
                <Empty label="Cases">No case number, title, incident ID, customer email or customer phone matches.</Empty>
              ) : (
                <Ledger caption="Matching cases" heads={[{ label: 'Case' }, { label: 'Title' }, { label: 'Customer' }, { label: 'Status' }, { label: 'Modified' }]}>
                  {cases.map((c) => (
                    <tr className="row" key={c.incidentid}>
                      <td className="id">
                        <Tid ticket={c.ticketnumber} href={`${WS}/cases/${c.incidentid}`} />
                      </td>
                      <td className="title">{c.title}</td>
                      <td className="text">{fv(c, '_customerid_value')}</td>
                      <td className="status">
                        <StatusTag row={c} />
                      </td>
                      <td className="date">{dmy(c.modifiedon)}</td>
                    </tr>
                  ))}
                </Ledger>
              )}
              {found.total > cases.length && (
                // The list used to stop at 20 without saying so (TR-11).
                <p className="hint" style={{ marginTop: 12 }}>
                  <Link className="link-u" href={`${WS}/search?q=${encodeURIComponent(q)}&all=1`}>
                    Show all {found.total} cases →
                  </Link>
                </p>
              )}
            </div>

            <div className="two-col">
              <div>
                <h2 className="sub-head">
                  Contacts <span className="label">{contacts.length}</span>
                </h2>
                {contacts.length === 0 ? (
                  <Empty label="Contacts">No contact matches by name, email or mobile.</Empty>
                ) : (
                  <div className="mini-rows">
                    {contacts.map((c) => (
                      <Link className="mini-row" href={`${WS}/customers/contacts/${c.contactid}`} key={c.contactid}>
                        <span className="t">{c.fullname}</span>
                        <span className="s">
                          {[c.emailaddress1, c.mobilephone ? String(c.mobilephone) : '', fv(c, '_parentcustomerid_value')].filter(Boolean).join(' · ') || 'No contact details'}
                        </span>
                        <span className="r">
                          <When date={typeof c.modifiedon === 'string' ? c.modifiedon : null} />
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h2 className="sub-head">
                  Accounts <span className="label">{accounts.length}</span>
                </h2>
                {accounts.length === 0 ? (
                  <Empty label="Accounts">No account matches by name or number.</Empty>
                ) : (
                  <div className="mini-rows">
                    {accounts.map((a) => (
                      <Link className="mini-row" href={`${WS}/customers/accounts/${a.accountid}`} key={a.accountid}>
                        <span className="t">{a.name}</span>
                        <span className="s">{[String(a.alletec_accountid ?? a.accountnumber ?? ''), fv(a, 'alletec_accounttype'), fv(a, '_alletec_city_value')].filter(Boolean).join(' · ') || 'Account'}</span>
                        <span className="r">
                          <When date={typeof a.modifiedon === 'string' ? a.modifiedon : null} />
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="sub-head">
                Articles <span className="label">{articles.length}</span>
              </h2>
              {articles.length === 0 ? (
                <Empty label="Knowledge">No article title, keyword or summary matches.</Empty>
              ) : (
                <div className="mini-rows">
                  {articles.map((a) => (
                    <Link className="mini-row" href={`${WS}/kb/${a.knowledgearticleid}`} key={a.knowledgearticleid}>
                      <span className="t">{a.title}</span>
                      <span className="s">
                        {a.articlepublicnumber} · {fv(a, 'statecode')}
                        {a.isinternal ? ' · internal' : ''}
                        {a.description ? ` · ${String(a.description)}` : ''}
                      </span>
                      <span className="r">{dmy(typeof a.modifiedon === 'string' ? a.modifiedon : null)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  )
}
