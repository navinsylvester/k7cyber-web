import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { ResearchBar } from '@/components/research/Bar'
import { Cover } from '@/components/research/Cover'
import { LeadButton } from '@/components/research/Lead.client'
import { Fresh, StateTab, UHead } from '@/components/research/Parts'
import { getReportYears, listReports } from '@/lib/research/data'
import { byline, bytes } from '@/lib/research/format'
import type { ReportFile, ThreatReport } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

export const metadata: Metadata = {
  title: 'Threat Reports | K7 Labs',
  description: 'Periodic reports on the threat landscape from K7 Labs, including the Cyber Threat Monitor.',
  alternates: { canonical: `${getServerSideURL()}/research/threat-reports` },
}

const size = (r: ThreatReport) => (typeof r.pdf === 'object' && r.pdf ? bytes((r.pdf as ReportFile).filesize) : '')
const Action: React.FC<{ r: ThreatReport; big?: boolean }> = ({ r, big }) =>
  r.gated ? (
    <LeadButton reportId={r.id} title={`${r.title}, ${r.period}`} className={big ? 'btn btn-primary' : 'btn btn-line btn-sm'} />
  ) : (
    <a className={big ? 'btn btn-primary' : 'btn btn-line btn-sm'} href={`/research/threat-reports/download/${r.id}`}>
      Download PDF <span aria-hidden="true">↓</span>
    </a>
  )

/* FR-TR-02, FR-TR-04, FR-TR-05: newest first with cover, title, period and action; year filter; lead capture when gated. */
export default async function ThreatReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams
  const year = Number(sp.year) || undefined
  const [reports, years] = await Promise.all([listReports(year), getReportYears()])
  const lead: ThreatReport | undefined = year ? undefined : reports[0]
  const rest: ThreatReport[] = year ? reports : reports.slice(1)
  return (
    <>
      <ResearchBar active="threat-reports" crumbs={[{ label: 'Research', href: '/research' }, { label: 'Threat Reports' }]} />
      <main id="main">
        <UHead
          icon="archive"
          title="Threat reports"
          lede="Quarterly and annual reports from K7 Labs on what attackers did, what we stopped, and what to prepare for next."
          side={
            <dl className="meta-rows label">
              <dt>Series</dt>
              <dd>Cyber Threat Monitor</dd>
              <dt>Published</dt>
              <dd>Quarterly and annually</dd>
            </dl>
          }
        />
        <section className="sheet g-paper" aria-label="Reports">
          {reports[0] && (
            <StateTab>
              <Fresh label="Latest report" date={reports[0].publishedAt} />
            </StateTab>
          )}
          {lead && (
            <article className="feature g-panel report-feature filed">
              <div className="ftab label">Latest report · published {byline(lead.publishedAt)}</div>
              <Cover period={lead.period} range={lead.periodRange} series={lead.reportType} image={lead.cover} />
              <div className="feature-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h2 className="h-title">
                    {lead.title}, {lead.period}
                  </h2>
                  {lead.periodRange && <span className="label muted">{lead.periodRange}</span>}
                  <p>{lead.summary}</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 24px', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                  <Action r={lead} big />
                  {size(lead) && <span className="label muted">PDF · {size(lead)}</span>}
                </div>
              </div>
            </article>
          )}
          <div className="year-filter">
            <div className="seg seg-l" role="group" aria-label="Filter by year">
              <Link href="/research/threat-reports" aria-pressed={!year} role="button">
                All years
              </Link>
              {years.map((y) => (
                <Link href={`/research/threat-reports?year=${y}`} aria-pressed={year === y} role="button" key={y}>
                  {y}
                </Link>
              ))}
            </div>
            <span className="label muted">
              {reports.length} {reports.length === 1 ? 'report' : 'reports'}, newest first
            </span>
          </div>
          <div style={{ borderTop: '1px solid var(--fg)' }}>
            {rest.map((r) => (
              <article className="report-row" key={r.id}>
                <Cover period={r.period} range={r.periodRange} series={r.reportType} image={r.cover} />
                <div>
                  {r.periodRange && <span className="label muted">{r.periodRange}</span>}
                  <h3>
                    {r.title}, {r.period}
                  </h3>
                  <p>{r.summary}</p>
                </div>
                <div className="report-actions">
                  <Action r={r} />
                  <span className="label">
                    Published {byline(r.publishedAt)}
                    {size(r) ? ` · PDF ${size(r)}` : ''}
                  </span>
                </div>
              </article>
            ))}
            {reports.length === 0 && (
              <p style={{ padding: '40px 0', fontSize: 19, margin: 0 }}>{year ? 'No reports were published in this year.' : 'No reports published yet.'}</p>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
