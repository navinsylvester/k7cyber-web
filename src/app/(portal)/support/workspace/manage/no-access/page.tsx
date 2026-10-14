import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Empty, PageHead } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getSettings } from '@/lib/support/kpi-config'
import { requireAgent } from '@/lib/support/session'

export const metadata: Metadata = { title: 'Manager view' }

/* Where an agent lands when the manager view is not theirs: what grants it, so the ask to the CRM admin is one sentence. */
export default async function NoAccess() {
  await requireAgent()
  const s = await getSettings()
  return (
    <>
      <WorkspaceBar active="home" />
      <section className="sheet ws g-paper">
        <PageHead above={<span className="label muted">Manager view</span>} title="This view is for service managers." />
        <Empty label="Access">
          The manager view opens for agents holding one of these Dynamics security roles: {s.managerRoles.join(', ')}. A manager can also add your work email on the KPI settings page. Ask your CRM administrator or a manager.
        </Empty>
        <p style={{ marginTop: 24 }}>
          <Link className="btn btn-line btn-sm" href={WS}>
            Back to the workspace
          </Link>
        </p>
      </section>
    </>
  )
}
