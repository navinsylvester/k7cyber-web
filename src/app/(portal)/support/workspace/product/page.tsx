import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Ledger } from '@/components/support/Ledger'
import { Empty, Field, Flash, PageHead } from '@/components/support/Parts'
import { ItemRowLine, Pid, PRODUCT } from '@/components/support/Product'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv, lookup } from '@/lib/dataverse/types'
import { dmy, dmyHm } from '@/lib/support/format'
import { deskView, productContext } from '@/lib/support/product'
import { listDefects, listRfes } from '@/lib/support/rfe'
import { isPrincipal, requireAgent } from '@/lib/support/session'

import { answerAction, closeAction, toldAction } from '../../product/items/[number]/actions'

export const metadata: Metadata = { title: 'Product desk' }

const PATH = `${WS}/product`

type View = 'desk' | 'rfes' | 'defects'
type SP = { view?: string; q?: string; ok?: string; error?: string }

/* The desk's side of the product loop (10-product-desk.md §4.1): what product needs from you first, then what shipped and who still has to
   hear it, then the items you raised or own, then everything open. The CRM's own RFE and defect lists are two views of the same page since the
   merge of 2026-10-14: rows the desk creates as the mirror of an item, plus the rows raised before the desk existed (pre-sales RFEs among them). */
export default async function WorkspaceProduct({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const view: View = sp.view === 'rfes' || sp.view === 'defects' ? sp.view : 'desk'
  const [principal, { settings }] = await Promise.all([isPrincipal(me), productContext()])
  const q = sp.q?.trim() ?? ''
  const seg = (
    <div className="seg seg-l" role="group" aria-label="View" style={{ marginBottom: 24 }}>
      <Link href={PATH} aria-pressed={view === 'desk'}>
        The loop
      </Link>
      <Link href={`${PATH}?view=rfes`} aria-pressed={view === 'rfes'}>
        RFEs in the CRM
      </Link>
      <Link href={`${PATH}?view=defects`} aria-pressed={view === 'defects'}>
        Defects in the CRM
      </Link>
    </div>
  )

  if (view !== 'desk') {
    const rows = view === 'rfes' ? await listRfes(me.auth, { q, top: 50 }) : await listDefects(me.auth, { q, top: 50 })
    return (
      <>
        <WorkspaceBar active="product" />
        <section className="sheet ws g-paper">
          <PageHead
            above={<span className="label muted">Product desk · {view === 'rfes' ? 'RFEs' : 'defects'} in the CRM · {rows.length} shown</span>}
            title={view === 'rfes' ? 'Requests for enhancement, as the CRM holds them.' : 'Defects, as the CRM holds them.'}
            lede={view === 'rfes' ? 'Every k7_rfe row: the ones the desk creates as the mirror of an enhancement item, and the older ones, pre-sales RFEs among them. New ones for a case come from the Escalate to product panel.' : 'Every k7_defect row: the ones the desk creates as the mirror of a defect or detection item, and the ones raised before the desk existed.'}
            actions={
              view === 'rfes' ? (
                <Link className="btn btn-line btn-sm" href={`${WS}/rfe/new`} title="For an RFE without a case, such as a pre-sales request">
                  New RFE without a case
                </Link>
              ) : undefined
            }
          />
          {seg}
          <form className="filters-inline" action={PATH} method="get" role="search">
            <input type="hidden" name="view" value={view} />
            <Field id="q" label={view === 'rfes' ? 'Title, number or YODIZ id' : 'Title or number'}>
              <input id="q" name="q" type="search" defaultValue={q} placeholder={view === 'rfes' ? 'RF0224' : 'DF0094'} autoComplete="off" />
            </Field>
            <div className="filters-actions">
              <button className="btn btn-line btn-sm" type="submit">
                Search
              </button>
              {q && (
                <Link className="link-u" href={`${PATH}?view=${view}`}>
                  Clear
                </Link>
              )}
            </div>
          </form>
          {view === 'rfes' ? (
            <Ledger caption="Requests for enhancement" heads={[{ label: 'Number' }, { label: 'Title' }, { label: 'Status' }, { label: 'Type' }, { label: 'Case' }, { label: 'YODIZ' }, { label: 'Modified' }]} minWidth={900}>
              {rows.length === 0 && (
                <tr className="empty">
                  <td colSpan={7}>No RFEs match.</td>
                </tr>
              )}
              {rows.map((r) => {
                const id = String(r.k7_rfeid)
                const c = lookup(r, 'k7_case') ?? lookup(r, 'k7_associatedcaseno')
                return (
                  <tr className="row" key={id}>
                    <td className="id">
                      <Link className="lid" href={`${WS}/rfe/${id}`}>
                        {String(r.k7_rfeno ?? '') || '—'}
                      </Link>
                    </td>
                    <td className="title">
                      <Link href={`${WS}/rfe/${id}`}>{String(r.k7_rfetitle ?? '')}</Link>
                    </td>
                    <td className="status">
                      <span className={`tag${/^open|in-progress/i.test(fv(r, 'k7_rfestatus')) ? ' tag-solid' : ''}`}>{fv(r, 'k7_rfestatus') || '—'}</span>
                    </td>
                    <td className="text">{fv(r, 'k7_rfetype')}</td>
                    <td className="text">{c ? <Link href={`${WS}/cases/${c.id}`}>{c.name}</Link> : ''}</td>
                    <td className="ver">{String(r.k7_yodizid ?? '')}</td>
                    <td className="date">{dmy(String(r.modifiedon ?? ''))}</td>
                  </tr>
                )
              })}
            </Ledger>
          ) : (
            <Ledger caption="Defects" heads={[{ label: 'Number' }, { label: 'Title' }, { label: 'Status' }, { label: 'Priority' }, { label: 'Case' }, { label: 'YODIZ' }, { label: 'Modified' }]} minWidth={900}>
              {rows.length === 0 && (
                <tr className="empty">
                  <td colSpan={7}>No defects match.</td>
                </tr>
              )}
              {rows.map((d) => {
                const c = lookup(d, 'k7_associatedcaseno')
                return (
                  <tr className="row" key={String(d.k7_defectid)}>
                    <td className="id">
                      <span className="lid">{String(d.k7_defectno ?? '') || '—'}</span>
                    </td>
                    <td className="title">{String(d.k7_defecttitle ?? '')}</td>
                    <td className="status">
                      <span className="tag">{fv(d, 'k7_defectstatus') || '—'}</span>
                    </td>
                    <td className="text">{fv(d, 'k7_priority')}</td>
                    <td className="text">{c ? <Link href={`${WS}/cases/${c.id}`}>{c.name}</Link> : ''}</td>
                    <td className="ver">{String(d.k7_yodizid ?? '')}</td>
                    <td className="date">{dmy(String(d.modifiedon ?? ''))}</td>
                  </tr>
                )
              })}
            </Ledger>
          )}
        </section>
      </>
    )
  }

  const desk = await deskView(me)
  const hidden = (number: string) => (
    <>
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="return" value={PATH} />
    </>
  )
  return (
    <>
      <WorkspaceBar active="product" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Product desk · {desk.open.length} open items</span>}
          title="Between the desk and product."
          lede="Items raised from cases: what product needs from you, what shipped and who still has to hear it, and where everything else stands. Enhancements are the CRM's RFEs; defects and detection issues are its defects."
          actions={
            <>
              {principal && (
                <Link className="btn btn-primary btn-sm" href={PRODUCT}>
                  Principal inbox →
                </Link>
              )}
              <Link className="btn btn-line btn-sm" href={`${PRODUCT}/items`}>
                All items
              </Link>
            </>
          }
        />
        {seg}
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <h2 className="sub-head">
          Product needs an answer <span className="label">{desk.needsInfo.length}</span>
        </h2>
        {desk.needsInfo.length === 0 ? (
          <Empty label="Questions">Nothing waits on the desk.</Empty>
        ) : (
          <div style={{ borderTop: '1px solid var(--fg)', marginBottom: 40 }}>
            {desk.needsInfo.map((i) => (
              <ItemRowLine
                key={i.id}
                item={i}
                settings={settings}
                audience="support"
                facts={<span>owner {i.supportOwner.name || '—'}</span>}
                action={
                  <form action={answerAction}>
                    {hidden(i.number)}
                    <input name="text" type="text" placeholder="Your answer" required aria-label={`Answer on ${i.number}`} style={{ minWidth: 220 }} />
                    <button className="btn btn-line btn-sm" type="submit">
                      Answer
                    </button>
                  </form>
                }
              />
            ))}
          </div>
        )}

        <h2 className="sub-head">
          Shipped: tell the customer, then close <span className="label">{desk.toTell.reduce((n, x) => n + x.cases.length, 0)} to tell · {desk.toTell.filter((x) => !x.cases.length).length} to close</span>
        </h2>
        {desk.toTell.length === 0 ? (
          <Empty label="Released">Nothing shipped that a customer has not heard about.</Empty>
        ) : (
          <div style={{ borderTop: '1px solid var(--fg)', marginBottom: 40 }}>
            {desk.toTell.map(({ item, cases }) => (
              <div className="board-row item-row" key={item.id}>
                <div>
                  <div className="t">
                    <Pid number={item.number} href={`${PRODUCT}/items/${item.number}`} /> <Link href={`${PRODUCT}/items/${item.number}`}>{item.title}</Link>
                  </div>
                  <div className="s">
                    <span className="tag tag-solid">Released{item.releasedVersion ? ` · ${item.releasedVersion}` : ''}</span>
                    {item.releaseNote && <span>{item.releaseNote}</span>}
                    {item.releasedAt && <span>on {dmyHm(item.releasedAt)}</span>}
                  </div>
                  {cases.length > 0 && (
                    <div className="mini-rows" style={{ marginTop: 10 }}>
                      {cases.map((c) => (
                        <div className="mini-row has-act" key={c.id}>
                          <span className="t">
                            <Link href={`${WS}/cases/${c.caseId}`}>{c.ticket}</Link> {c.title}
                          </span>
                          <span className="s">
                            {c.accountName ? `${c.accountName} · ` : ''}
                            {c.supportOwner.name || 'unowned'}
                            {c.caseChoice === 'workaround-resolved' ? ' · resolved with a workaround' : ''}
                          </span>
                          <span className="act">
                            <form action={toldAction} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {hidden(item.number)}
                              <input type="hidden" name="caseId" value={c.caseId} />
                              <input type="hidden" name="post" value="1" />
                              <button className="btn btn-line btn-sm" type="submit" title="Posts the release line as a reply on the case and marks the customer told">
                                Tell the customer
                              </button>
                            </form>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="item-row-clock">
                  <span className="label muted">{cases.length ? `${cases.length} of ${item.caseCount} still to tell` : 'every customer told'}</span>
                </div>
                <div className="acts-inline">
                  {cases.length === 0 && (
                    <form action={closeAction}>
                      {hidden(item.number)}
                      <button className="btn btn-line btn-sm" type="submit">
                        Close item
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="sub-head">
          Mine <span className="label">{desk.mine.length}</span>
        </h2>
        {desk.mine.length === 0 ? (
          <Empty label="Mine">You have raised nothing that is still open. Escalate from a case sheet when the product, not the desk, has to act.</Empty>
        ) : (
          <div style={{ borderTop: '1px solid var(--fg)', marginBottom: 40 }}>
            {desk.mine.map((i) => (
              <ItemRowLine key={i.id} item={i} settings={settings} audience="support" facts={i.crmRef ? <span>{i.crmRef}</span> : undefined} />
            ))}
          </div>
        )}

        <h2 className="sub-head">
          Everything open <span className="label">{desk.open.length}</span>
        </h2>
        {desk.open.length === 0 ? (
          <Empty label="Open items">No item is open.</Empty>
        ) : (
          <div style={{ borderTop: '1px solid var(--fg)' }}>
            {desk.open.map((i) => (
              <ItemRowLine key={i.id} item={i} settings={settings} audience="support" facts={<span>raised by {i.raisedBy.name}{i.crmRef ? ` · ${i.crmRef}` : ''}</span>} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
