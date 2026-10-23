import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { CategoryTag, CollateralStateTag, FileTag } from '@/components/partner/Collateral'
import { K7Nav } from '@/components/partner/K7Nav'
import { Empty, Flash } from '@/components/partner/Parts'
import { collateralCounts, downloadTallies, K7_COLLATERAL, listCollateral } from '@/lib/partner/collateral'
import { filterLibrary, visibilityText, type CollateralStatus } from '@/lib/partner/collateral-model'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings, PARTNER_TYPE_LABEL } from '@/lib/partner/settings'
import { dmy } from '@/lib/support/format'

export const metadata: Metadata = { title: 'Collateral' }

type SP = { view?: string; q?: string; ok?: string; error?: string }
const VIEWS: { key: CollateralStatus | 'all' | 'nofile'; label: string }[] = [
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'nofile', label: 'Without a file' },
  { key: 'retired', label: 'Retired' },
  { key: 'all', label: 'All' },
]

/* The Marketing Admin's view of the library (FR-MKT-04, decision 9): the items in every state with their rule in words, the
   current version, how often each was taken and by how many organisations. Editing happens in the Payload admin, one click
   away; this page is the ledger that says what partners can see right now. */
export default async function K7CollateralPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireK7Role(['marketingAdmin'], K7_COLLATERAL)
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : 'published') as (typeof VIEWS)[number]['key']
  const [items, counts, settings] = await Promise.all([listCollateral('all'), collateralCounts(), getPartnerSettings()])
  const tallies = await downloadTallies(items.map((i) => i.id))
  const inView = items.filter((i) => (view === 'all' ? true : view === 'nofile' ? i.status !== 'retired' && !i.file : i.status === view))
  const rows = filterLibrary(inView, { q: sp.q?.trim() || undefined })
  const regionName = (code: string) => settings.regions.find((r) => r.code === code)?.name ?? code
  const counter = (label: string, n: number, href: string, hot = false) => (
    <Link className={`kpi${hot && n > 0 ? ' is-signal' : ''}`} href={href} key={label}>
      <span className="n">{n}</span>
      <span className="label">{label}</span>
    </Link>
  )
  return (
    <>
      <K7Nav active="collateral" roles={me.roles} counts={{ collateral: counts.withoutFile }} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">Partner desk · collateral</span>
            <h1 className="h-util">The library.</h1>
            <p className="lede">What partners can download, by state, with each item’s visibility rule and how often it was taken. Items, files and versions are edited in the Payload admin; publish there and it shows here within the minute. Files up to {settings.collateral.maxMb} MB.</p>
          </div>
          <div className="ws-actions">
            <Link className="btn btn-primary" href="/admin/collections/partner-collateral/create">
              Add an item →
            </Link>
            <Link className="link-u" href="/admin/collections/partner-collateral">
              Open the admin
            </Link>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          {counter('Published', counts.published, `${K7_COLLATERAL}?view=published`)}
          {counter('Drafts', counts.draft, `${K7_COLLATERAL}?view=draft`)}
          {counter('Without a file', counts.withoutFile, `${K7_COLLATERAL}?view=nofile`, true)}
          {counter('Retired', counts.retired, `${K7_COLLATERAL}?view=retired`)}
          {counter('Downloads, 30 days', counts.downloads30, `${K7_COLLATERAL}?view=published`)}
        </div>

        <form className="views" action={K7_COLLATERAL} method="get" role="search">
          <div className="seg-choice" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <label key={v.key}>
                <input type="radio" name="view" value={v.key} defaultChecked={view === v.key} />
                {v.label}
              </label>
            ))}
          </div>
          <span className="control" style={{ flex: '1 1 220px', maxWidth: 320 }}>
            <input name="q" type="search" placeholder="Title, product, tag, file name" defaultValue={sp.q ?? ''} aria-label="Search the library" />
            <button type="submit" aria-label="Search">
              →
            </button>
          </span>
        </form>

        {rows.length === 0 ? (
          <Empty label={VIEWS.find((v) => v.key === view)?.label}>{sp.q ? 'Nothing matches.' : items.length === 0 ? 'No item yet. Add one in the admin, upload its file under Files, set the visibility and publish.' : 'Nothing in this view.'}</Empty>
        ) : (
          <div className="filed ledger">
            <span className="ftab label">
              {rows.length} item{rows.length === 1 ? '' : 's'}
            </span>
            <div className="table-wrap">
              <table className="dtable lib-k7">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Filed under</th>
                    <th scope="col">Visible to</th>
                    <th scope="col">Current file</th>
                    <th scope="col">State</th>
                    <th scope="col" className="num">
                      Downloads
                    </th>
                    <th scope="col">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => {
                    const t = tallies.get(i.id)
                    return (
                      <tr className={`row${i.status === 'retired' ? ' is-off' : ''}`} key={i.id}>
                        <td className="title">
                          <Link href={`/admin/collections/partner-collateral/${i.id}`}>{i.title}</Link>
                          {i.tags.length ? <div className="lib-tags">{i.tags.map((x) => `#${x}`).join(' ')}</div> : null}
                        </td>
                        <td className="text">
                          {i.productId ? i.productName : <span className="muted">K7 and the programme</span>}
                          <div>
                            <CategoryTag category={i.category} />
                          </div>
                        </td>
                        <td className="text lib-vis">{visibilityText(i.visibility, (x) => PARTNER_TYPE_LABEL[x], regionName)}</td>
                        <td className="text">
                          {i.file ? (
                            <>
                              <a className="link-u" href={`${K7_COLLATERAL}/${i.id}/download`}>
                                v{i.file.version}
                              </a>{' '}
                              <FileTag name={i.file.name} size={i.file.size} kind={i.file.kind} />
                              {i.versions > 1 ? <div className="muted">{i.versions} versions</div> : null}
                            </>
                          ) : (
                            <span className="is-ending">No file: not shown</span>
                          )}
                        </td>
                        <td className="status">
                          <CollateralStateTag status={i.status} />
                        </td>
                        <td className="num" title={t ? `${t.orgs} organisation${t.orgs === 1 ? '' : 's'}` : ''}>
                          {t ? (
                            <>
                              {t.total}
                              <div className="muted">{t.last30} in 30 days</div>
                            </>
                          ) : (
                            <span className="muted">0</span>
                          )}
                        </td>
                        <td className="num" title={i.updatedAt}>
                          {dmy(i.file?.at ?? i.updatedAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="ledger-foot">
              <span className="label">
                {VIEWS.find((v) => v.key === view)?.label} · the rule in words: an empty rule means every partner; certified-only items show to nobody until the LMS issues certificates
              </span>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
