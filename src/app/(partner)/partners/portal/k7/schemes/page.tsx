import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { Empty, Flash } from '@/components/partner/Parts'
import { PhaseTag } from '@/components/partner/Schemes'
import { K7_SCHEMES, listSchemes, schemeCounts, schemeTallies } from '@/lib/partner/schemes'
import { applicabilityText, SCHEME_STATUS_LABEL, schemePhase, searchSchemes, type SchemeStatus } from '@/lib/partner/schemes-model'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings, PARTNER_TYPE_LABEL } from '@/lib/partner/settings'
import { dmy } from '@/lib/support/format'

import { runDueAction } from './actions'

export const metadata: Metadata = { title: 'Schemes' }

type SP = { view?: string; q?: string; ok?: string; error?: string }
type View = 'live' | 'due' | 'published' | 'draft' | 'archived' | 'all'
const VIEWS: { key: View; label: string }[] = [
  { key: 'live', label: 'Open and running' },
  { key: 'due', label: 'Results due' },
  { key: 'published', label: 'Results out' },
  { key: 'draft', label: 'Drafts' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
]

/* The Scheme Admin's ledger (01-requirements.md §9, decision 9): every scheme in every state with its phase, who it is for,
   registrations (the pending ones counted), and where its results stand. Schemes are written in the Payload admin, one click
   away; registrations, runs, adjustments, publication, disputes and payouts happen on the scheme's sheet here. */
export default async function K7SchemesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireK7Role(['schemeAdmin'], K7_SCHEMES)
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : 'live') as View
  const [schemes, counts, settings] = await Promise.all([listSchemes('all'), schemeCounts(), getPartnerSettings()])
  const tallies = await schemeTallies(schemes.map((sc) => sc.id))
  const at = new Date()
  const inView = schemes.filter((sc) => {
    const phase = schemePhase(sc, at)
    if (view === 'all') return true
    if (view === 'live') return sc.status === 'published' && phase !== 'closed'
    if (view === 'due') return sc.status === 'published' && phase === 'closed' && !sc.results.publishedAt
    if (view === 'published') return Boolean(sc.results.publishedAt)
    return sc.status === (view as SchemeStatus)
  })
  const rows = searchSchemes(inView, sp.q ?? '')
  const regionName = (code: string) => settings.regions.find((r) => r.code === code)?.name ?? code
  const counter = (label: string, n: number, href: string, hot = false) => (
    <Link className={`kpi${hot && n > 0 ? ' is-signal' : ''}`} href={href} key={label}>
      <span className="n">{n}</span>
      <span className="label">{label}</span>
    </Link>
  )
  return (
    <>
      <K7Nav active="schemes" roles={me.roles} counts={{ schemes: counts.pending + counts.disputes + counts.due }} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">Partner desk · schemes</span>
            <h1 className="h-util">Incentive schemes.</h1>
            <p className="lede">What partners can register for, who is in, and where each scheme’s results stand. Schemes and their slabs are written in the Payload admin; registrations, the eligibility run, adjustments, publication, disputes and payouts are handled here. Results count the deals the CRM read-back says were won inside the scheme’s dates.</p>
          </div>
          <div className="ws-actions">
            <Link className="btn btn-primary" href="/admin/collections/partner-schemes/create">
              Add a scheme →
            </Link>
            <form action={runDueAction}>
              <button className="link-u textbtn" type="submit" title="Computes every closed scheme that has no results yet; the scheduled job does the same.">
                Compute what is due
              </button>
            </form>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          {counter('Open to register', counts.open, `${K7_SCHEMES}?view=live`)}
          {counter('Running', counts.running, `${K7_SCHEMES}?view=live`)}
          {counter('Registrations waiting', counts.pending, `${K7_SCHEMES}?view=live`, true)}
          {counter('Results due', counts.due, `${K7_SCHEMES}?view=due`, true)}
          {counter('Disputes open', counts.disputes, `${K7_SCHEMES}?view=published`, true)}
          {counter('Payouts not yet paid', counts.payouts, `${K7_SCHEMES}?view=published`)}
        </div>

        <form className="views" action={K7_SCHEMES} method="get" role="search">
          <div className="seg-choice" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <label key={v.key}>
                <input type="radio" name="view" value={v.key} defaultChecked={view === v.key} />
                {v.label}
              </label>
            ))}
          </div>
          <span className="control" style={{ flex: '1 1 220px', maxWidth: 320 }}>
            <input name="q" type="search" placeholder="Name, product, region" defaultValue={sp.q ?? ''} aria-label="Search the schemes" />
            <button type="submit" aria-label="Search">
              →
            </button>
          </span>
        </form>

        {rows.length === 0 ? (
          <Empty label={VIEWS.find((v) => v.key === view)?.label}>{sp.q ? 'Nothing matches.' : schemes.length === 0 ? 'No scheme yet. Add one in the admin with its dates, the partner types and regions it is for, and its slabs; publish it and partners see it within the minute.' : 'Nothing in this view.'}</Empty>
        ) : (
          <div className="filed ledger">
            <span className="ftab label">
              {rows.length} scheme{rows.length === 1 ? '' : 's'}
            </span>
            <div className="table-wrap">
              <table className="dtable sch-k7">
                <thead>
                  <tr>
                    <th scope="col">Scheme</th>
                    <th scope="col">Runs</th>
                    <th scope="col">For</th>
                    <th scope="col">Phase</th>
                    <th scope="col" className="num">
                      Registered
                    </th>
                    <th scope="col">Results</th>
                    <th scope="col" className="num">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sc) => {
                    const t = tallies.get(sc.id)
                    const phase = schemePhase(sc, at)
                    return (
                      <tr className={`row${sc.status === 'archived' ? ' is-off' : ''}`} key={sc.id}>
                        <td className="title">
                          <Link href={`${K7_SCHEMES}/${sc.id}`}>{sc.name}</Link>
                          <div className="muted small">
                            {sc.slabs.length ? `${sc.slabs.length} slab${sc.slabs.length === 1 ? '' : 's'} from ₹${sc.slabs[0]!.threshold.toLocaleString('en-IN')}` : 'No slabs'}
                            {sc.approvalRequired ? ' · K7 approves registrations' : ''}
                          </div>
                        </td>
                        <td className="num">
                          {dmy(sc.startDate)} – {dmy(sc.endDate)}
                          <div className="muted">register by {dmy(sc.registrationDeadline)}</div>
                        </td>
                        <td className="text lib-vis">{applicabilityText(sc, (x) => PARTNER_TYPE_LABEL[x], regionName)}</td>
                        <td className="status">{sc.status === 'published' ? <PhaseTag phase={phase} /> : <span className={sc.status === 'draft' ? 'tag tag-dashed' : 'tag tag-closed'}>{SCHEME_STATUS_LABEL[sc.status]}</span>}</td>
                        <td className="num">
                          {t?.approved ?? 0}
                          {t?.pending ? <div className="is-ending">{t.pending} waiting</div> : null}
                        </td>
                        <td className="text">
                          {sc.results.publishedAt ? (
                            <>
                              Published {dmy(sc.results.publishedAt)}
                              <div className="muted">
                                {t?.eligible ?? 0} of {t?.results ?? 0} eligible{t?.disputes ? ` · ${t.disputes} dispute${t.disputes === 1 ? '' : 's'} open` : ''}
                              </div>
                            </>
                          ) : sc.results.computedAt ? (
                            <>
                              Computed {dmy(sc.results.computedAt)}
                              <div className="is-ending">to review and publish</div>
                            </>
                          ) : phase === 'closed' && sc.status === 'published' ? (
                            <span className="is-ending">To compute</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td className="num lib-act">
                          <Link className="btn btn-line btn-sm" href={`${K7_SCHEMES}/${sc.id}`}>
                            Open
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="ledger-foot">
              <span className="label">{VIEWS.find((v) => v.key === view)?.label} · a scheme is open until its registration deadline, running until its end date, then its results are computed, reviewed and published</span>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
