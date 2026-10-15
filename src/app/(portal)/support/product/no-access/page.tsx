import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Empty, PageHead } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getProductSettings } from '@/lib/support/product-config'
import { requireAgent } from '@/lib/support/session'

export const metadata: Metadata = { title: 'Product desk' }

/* Where an agent lands when the product desk's inbox or settings are not theirs: what grants it, in one sentence. */
export default async function NoAccess() {
  await requireAgent()
  const s = await getProductSettings()
  return (
    <>
      <WorkspaceBar active="product" />
      <section className="sheet ws g-paper">
        <PageHead above={<span className="label muted">Product desk</span>} title="This part is for principal support and team leads." />
        <Empty label="Access">
          The inbox opens for agents holding one of these Dynamics roles: {s.principals.roles.join(', ') || 'none configured'}{s.principals.managersAreprincipals ? ', and for service managers' : ''}. A lead can also add your work email on the product desk settings page. Settings open for the team leads listed there. You can still raise items from any case and see every item under Product in the workspace.
        </Empty>
        <p style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link className="btn btn-line btn-sm" href={`${WS}/product`}>
            Product, in the workspace
          </Link>
          <Link className="link-u" href={WS}>
            Back to the workspace
          </Link>
        </p>
      </section>
    </>
  )
}
