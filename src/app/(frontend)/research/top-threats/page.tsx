import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { ResearchBar } from '@/components/research/Bar'
import { Fresh, LidDet, Pager, Prev, qs, SortHead, StateTab, UHead } from '@/components/research/Parts'
import { getLabsStats, getThreatsUpdated, listThreats, TABLE_PAGE, type ThreatArgs } from '@/lib/research/data'
import { dmy } from '@/lib/research/format'
import { getServerSideURL } from '@/utilities/getURL'

export const metadata: Metadata = {
  title: 'Top Threats | K7 Labs',
  description: 'The detections K7 Labs is seeing most, with prevalence, last-seen date and definition version.',
  alternates: { canonical: `${getServerSideURL()}/research/top-threats` },
}

const PATH = '/research/top-threats'
const OS: Record<string, string> = { windows: 'Windows', android: 'Android', linux: 'Linux', macos: 'macOS' }
type SP = { os?: string; prevalence?: string; sort?: string; dir?: string; page?: string }

/* FR-TT-01, 03, 05: sortable table defaulting to last seen, newest first; filters for OS and prevalence; the list's last-updated date. */
export default async function TopThreatsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const args: ThreatArgs = {
    os: sp.os && OS[sp.os] ? sp.os : undefined,
    prevalence: sp.prevalence === 'high' || sp.prevalence === 'low' ? sp.prevalence : undefined,
    sort: sp.sort && ['name', 'os', 'prevalence', 'seen', 'version'].includes(sp.sort) ? sp.sort : 'seen',
    dir: sp.dir === 'asc' ? 'asc' : sp.dir === 'desc' ? 'desc' : undefined,
    page: Math.max(1, Number(sp.page) || 1),
  }
  const [r, stats, updated] = await Promise.all([listThreats(args), getLabsStats(), getThreatsUpdated()])
  const dir = args.dir ?? (args.sort !== 'seen' ? 'asc' : 'desc')
  const base = { os: args.os, prevalence: args.prevalence, sort: args.sort !== 'seen' ? args.sort : undefined, dir: args.dir }
  const filtering = Boolean(args.os || args.prevalence)
  return (
    <>
      <ResearchBar active="top-threats" crumbs={[{ label: 'Research', href: '/research' }, { label: 'Top Threats' }]} />
      <main id="main">
        <UHead
          icon="bars"
          title="Top threats"
          lede="The detections K7 Labs is seeing most across protected devices. Open a detection for file details, behaviour and removal steps."
          side={
            <dl className="meta-rows label">
              <dt>Detections</dt>
              <dd>{stats.counts.threats}</dd>
              <dt>Latest definitions</dt>
              <dd>{stats.definitions ?? '—'}</dd>
            </dl>
          }
        />
        <section className="sheet g-paper" aria-labelledby="tt-cap">
          {updated && (
            <StateTab>
              <Fresh label="List updated" date={updated.updatedAt} />
            </StateTab>
          )}
          <form className="filters" key={qs(base)} action={PATH} method="get" aria-label="Filter threats">
            {args.sort !== 'seen' && <input type="hidden" name="sort" value={args.sort} />}
            {args.dir && <input type="hidden" name="dir" value={args.dir} />}
            <div className="field" style={{ flex: '0 1 260px' }}>
              <label className="label" htmlFor="f-os">
                Affected OS
              </label>
              <span className="control is-select">
                <select id="f-os" name="os" defaultValue={args.os ?? ''}>
                  <option value="">All systems</option>
                  {Object.entries(OS).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </span>
            </div>
            <div className="field" style={{ flex: '0 1 260px' }}>
              <label className="label" htmlFor="f-prev">
                Prevalence
              </label>
              <span className="control is-select">
                <select id="f-prev" name="prevalence" defaultValue={args.prevalence ?? ''}>
                  <option value="">Any prevalence</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </span>
            </div>
            <div className="filters-actions">
              <button className="btn btn-line btn-sm" type="submit">
                Apply
              </button>
              {filtering && (
                <Link className="link-u" href={PATH}>
                  Clear filters
                </Link>
              )}
            </div>
          </form>
          <div className="results label">
            <span id="tt-cap">
              Showing {r.docs.length} of {r.totalDocs} · sorted by {args.sort === 'seen' ? 'last seen' : args.sort}, {dir === 'desc' ? 'newest' : 'A to Z'} first
            </span>
            <span>Select a column to sort</span>
          </div>
          <div className="table-wrap">
            <table className="dtable" style={{ minWidth: 760 }}>
              <caption className="sr-only">Top threats detected by K7 Labs</caption>
              <thead>
                <tr>
                  <SortHead col="name" label="K7 detection name" current={args.sort!} dir={dir} base={base} path={PATH} />
                  <SortHead col="os" label="Affected OS" current={args.sort!} dir={dir} base={base} path={PATH} />
                  <SortHead col="prevalence" label="Prevalence" current={args.sort!} dir={dir} base={base} path={PATH} />
                  <SortHead col="seen" label="Last seen" current={args.sort!} dir={dir} base={base} path={PATH} />
                  <SortHead col="version" label="AV definition version" current={args.sort!} dir={dir} base={base} path={PATH} />
                </tr>
              </thead>
              <tbody>
                {r.docs.map((t) => (
                  <tr className="row" key={t.id}>
                    <td className="id">
                      <LidDet name={t.detectionName} href={`/research/top-threats/${t.slug}`} />
                    </td>
                    <td>{(t.affectedOs ?? []).map((o) => OS[o] ?? o).join(', ')}</td>
                    <td>
                      <Prev value={t.prevalence} />
                    </td>
                    <td className="date">{dmy(t.lastSeen)}</td>
                    <td className="ver">{t.avDefinitionVersion}</td>
                  </tr>
                ))}
                {r.docs.length === 0 && (
                  <tr className="empty">
                    <td colSpan={5}>
                      No detections match these filters.{' '}
                      <Link className="link-u" href={PATH}>
                        Clear filters
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={args.page!} totalPages={r.totalPages} href={(n) => PATH + qs(base, { page: n > 1 ? n : undefined })} label="Threat pages" count={`${TABLE_PAGE} per page`} />
        </section>
      </main>
    </>
  )
}
