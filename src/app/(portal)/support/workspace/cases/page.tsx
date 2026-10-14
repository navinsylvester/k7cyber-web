import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { ViewTable } from '@/components/support/Ledger'
import { PageHead, qs } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { careForCustomers } from '@/lib/support/csat'
import { getSettings } from '@/lib/support/kpi-config'
import { requireAgent } from '@/lib/support/session'
import { listCaseViews, PHASE1_VIEWS, runCaseView, type View, type ViewGroup } from '@/lib/support/views'

export const metadata: Metadata = { title: 'Cases' }

const PATH = `${WS}/cases`
const DEFAULT_VIEW = 'My Active Cases'
const GROUPS: { key: ViewGroup; label: string }[] = [
  { key: 'mine', label: 'Mine' },
  { key: 'operations', label: 'Operations' },
  { key: 'service-requests', label: 'Service requests' },
  { key: 'reports', label: 'Reports' },
]

type SP = { view?: string; page?: string; q?: string; sort?: string; dir?: string }

/* The view runner: the 21 saved views of the model-driven app, run as the signed-in agent, with search, sort and paging added. */
export default async function CasesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const views = await listCaseViews(me.auth)
  const wanted = (sp.view ?? '').trim() || DEFAULT_VIEW
  const view = views.find((v) => v.id === wanted.toLowerCase() || v.name.toLowerCase() === wanted.toLowerCase())
  if (!view) notFound()
  const page = Math.max(1, Number(sp.page) || 1)
  const q = sp.q?.trim() || undefined
  const dir = sp.dir === 'asc' ? 'asc' : sp.dir === 'desc' ? 'desc' : undefined
  const result = await runCaseView(me.auth, view, { page, q, sort: sp.sort, dir })
  const settings = await getSettings()
  const care = settings.csat.enabled ? await careForCustomers(result.rows.map((r) => String(r._customerid_value ?? '')), settings).catch(() => new Map()) : new Map()
  const base = { view: view.name, q, sort: result.sort, dir: result.sort ? result.dir : undefined }
  const viewHref = (v: View, keepQ = false) => PATH + qs({ view: v.name, q: keepQ ? q : undefined })
  const count = result.total !== undefined ? `${result.total.toLocaleString('en-IN')}${result.totalLimitExceeded ? '+' : ''} cases` : result.rows.length ? `${result.rows.length}${result.more ? '+' : ''} cases` : 'No cases'
  const phase1 = (PHASE1_VIEWS as readonly string[]).map((n) => views.find((v) => v.name === n)).filter((v): v is View => Boolean(v))
  const byGroup = GROUPS.map((g) => ({ ...g, views: views.filter((v) => v.group === g.key) })).filter((g) => g.views.length)

  return (
    <>
      <WorkspaceBar active="cases" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Cases · saved view</span>}
          title={view.name}
          lede={
            <>
              {count}
              {q ? ` matching “${q}”` : ''}
              {result.sort ? ` · sorted by ${result.sort}` : ''}
            </>
          }
          actions={
            <Link className="btn btn-primary btn-sm" href={`${PATH}/new`}>
              New case →
            </Link>
          }
        />

        <div className="views">
          <div className="seg seg-l" role="group" aria-label="Views">
            {phase1.map((v) => (
              <Link href={viewHref(v)} key={v.id} aria-pressed={v.id === view.id}>
                {v.name}
              </Link>
            ))}
          </div>
          <details>
            <summary>All views ({views.length})</summary>
            <div className="menu">
              {byGroup.map((g) => (
                <React.Fragment key={g.key}>
                  <div className="label">{g.label}</div>
                  {g.views.map((v) => (
                    <Link href={viewHref(v)} key={v.id} {...(v.id === view.id ? { 'aria-current': 'page' as const } : {})}>
                      {v.name}
                    </Link>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </details>
        </div>

        <form className="filters-inline" action={PATH} method="get" role="search" aria-label="Search this view">
          <input type="hidden" name="view" value={view.name} />
          {result.sort && <input type="hidden" name="sort" value={result.sort} />}
          {result.sort && <input type="hidden" name="dir" value={result.dir} />}
          <div className="field">
            <label className="label" htmlFor="cases-q">
              Search in this view
            </label>
            <span className="control">
              <input id="cases-q" name="q" type="search" placeholder="Case number, title, customer email or description" defaultValue={q ?? ''} autoComplete="off" />
            </span>
          </div>
          <div className="filters-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Search
            </button>
            {q && (
              <Link className="link-u" href={viewHref(view)}>
                Clear
              </Link>
            )}
          </div>
        </form>

        <ViewTable result={result} path={PATH} base={base} caseHref={(id) => `${PATH}/${id}`} minWidth={Math.max(960, result.columns.length * 112)} care={care} />
        {care.size > 0 && [...care.values()].some((c) => c.level === 'high' || c.level === 'watch') && (
          <p className="caveats">
            A mark before a customer&apos;s name is their care band from recent satisfaction ratings or a manager&apos;s flag: filled signal means handle with care, filled ink means watch. Open the customer for the history.
          </p>
        )}
      </section>
    </>
  )
}
