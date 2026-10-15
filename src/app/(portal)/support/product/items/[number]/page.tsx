import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Crumbs, Empty, Field, Flash, MetaRows, Options } from '@/components/support/Parts'
import { Clock, ImpactStrip, ItemTag, Pid, PriorityTag, ProductNav, Thread, WithTag, PRODUCT } from '@/components/support/Product'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { dmyHm } from '@/lib/support/format'
import { autoCloseAt, cadenceReading, CASE_CHOICE_LABEL, casesOfItem, DECLINE_REASONS, declineLabel, eventsOfItem, getItem, KIND_HINT, KIND_LABEL, movesFor, PRIORITIES, priorityOf, productContext, SEVERITY_LABEL, teamOf, triageReading, verticalLabel } from '@/lib/support/product'
import { mirrorsOfItem } from '@/lib/support/product-mirror'
import { isLead, isPrincipal, requireAgent } from '@/lib/support/session'

import { acceptAction, answerAction, askAction, backAction, closeAction, commentAction, declineAction, fixedAction, priorityAction, releasedAction, reopenAction, rerouteAction, retryMirrorAction, toldAction, trackerAction, unlinkAction } from './actions'

export const metadata: Metadata = { title: 'Product item' }

type SP = { ok?: string; error?: string }

/* One item (10-product-desk.md §4.2): the head with the bridge state and the tracker, the clocks, the impact strip, the hand-off and
   its evidence, the cases behind it, the thread, and the action panel for whoever is signed in: principal support moves it, the desk
   answers, tells the customer, closes and reopens. */
export default async function ItemPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<SP> }) {
  const { number } = await params
  const sp = await searchParams
  const me = await requireAgent()
  const item = await getItem(number)
  if (!item) notFound()
  const [principal, lead, ctx, cases, events, mirrors] = await Promise.all([isPrincipal(me), isLead(me), productContext(), casesOfItem(item.id), eventsOfItem(item.id), mirrorsOfItem(item.id)])
  const { settings, hours, now } = ctx
  const side = principal ? 'principal' : 'support'
  const team = teamOf(settings, item.team)
  const pr = priorityOf(settings, item.priority)
  const triage = item.state === 'raised' ? triageReading(item, settings, hours, now) : null
  const cadence = item.state === 'tracked' || item.state === 'fixed' ? cadenceReading(item, settings, hours, now) : null
  const handoff = events.find((e) => e.kind === 'handoff')
  const evidence = events.flatMap((e) => e.evidence)
  const owed = mirrors.filter((m) => m.state === 'pending' || m.state === 'failed')
  const moves = movesFor(side, item.state)
  const can = (to: (typeof moves)[number]) => moves.includes(to)
  const here = `${PRODUCT}/items/${item.number}`
  const untold = cases.filter((c) => !c.toldAt)
  const hidden = (
    <>
      <input type="hidden" name="number" value={item.number} />
      <input type="hidden" name="return" value={here} />
    </>
  )

  return (
    <>
      <WorkspaceBar active="product" />
      <section className="sheet ws g-paper">
        <ProductNav active="items" lead={lead} />
        <Crumbs items={[{ label: 'Product desk', href: PRODUCT }, { label: 'Items', href: `${PRODUCT}/items` }, { label: item.number }]} />
        <div style={{ height: 20 }} />
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="case-head item-head">
          <div>
            <Pid number={item.number} display />
            <h1>{item.title}</h1>
            <div className="tags" style={{ marginTop: 14 }}>
              <ItemTag item={item} audience={side} triage={triage} />
              <PriorityTag priority={item.priority} />
              <span className="tag tag-quiet">{team.name}</span>
              <WithTag state={item.state} team={item.team} />
              {item.severityHint && <span className="tag tag-quiet">{SEVERITY_LABEL[item.severityHint]}</span>}
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: '8px 24px', alignItems: 'center' }}>
              {triage && <Clock r={triage} label={`Triage · ${pr.triageHours} h target`} />}
              {cadence && <Clock r={cadence} label={`Update every ${pr.updateEveryDays} working days`} />}
              {item.state === 'released' && item.releasedAt && (
                <span className="label muted">
                  Closes by itself on {dmyHm(autoCloseAt(item.releasedAt, settings).toISOString())} unless the desk closes it first
                </span>
              )}
            </div>
          </div>
          <MetaRows
            items={[
              { k: 'Product', v: item.productName, sans: true },
              { k: 'Family', v: item.productFamily, sans: true },
              { k: 'Version', v: item.affectedVersion },
              { k: 'Platform', v: item.platform, sans: true },
              { k: 'Issue', v: [item.issueCategory, item.subCategory].filter(Boolean).join(' › '), sans: true },
              { k: 'Vertical', v: verticalLabel(item.vertical), sans: true },
              { k: 'Raised', v: `${dmyHm(item.raisedAt)} · ${item.raisedBy.name}`, sans: true },
              { k: 'Triaged', v: item.triagedAt ? `${dmyHm(item.triagedAt)} · ${item.triagedBy.name}` : '', sans: true },
              { k: 'Support owner', v: item.supportOwner.name, sans: true },
              { k: 'Product owner', v: item.productOwner },
              { k: 'Tracker', v: item.tracker.key ? (item.tracker.url ? <a href={item.tracker.url} target="_blank" rel="noreferrer">{item.tracker.key}</a> : item.tracker.key) : '' },
              { k: 'CRM row', v: item.crmRfeId || item.crmDefectId ? (item.crmRfeId ? <Link href={`${WS}/rfe/${item.crmRfeId}`}>{item.crmRef || 'RFE row'}</Link> : item.crmRef || 'Defect row') : '' },
              { k: 'Fixed in', v: item.fixedVersion },
              { k: 'Released in', v: item.releasedVersion },
              { k: 'Declined', v: item.declineReason ? declineLabel(item.declineReason) : '', sans: true },
            ]}
          />
        </div>

        <ImpactStrip item={item} cases={cases} verticalLabel={verticalLabel} />

        <div className="ws-grid">
          <div>
            <h2 className="sub-head">
              Hand-off <span className="label">{KIND_LABEL[item.kind]}</span>
            </h2>
            <p className="hint" style={{ marginBottom: 12 }}>
              {KIND_HINT[item.kind]}
            </p>
            {handoff?.text || item.summary ? <div className="handoff">{handoff?.text || item.summary}</div> : <Empty label="Hand-off">The agent wrote nothing beyond the title.</Empty>}
            {item.customerImpact && (
              <p style={{ marginTop: 16, fontSize: 15 }}>
                <span className="label muted">Impact · </span>
                {item.customerImpact}
              </p>
            )}
            {evidence.length > 0 && (
              <div className="msg-att" style={{ marginTop: 16 }}>
                {evidence.map((a) => (
                  <a className="tag" href={a.url} key={a.id}>
                    {a.name}
                  </a>
                ))}
              </div>
            )}
            {item.releaseNote && (
              <div style={{ marginTop: 24 }}>
                <h3 className="block-title label">Release note{item.showReleaseToCustomer ? ' · shown to customers' : ''}</h3>
                <div className="handoff">{item.releaseNote}</div>
              </div>
            )}
            {item.declineNote && (
              <div style={{ marginTop: 24 }}>
                <h3 className="block-title label">Why it was declined</h3>
                <div className="handoff">{item.declineNote}</div>
              </div>
            )}

            <h2 className="sub-head" style={{ marginTop: 40 }}>
              Cases <span className="label">{cases.length}</span>
            </h2>
            {cases.length === 0 ? (
              <Empty label="Cases">No case is linked.</Empty>
            ) : (
              <div className="mini-rows cases-of-item">
                {cases.map((c) => (
                  <div className="mini-row has-act" key={c.id}>
                    <span className="t">
                      <Link href={`${WS}/cases/${c.caseId}`}>{c.ticket}</Link> {c.title}
                    </span>
                    <span className="s">
                      {c.accountName && <span>{c.accountName}</span>}
                      {c.supportOwner.name && <span>{c.supportOwner.name}</span>}
                      <span>{CASE_CHOICE_LABEL[c.caseChoice].split(':')[0]}</span>
                      <span>linked {dmyHm(c.linkedAt)}</span>
                      {c.toldAt && <span>customer told {dmyHm(c.toldAt)}</span>}
                    </span>
                    <span className="act" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {item.state === 'released' && !c.toldAt && (
                        <form action={toldAction}>
                          {hidden}
                          <input type="hidden" name="caseId" value={c.caseId} />
                          <input type="hidden" name="post" value="1" />
                          <button className="btn btn-line btn-sm" type="submit" title="Posts the release line as a reply on the case and marks the customer told">
                            Tell the customer
                          </button>
                        </form>
                      )}
                      {(principal || item.raisedBy.id === me.userId) && cases.length > 1 && (
                        <form action={unlinkAction}>
                          {hidden}
                          <input type="hidden" name="caseId" value={c.caseId} />
                          <button className="link-u textbtn" type="submit">
                            Unlink
                          </button>
                        </form>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <h2 className="sub-head" style={{ marginTop: 40 }}>
              Thread <span className="label">{events.length}</span>
            </h2>
            {events.length ? <Thread events={events} itemNumber={item.number} /> : <Empty label="Thread">Nothing yet.</Empty>}
          </div>

          <aside className="ws-side" aria-label="Actions">
            <div>
              <h2 className="sub-head">
                Actions <span className="label">{principal ? 'Principal support' : 'Support'}</span>
              </h2>
              <div className="acts">
                {can('tracked') && item.state === 'raised' && (
                  <details open>
                    <summary>Accept</summary>
                    <form action={acceptAction} className="act-body">
                      {hidden}
                      <p>Into the loop: pick the team and the priority; type the tracker key if engineering already has the issue.</p>
                      <Field id="a-team" label="Team" select>
                        <select id="a-team" name="team" defaultValue={item.team}>
                          {settings.teams.map((t) => (
                            <option value={t.key} key={t.key}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field id="a-priority" label="Priority" select hint={settings.priorities.map((p) => `${p.key}: ${p.label}`).join(' · ')}>
                        <select id="a-priority" name="priority" defaultValue={item.priority}>
                          <Options items={PRIORITIES.map((p) => ({ value: p, label: `${p} · ${priorityOf(settings, p).label}` }))} />
                        </select>
                      </Field>
                      <Field id="a-tracker" label="Tracker key" hint="BG-3301 or US-1234; leave empty to add it later.">
                        <input id="a-tracker" name="trackerKey" />
                      </Field>
                      <Field id="a-owner" label="Product owner (email)">
                        <input id="a-owner" name="productOwner" type="email" />
                      </Field>
                      <Field id="a-text" label="Note to the desk">
                        <textarea id="a-text" name="text" rows={2} />
                      </Field>
                      <button className="btn btn-primary btn-sm" type="submit">
                        Accept →
                      </button>
                    </form>
                  </details>
                )}

                {item.state === 'needs-info' && (
                  <details open>
                    <summary>Answer</summary>
                    <form action={answerAction} className="act-body">
                      {hidden}
                      <p>{events.find((e) => e.kind === 'ask')?.text ? `The question: “${events.find((e) => e.kind === 'ask')!.text}”` : 'Product asked the desk a question.'}</p>
                      <Field id="an-text" label="Answer" required>
                        <textarea id="an-text" name="text" rows={4} required />
                      </Field>
                      <button className="btn btn-primary btn-sm" type="submit">
                        Send answer →
                      </button>
                    </form>
                  </details>
                )}

                {can('needs-info') && principal && (
                  <details>
                    <summary>Ask the desk</summary>
                    <form action={askAction} className="act-body">
                      {hidden}
                      <p>The support owner gets a task on every linked case and a mail; the item waits on the desk.</p>
                      <Field id="q-text" label="Question" required>
                        <textarea id="q-text" name="text" rows={3} required />
                      </Field>
                      <button className="btn btn-line btn-sm" type="submit">
                        Ask
                      </button>
                    </form>
                  </details>
                )}

                <details>
                  <summary>Comment</summary>
                  <form action={commentAction} className="act-body">
                    {hidden}
                    <p>Seen by both desks, never by customers. Evidence up to 10 MB each; no samples.</p>
                    <Field id="c-text" label="Comment">
                      <textarea id="c-text" name="text" rows={3} />
                    </Field>
                    <Field id="c-ev" label="Evidence">
                      <input id="c-ev" name="evidence" type="file" multiple />
                    </Field>
                    <button className="btn btn-line btn-sm" type="submit">
                      Add comment
                    </button>
                  </form>
                </details>

                {principal && item.state !== 'closed' && (
                  <details>
                    <summary>Priority, team, tracker</summary>
                    <div className="act-body">
                      <form action={priorityAction} className="actions" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        {hidden}
                        <Field id="p-priority" label="Priority" select>
                          <select id="p-priority" name="priority" defaultValue={item.priority}>
                            <Options items={PRIORITIES.map((p) => ({ value: p, label: p }))} />
                          </select>
                        </Field>
                        <button className="btn btn-line btn-sm" type="submit">
                          Set
                        </button>
                      </form>
                      <form action={rerouteAction} className="actions" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        {hidden}
                        <Field id="r-team" label="Team" select>
                          <select id="r-team" name="team" defaultValue={item.team}>
                            {settings.teams.map((t) => (
                              <option value={t.key} key={t.key}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <button className="btn btn-line btn-sm" type="submit">
                          Re-route
                        </button>
                      </form>
                      <form action={trackerAction} className="actions" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        {hidden}
                        <Field id="t-key" label="Tracker key" hint="Empty clears it.">
                          <input id="t-key" name="trackerKey" defaultValue={item.tracker.key} />
                        </Field>
                        <button className="btn btn-line btn-sm" type="submit">
                          Save
                        </button>
                      </form>
                    </div>
                  </details>
                )}

                {can('fixed') && principal && (
                  <details>
                    <summary>Fixed</summary>
                    <form action={fixedAction} className="act-body">
                      {hidden}
                      <p>The fix exists and waits for a release. The desk is told; the customer is not, yet.</p>
                      <Field id="f-version" label="Fixed in (version or build)">
                        <input id="f-version" name="version" />
                      </Field>
                      <Field id="f-text" label="Note">
                        <textarea id="f-text" name="text" rows={2} />
                      </Field>
                      <button className="btn btn-line btn-sm" type="submit">
                        Mark fixed
                      </button>
                    </form>
                  </details>
                )}

                {can('released') && principal && (
                  <details>
                    <summary>Released</summary>
                    <form action={releasedAction} className="act-body">
                      {hidden}
                      <p>It shipped. Linked cases go back to In Progress-Support and the desk tells the customers.</p>
                      <Field id="rl-version" label={item.team === 'lab' ? 'VDB version' : 'Version'} required>
                        <input id="rl-version" name="version" required />
                      </Field>
                      <Field id="rl-text" label="Release line for support" hint="One sentence the agent can pass on.">
                        <textarea id="rl-text" name="text" rows={2} />
                      </Field>
                      <label className="check">
                        <input type="checkbox" name="show" value="1" />
                        <span>Show this line to customers on their case</span>
                      </label>
                      <button className="btn btn-primary btn-sm" type="submit">
                        Mark released →
                      </button>
                    </form>
                  </details>
                )}

                {item.state === 'fixed' && principal && (
                  <details>
                    <summary>Back in progress</summary>
                    <form action={backAction} className="act-body">
                      {hidden}
                      <Field id="b-text" label="Why">
                        <textarea id="b-text" name="text" rows={2} />
                      </Field>
                      <button className="btn btn-line btn-sm" type="submit">
                        Back to tracked
                      </button>
                    </form>
                  </details>
                )}

                {can('declined') && principal && (
                  <details>
                    <summary>Decline</summary>
                    <form action={declineAction} className="act-body">
                      {hidden}
                      <Field id="d-reason" label="Reason" select required>
                        <select id="d-reason" name="reason" defaultValue="" required>
                          <Options items={DECLINE_REASONS.map((d) => ({ value: d.key, label: d.label }))} empty="Choose" />
                        </select>
                      </Field>
                      <Field id="d-text" label="For the agent and the customer" required>
                        <textarea id="d-text" name="text" rows={3} required />
                      </Field>
                      <label className="check">
                        <input type="checkbox" name="sure" value="1" required />
                        <span>The desk decides the case with the customer from here</span>
                      </label>
                      <button className="btn btn-line btn-sm" type="submit">
                        Decline
                      </button>
                    </form>
                  </details>
                )}

                {can('closed') && (
                  <details open={item.state === 'released' && untold.length === 0}>
                    <summary>Close</summary>
                    <form action={closeAction} className="act-body">
                      {hidden}
                      <p>{item.state === 'released' ? (untold.length ? `${untold.length} of ${cases.length} customers have not been told yet.` : 'Every customer has been told.') : 'The desk has decided the cases.'}</p>
                      <Field id="cl-text" label="Note">
                        <input id="cl-text" name="text" />
                      </Field>
                      <button className="btn btn-line btn-sm" type="submit">
                        Close item
                      </button>
                    </form>
                  </details>
                )}

                {can('raised') && item.state !== 'needs-info' && (
                  <details>
                    <summary>Reopen</summary>
                    <form action={reopenAction} className="act-body">
                      {hidden}
                      <p>It goes back to principal support with the cases it had.</p>
                      <Field id="ro-text" label="Why it is back" required>
                        <textarea id="ro-text" name="text" rows={2} required />
                      </Field>
                      <button className="btn btn-line btn-sm" type="submit">
                        Reopen
                      </button>
                    </form>
                  </details>
                )}

                <details open={owed.length > 0}>
                  <summary>CRM mirror</summary>
                  <div className="act-body">
                    <p>
                      {mirrors.length === 0 ? 'Nothing written to Dynamics yet.' : `${mirrors.filter((m) => m.state === 'done').length} written, ${mirrors.filter((m) => m.state === 'skipped').length} skipped, ${owed.length} waiting.`}
                      {!settings.mirror.enabled && ' The mirror is off in settings: writes are queued, not sent.'}
                    </p>
                    {owed.length > 0 && (
                      <form action={retryMirrorAction}>
                        {hidden}
                        <button className="btn btn-line btn-sm" type="submit" disabled={!settings.mirror.enabled}>
                          Retry as me
                        </button>
                      </form>
                    )}
                    {mirrors.slice(0, 6).map((m) => (
                      <p key={m.id} className="hint">
                        {m.ticket} · {m.op} · {m.state}
                        {m.lastError ? ` · ${m.lastError}` : ''} · {dmyHm(m.createdAt)}
                      </p>
                    ))}
                  </div>
                </details>
              </div>
              <p className="hint" style={{ marginTop: 16 }}>
                {item.priority}: triage within {pr.triageHours} working hours, an update every {pr.updateEveryDays} working days. {item.triagedAt ? `Triaged ${dmyHm(item.triagedAt)}.` : 'Not triaged yet.'}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
