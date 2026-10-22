import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { Empty, Flash, OrgStateTag, Pid, TypeTag } from '@/components/partner/Parts'
import { Pager, qs } from '@/components/support/Parts'
import { K7_PARTNERS, listOrgs, orgCounts, type OrgFilter } from '@/lib/partner/organisation'
import { requireK7Role } from '@/lib/partner/session'
import { dmy } from '@/lib/support/format'

export const metadata: Metadata = { title: 'Partners' }

type SP = { status?: string; q?: string; page?: string; ok?: string; error?: string }
const VIEWS: { key: NonNullable<OrgFilter['status']>; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'edits', label: 'Edits waiting' },
]

/* Every organisation in the programme, for Channel Managers (01-requirements.md §2 "views all partners"; M3): the counters, the
   view switch, the search, the ledger newest first. An organisation with a legal-identity edit waiting carries the pixel. */
export default async function K7PartnersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireK7Role(['channelManager'], K7_PARTNERS)
  const status = (VIEWS.some((v) => v.key === sp.status) ? sp.status : 'all') as NonNullable<OrgFilter['status']>
  const page = Math.max(1, Number(sp.page) || 1)
  const [list, counts] = await Promise.all([listOrgs({ status, q: sp.q, page }), orgCounts()])
  const base = { status: status === 'all' ? undefined : status, q: sp.q }
  const counter = (label: string, n: number, href: string, hot = false) => (
    <Link className={`kpi${hot && n > 0 ? ' is-signal' : ''}`} href={href} key={label}>
      <span className="n">{n}</span>
      <span className="label">{label}</span>
    </Link>
  )
  return (
    <>
      <K7Nav active="partners" roles={me.roles} counts={{ partners: counts.edits }} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">Partner desk · partners</span>
            <h1 className="h-util">Who is in the programme.</h1>
            <p className="lede">Every approved organisation, its people and its record. Decide the legal-identity edits that wait here; suspend and reinstate; set a certificate waiver.</p>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          {counter('Edits waiting', counts.edits, `${K7_PARTNERS}?status=edits`, true)}
          {counter('Approved', counts.approved, `${K7_PARTNERS}?status=approved`)}
          {counter('Suspended', counts.suspended, `${K7_PARTNERS}?status=suspended`)}
        </div>

        <form className="views" action={K7_PARTNERS} method="get" role="search">
          <div className="seg-choice" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <label key={v.key}>
                <input type="radio" name="status" value={v.key} defaultChecked={status === v.key} />
                {v.label}
              </label>
            ))}
          </div>
          <span className="control" style={{ flex: '1 1 240px', maxWidth: 360 }}>
            <input name="q" type="search" placeholder="Partner ID, name, city, GSTIN, CRM account" defaultValue={sp.q ?? ''} aria-label="Search partners" />
            <button type="submit" aria-label="Search">
              →
            </button>
          </span>
        </form>

        {list.rows.length === 0 ? (
          <Empty label={VIEWS.find((v) => v.key === status)?.label}>{sp.q ? `Nothing matches “${sp.q}”.` : status === 'edits' ? 'No legal-identity edit is waiting.' : 'No organisation in this view. Approved applications become organisations.'}</Empty>
        ) : (
          <div className="filed ledger">
            <span className="ftab label">
              {list.total} organisation{list.total === 1 ? '' : 's'}
            </span>
            <div className="table-wrap">
              <table className="dtable">
                <thead>
                  <tr>
                    <th scope="col">Partner ID</th>
                    <th scope="col">Organisation</th>
                    <th scope="col">Type</th>
                    <th scope="col">Where</th>
                    <th scope="col">Status</th>
                    <th scope="col">CRM account</th>
                    <th scope="col">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((o) => (
                    <tr className="row" key={o.id}>
                      <td className="id">
                        <Pid id={o.partnerId} href={`${K7_PARTNERS}/${o.partnerId}`} />
                      </td>
                      <td className="title" style={{ position: 'relative' }}>
                        <Link href={`${K7_PARTNERS}/${o.partnerId}`}>
                          {o.pendingLegalEdit && <i className="pixel" aria-label="Legal-identity edit waiting" style={{ marginRight: 8 }} />}
                          {o.name}
                        </Link>
                        {o.tradeName && o.tradeName !== o.name && <div className="muted">{o.tradeName}</div>}
                      </td>
                      <td className="status">
                        <TypeTag type={o.type} />
                      </td>
                      <td className="text">
                        {o.city}
                        {o.city && o.country ? ', ' : ''}
                        {o.country}
                      </td>
                      <td className="status">
                        <OrgStateTag status={o.status} />
                      </td>
                      <td className="text">{o.crm.accountCode || <span className="muted">—</span>}</td>
                      <td className="num" title={o.createdAt}>
                        {o.createdAt ? dmy(o.createdAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ledger-foot">
              <span className="label">
                {VIEWS.find((v) => v.key === status)?.label} · page {list.page} of {list.totalPages}
              </span>
              <Pager page={list.page} totalPages={list.totalPages} href={(p) => `${K7_PARTNERS}${qs(base, { page: p > 1 ? p : undefined })}`} label="Partners pages" />
            </div>
          </div>
        )}
      </section>
    </>
  )
}
