import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Field, Flash, Options, PageHead, Pager, qs, SortHead } from '@/components/support/Parts'
import { ItemTag, Pid, PriorityTag, ProductNav, PRODUCT, WithTag } from '@/components/support/Product'
import { WorkspaceBar } from '@/components/support/WorkspaceBar'
import { dmy, dmyHm } from '@/lib/support/format'
import { asKind, asPriority, asState, asTeam, KIND_LABEL, KINDS, listItems, PRIORITIES, productContext, STATE_LABEL, STATES, teamOf, TEAMS, type ItemRow } from '@/lib/support/product'
import { isLead, requireAgent } from '@/lib/support/session'

export const metadata: Metadata = { title: 'Product items' }

const PATH = `${PRODUCT}/items`
const PAGE = 25

type SP = { state?: string; team?: string; kind?: string; priority?: string; q?: string; sort?: string; dir?: string; page?: string; ok?: string; error?: string }

const sorters: Record<string, (a: ItemRow, b: ItemRow) => number> = {
  number: (a, b) => a.seq - b.seq,
  priority: (a, b) => a.priority.localeCompare(b.priority),
  cases: (a, b) => a.caseCount - b.caseCount,
  raised: (a, b) => a.raisedAt.localeCompare(b.raisedAt),
  activity: (a, b) => a.lastActivityAt.localeCompare(b.lastActivityAt),
}

/* Every item, filterable, as a ledger (10-product-desk.md §4.2). Any agent may read it; actions live on the item. */
export default async function ItemsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const [lead, { settings }] = await Promise.all([isLead(me), productContext()])
  const state = asState(sp.state)
  const team = asTeam(sp.team)
  const kind = asKind(sp.kind)
  const priority = asPriority(sp.priority)
  const q = sp.q?.trim() ?? ''
  const open = !state && sp.state !== 'all'
  const rows = await listItems({ states: state ? [state] : undefined, open, team: team ?? '', kind: kind ?? '', priority: priority ?? '', q }, { limit: 2000 })
  const sort = sp.sort && sorters[sp.sort] ? sp.sort : 'activity'
  const dir = sp.dir === 'asc' ? 'asc' : 'desc'
  rows.sort((a, b) => (dir === 'asc' ? 1 : -1) * sorters[sort]!(a, b))
  const page = Math.max(1, Number(sp.page) || 1)
  const slice = rows.slice((page - 1) * PAGE, page * PAGE)
  const base = { state: sp.state, team: sp.team, kind: sp.kind, priority: sp.priority, q, sort, dir }
  return (
    <>
      <WorkspaceBar active="product" />
      <section className="sheet ws g-paper">
        <ProductNav active="items" lead={lead} />
        <PageHead above={<span className="label muted">Product desk · {rows.length} items</span>} title="Every item." lede="Defects, enhancements and detection issues the desk handed to product, with where each one stands." />
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <form className="filters-inline" action={PATH} method="get" role="search">
          <Field id="q" label="Number, title, product or tracker key">
            <input id="q" name="q" type="search" defaultValue={q} placeholder="PD-0042, BG-3301, a word of the title" autoComplete="off" />
          </Field>
          <Field id="f-state" label="State" select>
            <select id="f-state" name="state" defaultValue={sp.state ?? ''}>
              <option value="">Open</option>
              <option value="all">All</option>
              <Options items={STATES.map((s) => ({ value: s, label: STATE_LABEL[s] }))} />
            </select>
          </Field>
          <Field id="f-team" label="Team" select>
            <select id="f-team" name="team" defaultValue={sp.team ?? ''}>
              <Options items={TEAMS.map((t) => ({ value: t, label: teamOf(settings, t).name }))} empty="Any" />
            </select>
          </Field>
          <Field id="f-kind" label="Kind" select>
            <select id="f-kind" name="kind" defaultValue={sp.kind ?? ''}>
              <Options items={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} empty="Any" />
            </select>
          </Field>
          <Field id="f-priority" label="Priority" select>
            <select id="f-priority" name="priority" defaultValue={sp.priority ?? ''}>
              <Options items={PRIORITIES.map((p) => ({ value: p, label: p }))} empty="Any" />
            </select>
          </Field>
          <div className="filters-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Filter
            </button>
            {(q || sp.state || sp.team || sp.kind || sp.priority) && (
              <Link className="link-u" href={PATH}>
                Clear
              </Link>
            )}
          </div>
        </form>
        <div className="table-wrap">
          <table className="dtable" style={{ minWidth: 1040 }}>
            <caption className="sr-only">Product items</caption>
            <thead>
              <tr>
                <SortHead col="number" label="Item" current={sort} dir={dir} base={base} path={PATH} />
                <th scope="col">Title</th>
                <th scope="col">State</th>
                <SortHead col="priority" label="Priority" current={sort} dir={dir} base={base} path={PATH} />
                <th scope="col">Team</th>
                <th scope="col">Product</th>
                <SortHead col="cases" label="Cases" current={sort} dir={dir} base={base} path={PATH} />
                <th scope="col">With</th>
                <SortHead col="raised" label="Raised" current={sort} dir={dir} base={base} path={PATH} />
                <SortHead col="activity" label="Activity" current={sort} dir={dir} base={base} path={PATH} />
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 && (
                <tr className="empty">
                  <td colSpan={10}>No items match.</td>
                </tr>
              )}
              {slice.map((i) => (
                <tr className="row" key={i.id}>
                  <td className="id">
                    <Pid number={i.number} href={`${PATH}/${i.number}`} />
                  </td>
                  <td className="title">
                    <Link href={`${PATH}/${i.number}`}>{i.title}</Link>
                  </td>
                  <td className="status">
                    <ItemTag item={i} />
                  </td>
                  <td className="status">
                    <PriorityTag priority={i.priority} />
                  </td>
                  <td className="text">{teamOf(settings, i.team).name}</td>
                  <td className="text">{i.productFamily || i.productName}</td>
                  <td className="num">{i.caseCount}</td>
                  <td className="text">
                    <WithTag state={i.state} team={i.team} />
                  </td>
                  <td className="date" title={dmyHm(i.raisedAt)}>
                    {dmy(i.raisedAt)}
                  </td>
                  <td className="date" title={dmyHm(i.lastActivityAt)}>
                    {dmy(i.lastActivityAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ledger-foot label">
          <span>
            Page {page} · {rows.length} items
          </span>
          <Pager page={page} totalPages={Math.max(1, Math.ceil(rows.length / PAGE))} href={(p) => PATH + qs(base, { page: p > 1 ? p : undefined })} label="Items" />
        </div>
      </section>
    </>
  )
}
