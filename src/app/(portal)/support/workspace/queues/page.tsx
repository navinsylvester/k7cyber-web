import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Empty, Flash, PageHead, When } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv, type Row } from '@/lib/dataverse/types'
import { myQueueItems, queueItems, type QueueItemRow } from '@/lib/support/queues'
import { getPublicQueues } from '@/lib/support/reference'
import { requireAgent } from '@/lib/support/session'

import { pickAction, releaseAction } from './actions'

export const metadata: Metadata = { title: 'Queues' }

const itemHref = (q: Row): string | null => (String(q.objecttypecode ?? '') === 'incident' && q._objectid_value ? `${WS}/cases/${String(q._objectid_value)}` : null)

const ItemRow: React.FC<{ item: QueueItemRow; action: 'pick' | 'release'; mine?: boolean }> = ({ item, action, mine }) => {
  const href = itemHref(item)
  const worker = fv(item, '_workerid_value')
  return (
    <div className="mini-row has-act">
      <span className="t">{href ? <Link href={href}>{String(item.title ?? '')}</Link> : String(item.title ?? '')}</span>
      <span className="s">
        {fv(item, 'objecttypecode') || 'Item'} · {fv(item, '_queueid_value')} · entered <When date={String(item.enteredon ?? '')} />
        {!mine && worker ? ` · with ${worker}` : ''}
      </span>
      <form className="act" action={action === 'pick' ? pickAction : releaseAction}>
        <input type="hidden" name="id" value={String(item.queueitemid)} />
        <button className="btn btn-line btn-sm" type="submit">
          {action === 'pick' ? 'Pick' : 'Release'}
        </button>
      </form>
    </div>
  )
}

/* Queues (01-requirements.md §4.3): what I picked, and the public queues the desk shares. Personal queues stay in Dynamics. */
export default async function QueuesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const [mine, queues] = await Promise.all([myQueueItems(me.auth, me.userId, 50).catch(() => []), getPublicQueues(me.auth).catch(() => [])])
  const items = await Promise.all(queues.map((q) => queueItems(me.auth, q.id, 25).catch(() => [])))
  return (
    <>
      <WorkspaceBar active="queues" />
      <section className="sheet ws g-paper">
        <PageHead above={<span className="label muted">Queues · {queues.length} public</span>} title="Queues." lede="Pick an item to work on it; release it to hand it back. Items you pick appear on your home page." />
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <div className="two-col">
          <div>
            <h2 className="sub-head">
              Items I am working on <span className="label">{mine.length}</span>
            </h2>
            {mine.length === 0 ? (
              <Empty label="Nothing picked">Pick an item from a queue on the right and it shows up here.</Empty>
            ) : (
              <div className="mini-rows">
                {mine.map((i) => (
                  <ItemRow item={i} action="release" mine key={String(i.queueitemid)} />
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {queues.length === 0 && <Empty label="Public queues">No public queue is active in this environment.</Empty>}
            {queues.map((q, n) => {
              const list = items[n] ?? []
              const open = list.filter((i) => !i._workerid_value)
              return (
                <div key={q.id}>
                  <h2 className="sub-head">
                    {q.name}
                    <span className="label">
                      {open.length} unpicked · {list.length} shown
                    </span>
                  </h2>
                  {list.length === 0 ? (
                    <Empty label="Empty">Nothing is waiting in this queue.</Empty>
                  ) : (
                    <div className="mini-rows">
                      {list.map((i) => (
                        <ItemRow item={i} action={String(i._workerid_value ?? '') === me.userId ? 'release' : 'pick'} key={String(i.queueitemid)} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
