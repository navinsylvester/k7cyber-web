import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { ChartCard } from '@/components/support/Charts'
import { PageHead } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { DASHBOARDS, runDashboard } from '@/lib/support/dashboards'
import { requireAgent } from '@/lib/support/session'

export const metadata: Metadata = { title: 'Dashboards' }

/* The two phase-1 dashboards, rebuilt from the chart definitions Dynamics holds (01-requirements.md §4.4). */
export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const me = await requireAgent()
  const r = await runDashboard(me.auth, slug)
  if (!r) notFound()
  const { dashboard, charts } = r
  const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  return (
    <>
      <WorkspaceBar active="dashboards" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Dashboards · live from UAT · {now}</span>}
          title={dashboard.name}
          lede={dashboard.description}
          actions={
            <div className="seg seg-l" role="group" aria-label="Dashboard">
              {DASHBOARDS.map((d) => (
                <Link href={`${WS}/dashboards/${d.slug}`} key={d.slug} aria-pressed={d.slug === dashboard.slug}>
                  {d.name}
                </Link>
              ))}
            </div>
          }
        />
        <div className="dash">
          {charts.map((c, i) => (
            <ChartCard chart={c} key={`${c.id}-${i}`} />
          ))}
        </div>
        <p className="hint" style={{ marginTop: 32 }}>
          Each chart runs the aggregate query of the same chart in Dynamics, filtered by the view it is bound to. Numbers match the model-driven app on the same data.
        </p>
      </section>
    </>
  )
}
