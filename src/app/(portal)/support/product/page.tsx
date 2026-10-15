import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { Empty, Flash, PageHead } from '@/components/support/Parts'
import { ItemRowLine, ProductNav, PRODUCT } from '@/components/support/Product'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { cadenceReading, deskCounts, openItems, productContext, triageReading } from '@/lib/support/product'
import { pendingMirrorCount } from '@/lib/support/product-mirror'
import { isLead, isPrincipal, requireAgent } from '@/lib/support/session'

export const metadata: Metadata = { title: 'Product desk' }

/* Principal support's inbox (10-product-desk.md §4.2): raised items oldest first with the triage clock, questions waiting on the desk,
   then what is with product by team with its cadence, and the counters. An agent who is not principal support lands on the desk's own
   tab instead. */
export default async function ProductInbox({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams
  const me = await requireAgent()
  if (!(await isPrincipal(me))) redirect(`${WS}/product`)
  const [lead, ctx, items, counts, owed] = await Promise.all([isLead(me), productContext(), openItems(), deskCounts(), pendingMirrorCount()])
  const { settings, hours, now } = ctx
  const raised = items.filter((i) => i.state === 'raised')
  const asked = items.filter((i) => i.state === 'needs-info')
  const tracked = items.filter((i) => i.state === 'tracked' || i.state === 'fixed')
  const released = items.filter((i) => i.state === 'released')
  const late = raised.filter((i) => triageReading(i, settings, hours, now).state === 'breached').length
  const stale = tracked.filter((i) => cadenceReading(i, settings, hours, now).state === 'breached').length
  const counter = (label: string, n: number, href: string, hot = false) => (
    <Link className={`kpi${hot && n > 0 ? ' is-signal' : ''}`} href={href} key={label}>
      <span className="n">{n}</span>
      <span className="label">{label}</span>
    </Link>
  )
  return (
    <>
      <WorkspaceBar active="product" />
      <section className="sheet ws g-paper">
        <ProductNav active="inbox" lead={lead} counts={{ raised: counts.raised, needsInfo: counts['needs-info'] }} />
        <PageHead above={<span className="label muted">Product desk · principal support</span>} title="What product owes the desk, and what the desk owes product." lede="Triage what agents raised, keep the loop with engineering and the Lab honest, and tell the desk when something ships." />
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          {counter('To triage', raised.length, `${PRODUCT}/items?state=raised`, late > 0)}
          {counter('Past triage target', late, `${PRODUCT}/items?state=raised`, true)}
          {counter('Waiting on the desk', asked.length, `${PRODUCT}/items?state=needs-info`)}
          {counter('With product', tracked.length, `${PRODUCT}/items?state=tracked`)}
          {counter('No update in time', stale, `${PRODUCT}/items?state=tracked`, true)}
          {counter('Released, not closed', released.length, `${PRODUCT}/items?state=released`)}
          {counter('CRM writes waiting', owed, `${PRODUCT}/items`, false)}
        </div>

        <h2 className="sub-head">
          To triage <span className="label">{raised.length}</span>
        </h2>
        {raised.length === 0 ? (
          <Empty label="Inbox">Nothing waits for triage. Agents raise items from the case sheet.</Empty>
        ) : (
          <div style={{ borderTop: '1px solid var(--fg)', marginBottom: 40 }}>
            {raised.map((i) => (
              <ItemRowLine key={i.id} item={i} settings={settings} audience="principal" clock={triageReading(i, settings, hours, now)} facts={<span>raised by {i.raisedBy.name}</span>} action={<Link className="btn btn-line btn-sm" href={`${PRODUCT}/items/${i.number}`}>Triage →</Link>} />
            ))}
          </div>
        )}

        {asked.length > 0 && (
          <>
            <h2 className="sub-head">
              Waiting on the desk <span className="label">{asked.length}</span>
            </h2>
            <div style={{ borderTop: '1px solid var(--fg)', marginBottom: 40 }}>
              {asked.map((i) => (
                <ItemRowLine key={i.id} item={i} settings={settings} audience="principal" facts={<span>owner {i.supportOwner.name || '—'}</span>} />
              ))}
            </div>
          </>
        )}

        <h2 className="sub-head">
          With product <span className="label">{tracked.length}</span>
        </h2>
        {tracked.length === 0 ? (
          <Empty label="With product">Nothing is being worked on right now.</Empty>
        ) : (
          <div style={{ borderTop: '1px solid var(--fg)', marginBottom: 40 }}>
            {tracked.map((i) => (
              <ItemRowLine key={i.id} item={i} settings={settings} audience="principal" clock={cadenceReading(i, settings, hours, now)} clockLabel="Update due" facts={i.productOwner ? <span>{i.productOwner}</span> : undefined} />
            ))}
          </div>
        )}

        {released.length > 0 && (
          <>
            <h2 className="sub-head">
              Released, waiting for the desk to close <span className="label">{released.length}</span>
            </h2>
            <div style={{ borderTop: '1px solid var(--fg)' }}>
              {released.map((i) => (
                <ItemRowLine key={i.id} item={i} settings={settings} audience="principal" facts={<span>{i.releasedVersion}</span>} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  )
}
