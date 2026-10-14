import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { CategoryPicker } from '@/components/support/CasePickers.client'
import { CareBand, CareTag, CauseTag, FollowUpTag, RateScale, ReasonSelect, ScoreTag } from '@/components/support/Csat'
import { Empty, Field, Flash, MetaRows, Options, Sla, StatusTag, Tid } from '@/components/support/Parts'
import { AgentTimeline } from '@/components/support/Timeline'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { isGuid } from '@/lib/dataverse/odata'
import { fv, lookup } from '@/lib/dataverse/types'
import { getCase } from '@/lib/support/cases'
import { careForCustomer, causeOf, csatForCase, followUpState, isUnhappy } from '@/lib/support/csat'
import { dmy, dmyHm } from '@/lib/support/format'
import { getSettings } from '@/lib/support/kpi-config'
import { ACTIVE_STATUS_REASONS, CASE_TYPE, CATEGORY, CONSIDERED_AS, CUSTOMER_TYPE, ORIGIN, PRIORITY, RFE_TYPE, STATE, STATUS, VERTICAL, label } from '@/lib/support/options'
import { getAgents, getCategories, getProducts, getPublicQueues, getSubcategories, getTeams } from '@/lib/support/reference'
import { defectsOfCase, rfesOfCase } from '@/lib/support/rfe'
import { requireAgent } from '@/lib/support/session'
import { getTimeline, type TimelineEntry } from '@/lib/support/timeline'

import { addNoteAction, assignAction, callAction, cancelAction, csatFollowUpAction, csatInviteAction, csatRecordAction, editAction, emailAction, queueAction, reopenAction, replyAction, resolveAction, rfeAction, statusAction, taskAction } from './actions'

export const metadata: Metadata = { title: 'Case' }

const OK: Record<string, string> = {
  created: 'Case created.',
  note: 'Note added.',
  reply: 'Reply sent to the customer.',
  status: 'Status reason updated.',
  assign: 'Case assigned.',
  resolve: 'Case resolved.',
  'resolve-survey': 'Case resolved and the satisfaction survey emailed to the customer.',
  'resolve-survey-logged': 'Case resolved. The survey was prepared but not emailed: no SMTP_URL is set in this environment.',
  cancel: 'Case cancelled.',
  reopen: 'Case reopened.',
  queue: 'Added to the queue.',
  call: 'Call logged.',
  task: 'Task created.',
  edit: 'Details saved.',
  rfe: 'RFE created and linked to this case.',
  email: 'Email sent to the customer.',
  'email-draft': 'Email saved on the case as a draft: this environment has no synced mailbox, so it was not sent.',
  'csat-sent': 'Survey emailed to the customer.',
  'csat-logged': 'Survey prepared but not emailed: no SMTP_URL is set in this environment. The customer can still rate the case on the portal.',
  'csat-recorded': 'Rating recorded on the case.',
  'csat-followup': 'Follow-up closed. Thank you for calling the customer back.',
}

type Tab = 'timeline' | 'details' | 'related'
type SP = { tab?: string; ok?: string; error?: string }

/* The case sheet: number and title, the facts on the right, the timeline in the middle, every action on the side. */
export default async function CasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params
  const sp = await searchParams
  if (!isGuid(id)) notFound()
  const me = await requireAgent()
  const c = await getCase(me.auth, id)
  if (!c) notFound()
  const settings = await getSettings()
  const customerLookup = lookup(c, 'customerid')
  const [timeline, rfes, defects, agents, teams, queues, products, categories, subcategories, rating, care] = await Promise.all([
    getTimeline(me.auth, id, 'agent').catch(() => []),
    rfesOfCase(me.auth, id).catch(() => []),
    defectsOfCase(me.auth, id).catch(() => []),
    getAgents(me.auth).catch(() => []),
    getTeams(me.auth).catch(() => []),
    getPublicQueues(me.auth).catch(() => []),
    getProducts(me.auth).catch(() => []),
    getCategories(me.auth).catch(() => []),
    getSubcategories(me.auth).catch(() => []),
    settings.csat.enabled ? csatForCase(id) : Promise.resolve(null),
    settings.csat.enabled && customerLookup ? careForCustomer(customerLookup.id, settings) : Promise.resolve(null),
  ])
  const tab: Tab = sp.tab === 'details' || sp.tab === 'related' ? sp.tab : 'timeline'
  // The customer's rating sits in the timeline where it happened, as the one entry that is neither email nor note.
  const entries: TimelineEntry[] =
    rating?.score && rating.respondedAt
      ? [...timeline, { id: `csat-${rating.id}`, kind: 'csat' as const, when: rating.respondedAt, subject: `Customer rated this case ${rating.score}/5`, html: '', text: rating.comment, preview: rating.comment ? rating.comment.slice(0, 160) : '', by: { id: rating.contactId, name: rating.customerName || 'Customer' }, attachments: [], customerVisible: true, fromCustomer: true, statusLabel: isUnhappy(rating.score, settings.csat) ? 'low' : 'ok' }].sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0))
      : timeline
  const fu = rating ? followUpState(rating, settings) : null
  const active = c.statecode === STATE.ACTIVE
  const here = `${WS}/cases/${id}`
  const customer = lookup(c, 'customerid')
  const customerHref = customer ? `${WS}/customers/${customer.logicalName === 'account' ? 'accounts' : 'contacts'}/${customer.id}` : undefined
  const primary = lookup(c, 'primarycontactid')
  const owner = lookup(c, 'ownerid')
  const num = (k: string): number | undefined => (typeof c[k] === 'number' ? (c[k] as number) : undefined)
  const txt = (k: string): string => (c[k] === null || c[k] === undefined ? '' : String(c[k]))
  const attachmentHref = (a: { id: string; kind: 'note' | 'email' }) => `${here}/attachment/${a.kind}/${a.id}`
  const families = new Map<string, typeof products>()
  for (const p of products) families.set(p.family, [...(families.get(p.family) ?? []), p])
  const tabHref = (t: Tab) => (t === 'timeline' ? here : `${here}?tab=${t}`)
  const fcr = num('k7_caseconsideredas')
  const critical = num('prioritycode') === 696720000

  return (
    <>
      <WorkspaceBar active="cases" />
      <section className="sheet ws g-paper">
        <nav aria-label="Breadcrumb">
          <ol className="crumbs label" style={{ marginBottom: 20 }}>
            <li>
              <Link href={`${WS}/cases`}>Cases</Link>
            </li>
            <li>
              <span aria-current="page">{c.ticketnumber}</span>
            </li>
          </ol>
        </nav>
        {sp.ok && OK[sp.ok] && <Flash>{OK[sp.ok]}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="case-head">
          <div>
            <Tid ticket={c.ticketnumber} display />
            <h1>{c.title}</h1>
            <div className="tags">
              <StatusTag row={c} solid />
              {num('caseorigincode') !== undefined && <span className="tag">{fv(c, 'caseorigincode')}</span>}
              {num('prioritycode') !== undefined && <span className={`tag${critical ? ' tag-signal' : ''}`}>{critical ? 'Critical' : fv(c, 'prioritycode')} priority</span>}
              {num('casetypecode') !== undefined && <span className="tag tag-quiet">{fv(c, 'casetypecode')}</span>}
              {fcr !== undefined && <span className="tag tag-quiet">{label(CONSIDERED_AS, fcr)}</span>}
              {num('new_verticaltype') !== undefined && <span className="tag tag-quiet">{fv(c, 'new_verticaltype')}</span>}
              {rating?.score ? <ScoreTag score={rating.score} settings={settings.csat} prefix="CSAT" word={false} /> : null}
            </div>
          </div>
          <MetaRows
            items={[
              {
                k: 'Customer',
                v: customer ? (
                  <>
                    <Link href={customerHref!}>{customer.name || 'Unnamed'}</Link>
                    {care && care.level !== 'none' ? (
                      <>
                        {' '}
                        <CareTag care={care} href={`${customerHref}#csat`} />
                      </>
                    ) : null}
                  </>
                ) : (
                  ''
                ),
                sans: true,
              },
              { k: 'Contact', v: primary && primary.id !== customer?.id ? <Link href={`${WS}/customers/contacts/${primary.id}`}>{primary.name}</Link> : '', sans: true },
              { k: 'Email', v: txt('k7_customeremail') },
              { k: 'Owner', v: owner?.name ?? '', sans: true },
              { k: 'Created', v: dmyHm(c.createdon) },
              { k: 'Modified', v: dmyHm(c.modifiedon) },
              { k: 'Response SLA', v: num('firstresponseslastatus') ? <Sla value={num('firstresponseslastatus')} label="" /> : '' },
              { k: 'Resolve SLA', v: num('resolvebyslastatus') ? <Sla value={num('resolvebyslastatus')} label="" /> : '' },
            ]}
          />
        </div>

        {care && <CareBand care={care} href={customerHref ? `${customerHref}#csat` : undefined} />}

        <div className="ws-grid">
          <div>
            <nav className="rtabs" aria-label="Case sections" style={{ marginBottom: 24 }}>
              {(
                [
                  ['timeline', `Timeline · ${entries.length}`],
                  ['details', 'Details'],
                  ['related', `Related · ${rfes.length + defects.length}`],
                ] as [Tab, string][]
              ).map(([t, l]) => (
                <Link className="rtab label on-panel" href={tabHref(t)} key={t} {...(t === tab ? { 'aria-current': 'page' as const } : {})}>
                  <span className="pixel" aria-hidden="true" />
                  {l}
                </Link>
              ))}
            </nav>

            {tab === 'timeline' &&
              (entries.length === 0 ? (
                <Empty label="Timeline">Nothing on this case yet. Add a note, log a call or reply to the customer from the panel.</Empty>
              ) : (
                <AgentTimeline entries={entries} attachmentHref={attachmentHref} />
              ))}

            {tab === 'details' && (
              <>
                {txt('description') ? (
                  <div style={{ marginBottom: 32 }}>
                    <h2 className="block-title label">Description</h2>
                    <div className="desc-block">{txt('description')}</div>
                  </div>
                ) : null}
                <div className="detail-cols">
                  <MetaRows
                    items={[
                      { k: 'Product', v: fv(c, '_productid_value'), sans: true },
                      { k: 'Product category', v: fv(c, 'cit_productcategory'), sans: true },
                      { k: 'Issue', v: fv(c, '_new_issue_value'), sans: true },
                      { k: 'Sub category', v: fv(c, '_new_subcategory_value'), sans: true },
                      { k: 'Category', v: fv(c, 'new_category'), sans: true },
                      { k: 'Vertical', v: fv(c, 'new_verticaltype'), sans: true },
                      { k: 'Customer type', v: fv(c, 'new_customertype'), sans: true },
                      { k: 'Considered as', v: fcr !== undefined ? label(CONSIDERED_AS, fcr) : '', sans: true },
                    ]}
                  />
                  <MetaRows
                    items={[
                      { k: 'Version', v: txt('k7_productversion') },
                      { k: 'Serial', v: txt('k7_2ndserialnumber') },
                      { k: 'Module', v: txt('k7_module'), sans: true },
                      { k: 'Sub module', v: txt('k7_submodule'), sans: true },
                      { k: 'Created by', v: fv(c, '_createdby_value'), sans: true },
                      { k: 'Modified by', v: fv(c, '_modifiedby_value'), sans: true },
                      { k: 'Portal user', v: txt('adx_createdbyusername') },
                      { k: 'Escalated', v: txt('escalatedon') ? dmy(txt('escalatedon')) : '' },
                      { k: 'Follow up', v: txt('followupby') ? dmy(txt('followupby')) : '' },
                    ]}
                  />
                </div>
                {txt('adx_stepstoreproduce') ? (
                  <div style={{ marginTop: 32 }}>
                    <h2 className="block-title label">Steps to reproduce</h2>
                    <div className="desc-block">{txt('adx_stepstoreproduce')}</div>
                  </div>
                ) : null}
                {txt('adx_resolution') ? (
                  <div style={{ marginTop: 32 }}>
                    <h2 className="block-title label">Resolution</h2>
                    <div className="desc-block">{txt('adx_resolution')}</div>
                  </div>
                ) : null}

                <details className="edit-block" style={{ marginTop: 40 }}>
                  <summary className="btn btn-line btn-sm">Edit details</summary>
                  <form action={editAction} className="form-grid" style={{ marginTop: 24 }}>
                    <input type="hidden" name="id" value={id} />
                    <Field id="e-title" label="Title" required span>
                      <input id="e-title" name="title" defaultValue={c.title} required maxLength={200} />
                    </Field>
                    <Field id="e-description" label="Description" span>
                      <textarea id="e-description" name="description" defaultValue={txt('description')} rows={5} />
                    </Field>
                    <Field id="e-product" label="Product" select>
                      <select id="e-product" name="productId" defaultValue={txt('_productid_value')}>
                        <option value="">No product</option>
                        {[...families.entries()].map(([fam, list]) => (
                          <optgroup label={fam} key={fam}>
                            {list.map((p) => (
                              <option value={p.id} key={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </Field>
                    <Field id="e-priority" label="Priority" select>
                      <select id="e-priority" name="priority" defaultValue={txt('prioritycode')}>
                        <Options items={PRIORITY} empty="Not set" />
                      </select>
                    </Field>
                    <CategoryPicker mode="select" categories={categories} subcategories={subcategories} initialCategory={txt('_new_issue_value')} initialSubcategory={txt('_new_subcategory_value')} subLabel="Sub category" />
                    <Field id="e-vertical" label="Vertical" select>
                      <select id="e-vertical" name="vertical" defaultValue={txt('new_verticaltype')}>
                        <Options items={VERTICAL} empty="Not set" />
                      </select>
                    </Field>
                    <Field id="e-ctype" label="Customer type" select>
                      <select id="e-ctype" name="customerType" defaultValue={txt('new_customertype')}>
                        <Options items={CUSTOMER_TYPE} empty="Not set" />
                      </select>
                    </Field>
                    <Field id="e-casetype" label="Case type" select>
                      <select id="e-casetype" name="caseType" defaultValue={txt('casetypecode')}>
                        <Options items={CASE_TYPE} empty="Not set" />
                      </select>
                    </Field>
                    <Field id="e-fcr" label="Considered as" select>
                      <select id="e-fcr" name="consideredAs" defaultValue={txt('k7_caseconsideredas')}>
                        <Options items={CONSIDERED_AS} empty="Not set" />
                      </select>
                    </Field>
                    <Field id="e-cat" label="Category" select>
                      <select id="e-cat" name="category" defaultValue={txt('new_category')}>
                        <Options items={CATEGORY} empty="Not set" />
                      </select>
                    </Field>
                    <Field id="e-version" label="Product version">
                      <input id="e-version" name="productVersion" defaultValue={txt('k7_productversion')} />
                    </Field>
                    <Field id="e-serial" label="Serial number">
                      <input id="e-serial" name="serial" defaultValue={txt('k7_2ndserialnumber')} />
                    </Field>
                    <Field id="e-module" label="Module">
                      <input id="e-module" name="module" defaultValue={txt('k7_module')} />
                    </Field>
                    <Field id="e-submodule" label="Sub module">
                      <input id="e-submodule" name="submodule" defaultValue={txt('k7_submodule')} />
                    </Field>
                    <Field id="e-email" label="Customer email">
                      <input id="e-email" name="customerEmail" type="email" defaultValue={txt('k7_customeremail')} />
                    </Field>
                    <Field id="e-steps" label="Steps to reproduce" span>
                      <textarea id="e-steps" name="stepsToReproduce" defaultValue={txt('adx_stepstoreproduce')} rows={3} />
                    </Field>
                    <div className="form-actions span-2">
                      <button className="btn btn-primary btn-sm" type="submit">
                        Save changes →
                      </button>
                      <span className="hint">Only the fields you change are sent to Dynamics.</span>
                    </div>
                  </form>
                </details>
              </>
            )}

            {tab === 'related' && (
              <div className="two-col">
                <div>
                  <h2 className="sub-head">
                    RFEs <span className="label">{rfes.length}</span>
                  </h2>
                  {rfes.length === 0 ? (
                    <Empty label="RFEs">No request for enhancement is linked to this case.</Empty>
                  ) : (
                    <div className="mini-rows">
                      {rfes.map((r) => (
                        <Link className="mini-row" href={`${WS}/rfe/${r.k7_rfeid}`} key={r.k7_rfeid}>
                          <span className="t">{r.k7_rfetitle}</span>
                          <span className="s">
                            {[String(r.k7_rfeno ?? ''), fv(r, 'k7_rfetype'), fv(r, 'k7_rfestatus'), r.k7_yodizid ? `Yodiz ${String(r.k7_yodizid)}` : ''].filter(Boolean).join(' · ')}
                          </span>
                          <span className="r">{dmy(typeof r.createdon === 'string' ? r.createdon : null)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                  <details className="edit-block" style={{ marginTop: 24 }}>
                    <summary className="btn btn-line btn-sm">Convert to RFE</summary>
                    <form action={rfeAction} className="form-grid" style={{ marginTop: 20 }}>
                      <input type="hidden" name="id" value={id} />
                      <Field id="r-title" label="RFE title" required span>
                        <input id="r-title" name="title" defaultValue={c.title} required maxLength={200} />
                      </Field>
                      <Field id="r-type" label="Type" required select>
                        <select id="r-type" name="type" defaultValue="100000000" required>
                          <Options items={RFE_TYPE} />
                        </select>
                      </Field>
                      <Field id="r-yodiz" label="Yodiz id">
                        <input id="r-yodiz" name="yodizId" />
                      </Field>
                      <Field id="r-users" label="Number of users">
                        <input id="r-users" name="users" inputMode="numeric" />
                      </Field>
                      <div className="form-actions span-2">
                        <button className="btn btn-primary btn-sm" type="submit">
                          Create RFE →
                        </button>
                        <span className="hint">Product, serial, customer and vertical are copied from the case.</span>
                      </div>
                    </form>
                  </details>
                </div>
                <div>
                  <h2 className="sub-head">
                    Defects <span className="label">{defects.length}</span>
                  </h2>
                  {defects.length === 0 ? (
                    <Empty label="Defects">No defect is linked to this case. Defects are raised from the Customer Service Hub.</Empty>
                  ) : (
                    <div className="mini-rows">
                      {defects.map((d) => (
                        <div className="mini-row" key={d.k7_defectid}>
                          <span className="t">{d.k7_defecttitle}</span>
                          <span className="s">{[String(d.k7_defectno ?? ''), fv(d, 'k7_defectstatus'), fv(d, 'k7_priority'), d.k7_yodizid ? `Yodiz ${String(d.k7_yodizid)}` : ''].filter(Boolean).join(' · ')}</span>
                          <span className="r">{dmy(typeof d.createdon === 'string' ? d.createdon : null)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="ws-side" aria-label="Actions">
            <div>
              <h2 className="sub-head">
                Actions <span className="label">{active ? 'Active case' : fv(c, 'statecode')}</span>
              </h2>
              <div className="acts">
                <details open={Boolean(sp.ok === 'note' || sp.error?.includes('note'))}>
                  <summary>Add note</summary>
                  <form action={addNoteAction} className="act-body">
                    <input type="hidden" name="id" value={id} />
                    <p>Internal unless you tick the box. Attachments up to 5 MB.</p>
                    <Field id="n-subject" label="Subject">
                      <input id="n-subject" name="subject" maxLength={200} />
                    </Field>
                    <Field id="n-text" label="Note">
                      <textarea id="n-text" name="text" rows={4} />
                    </Field>
                    <Field id="n-file" label="Attachment">
                      <input id="n-file" name="file" type="file" />
                    </Field>
                    <label className="check">
                      <input type="checkbox" name="visible" value="1" />
                      <span>Visible to the customer on the portal</span>
                    </label>
                    <button className="btn btn-primary btn-sm" type="submit">
                      Add note →
                    </button>
                  </form>
                </details>

                <details>
                  <summary>Reply to customer</summary>
                  <form action={replyAction} className="act-body">
                    <input type="hidden" name="id" value={id} />
                    <p>The customer sees this reply on the portal{txt('k7_customeremail') ? ` and is notified at ${txt('k7_customeremail')}` : ''}.</p>
                    <Field id="rp-text" label="Reply" required>
                      <textarea id="rp-text" name="text" rows={5} required />
                    </Field>
                    <label className="check">
                      <input type="checkbox" name="wait" value="1" defaultChecked />
                      <span>Wait for the customer (status In Progress-Customer)</span>
                    </label>
                    <button className="btn btn-line btn-sm" type="submit">
                      Send reply →
                    </button>
                  </form>
                </details>

                <details>
                  <summary>Email the customer</summary>
                  <form action={emailAction} className="act-body">
                    <input type="hidden" name="id" value={id} />
                    <p>An outgoing email on the case, from you. It shows in the timeline and on the portal.</p>
                    <Field id="em-to" label="To" required>
                      <input id="em-to" name="to" type="email" required defaultValue={txt('k7_customeremail')} />
                    </Field>
                    <Field id="em-subject" label="Subject" required>
                      <input id="em-subject" name="subject" required defaultValue={`Re: ${txt('title')} | ${txt('ticketnumber')}`} />
                    </Field>
                    <Field id="em-text" label="Message" required>
                      <textarea id="em-text" name="text" rows={6} required />
                    </Field>
                    <button className="btn btn-line btn-sm" type="submit">
                      Send email →
                    </button>
                  </form>
                </details>

                {active && (
                  <details>
                    <summary>Status reason</summary>
                    <form action={statusAction} className="act-body">
                      <input type="hidden" name="id" value={id} />
                      <Field id="st-code" label="Status reason" select>
                        <select id="st-code" name="statuscode" defaultValue={txt('statuscode')}>
                          <Options items={ACTIVE_STATUS_REASONS} />
                        </select>
                      </Field>
                      <button className="btn btn-line btn-sm" type="submit">
                        Update status
                      </button>
                    </form>
                  </details>
                )}

                <details>
                  <summary>Assign</summary>
                  <form action={assignAction} className="act-body">
                    <input type="hidden" name="id" value={id} />
                    <p>Now with {owner?.name ?? 'nobody'}.</p>
                    <Field id="as-owner" label="Agent or team" select>
                      <select id="as-owner" name="owner" defaultValue={owner ? `${owner.logicalName === 'team' ? 'team' : 'user'}:${owner.id}` : ''}>
                        <option value="">Choose</option>
                        <optgroup label="Agents">
                          {agents.map((a) => (
                            <option value={`user:${a.id}`} key={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </optgroup>
                        {teams.length > 0 && (
                          <optgroup label="Teams">
                            {teams.map((t) => (
                              <option value={`team:${t.id}`} key={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </Field>
                    <div className="actions">
                      <button className="btn btn-line btn-sm" type="submit">
                        Assign
                      </button>
                      {owner?.id !== me.userId && (
                        <button className="link-u textbtn" type="submit" name="me" value="1">
                          Assign to me
                        </button>
                      )}
                    </div>
                  </form>
                </details>

                {active && (
                  <details>
                    <summary>Resolve</summary>
                    <form action={resolveAction} className="act-body">
                      <input type="hidden" name="id" value={id} />
                      <div className="seg-choice" role="radiogroup" aria-label="Closed as">
                        <label>
                          <input type="radio" name="status" value={STATUS.CLOSED_CALL} defaultChecked />
                          Closed-Call
                        </label>
                        <label>
                          <input type="radio" name="status" value={STATUS.CLOSED_REMOTE} />
                          Closed-Remote
                        </label>
                      </div>
                      <Field id="rs-subject" label="Resolution" required>
                        <input id="rs-subject" name="subject" required maxLength={200} placeholder="What fixed it, in a line" />
                      </Field>
                      <Field id="rs-remarks" label="Remarks">
                        <textarea id="rs-remarks" name="remarks" rows={3} />
                      </Field>
                      <Field id="rs-minutes" label="Time spent (minutes)">
                        <input id="rs-minutes" name="minutes" inputMode="numeric" />
                      </Field>
                      <button className="btn btn-line btn-sm" type="submit">
                        Resolve case
                      </button>
                    </form>
                  </details>
                )}

                {active && (
                  <details>
                    <summary>Add to queue</summary>
                    <form action={queueAction} className="act-body">
                      <input type="hidden" name="id" value={id} />
                      <Field id="q-id" label="Queue" select>
                        <select id="q-id" name="queueId" defaultValue="">
                          <option value="">Choose a queue</option>
                          {queues.map((q) => (
                            <option value={q.id} key={q.id}>
                              {q.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <button className="btn btn-line btn-sm" type="submit">
                        Add to queue
                      </button>
                    </form>
                  </details>
                )}

                {settings.csat.enabled && (
                  <details open={Boolean(sp.ok?.startsWith('csat') || (rating?.followUp === 'pending' || rating?.followUp === 'in-progress'))}>
                    <summary>Customer satisfaction</summary>
                    <div className="act-body">
                      {rating?.score ? (
                        <>
                          <p>
                            <ScoreTag score={rating.score} settings={settings.csat} /> on {dmyHm(rating.respondedAt)} · {rating.source === 'agent' ? 'recorded by an agent' : rating.source === 'email' ? 'from the emailed survey' : 'on the portal'}
                          </p>
                          {rating.comment && <p style={{ color: 'var(--fg)', fontSize: 15 }}>&ldquo;{rating.comment}&rdquo;</p>}
                          {isUnhappy(rating.score, settings.csat) && (
                            <p>
                              About <CauseTag cause={causeOf(rating)} />
                            </p>
                          )}
                          {rating.followUp !== 'none' && fu && (
                            <p>
                              Follow-up <FollowUpTag status={rating.followUp} reading={fu} />
                              {rating.followUpOwnerName ? ` · ${rating.followUpOwnerName}` : ''}
                              {rating.followUp === 'done' && rating.followUpNote ? ` · ${rating.followUpNote}` : ''}
                            </p>
                          )}
                          {(rating.followUp === 'pending' || rating.followUp === 'in-progress') && (
                            <form action={csatFollowUpAction} className="act-body" style={{ padding: 0 }}>
                              <input type="hidden" name="id" value={id} />
                              <Field id="fu-reason" label="What it was about" required select hint="The reason the call found; the report groups low scores by it.">
                                <ReasonSelect id="fu-reason" value={rating.reason || rating.customerReason} required />
                              </Field>
                              <Field id="fu-note" label="What you agreed with the customer" required>
                                <textarea id="fu-note" name="note" rows={3} required />
                              </Field>
                              <label className="check">
                                <input type="checkbox" name="caseNote" value="1" defaultChecked />
                                <span>Also leave an internal note on the case</span>
                              </label>
                              <button className="btn btn-primary btn-sm" type="submit">
                                Customer contacted →
                              </button>
                            </form>
                          )}
                        </>
                      ) : (
                        <>
                          {rating?.invitedAt ? (
                            <p>
                              Survey emailed {dmyHm(rating.invitedAt)}
                              {rating.remindedAt ? `, reminded ${dmyHm(rating.remindedAt)}` : ''}; no answer yet.
                            </p>
                          ) : active ? (
                            <p>{settings.csat.inviteOnResolve ? 'The survey goes to the customer when the case is resolved.' : 'No survey has been sent for this case.'}</p>
                          ) : (
                            <p>No survey has been sent for this case.</p>
                          )}
                          {!active && (
                            <form action={csatInviteAction}>
                              <input type="hidden" name="id" value={id} />
                              <button className="btn btn-line btn-sm" type="submit" disabled={!txt('k7_customeremail')} title={txt('k7_customeremail') ? `To ${txt('k7_customeremail')}` : 'The case has no customer email'}>
                                {rating?.invitedAt ? 'Send the survey again' : 'Email the survey'}
                              </button>
                            </form>
                          )}
                          <details className="edit-block">
                            <summary className="link-u textbtn" style={{ cursor: 'pointer' }}>
                              Record a rating given on the phone
                            </summary>
                            <form action={csatRecordAction} className="act-body" style={{ paddingTop: 12 }}>
                              <input type="hidden" name="id" value={id} />
                              <RateScale compact selected={null} />
                              <Field id="cs-reason" label="If unhappy, what about" select>
                                <ReasonSelect id="cs-reason" />
                              </Field>
                              <Field id="cs-comment" label="What the customer said">
                                <textarea id="cs-comment" name="comment" rows={2} />
                              </Field>
                              <button className="btn btn-line btn-sm" type="submit">
                                Record rating
                              </button>
                            </form>
                          </details>
                        </>
                      )}
                    </div>
                  </details>
                )}

                <details>
                  <summary>Log a call</summary>
                  <form action={callAction} className="act-body">
                    <input type="hidden" name="id" value={id} />
                    <Field id="c-subject" label="Subject" required>
                      <input id="c-subject" name="subject" required maxLength={200} />
                    </Field>
                    <Field id="c-desc" label="Notes">
                      <textarea id="c-desc" name="description" rows={3} />
                    </Field>
                    <div className="seg-choice" role="radiogroup" aria-label="Direction">
                      <label>
                        <input type="radio" name="direction" value="out" defaultChecked />
                        Outgoing
                      </label>
                      <label>
                        <input type="radio" name="direction" value="in" />
                        Incoming
                      </label>
                    </div>
                    <Field id="c-minutes" label="Duration (minutes)">
                      <input id="c-minutes" name="minutes" inputMode="numeric" />
                    </Field>
                    <button className="btn btn-line btn-sm" type="submit">
                      Log call
                    </button>
                  </form>
                </details>

                <details>
                  <summary>Task</summary>
                  <form action={taskAction} className="act-body">
                    <input type="hidden" name="id" value={id} />
                    <Field id="t-subject" label="Subject" required>
                      <input id="t-subject" name="subject" required maxLength={200} />
                    </Field>
                    <Field id="t-desc" label="Details">
                      <textarea id="t-desc" name="description" rows={2} />
                    </Field>
                    <Field id="t-due" label="Due">
                      <input id="t-due" name="due" type="datetime-local" />
                    </Field>
                    <button className="btn btn-line btn-sm" type="submit">
                      Create task
                    </button>
                  </form>
                </details>

                {active ? (
                  <details>
                    <summary>Cancel case</summary>
                    <form action={cancelAction} className="act-body">
                      <input type="hidden" name="id" value={id} />
                      <p>Cancelling is for duplicates and mistakes. Resolve a case that was actually handled.</p>
                      <label className="check">
                        <input type="checkbox" name="confirm" value="1" />
                        <span>Yes, cancel {c.ticketnumber}</span>
                      </label>
                      <button className="btn btn-line btn-sm" type="submit">
                        Cancel case
                      </button>
                    </form>
                  </details>
                ) : (
                  <details open>
                    <summary>Reopen</summary>
                    <form action={reopenAction} className="act-body">
                      <input type="hidden" name="id" value={id} />
                      <p>
                        This case is {fv(c, 'statuscode') || fv(c, 'statecode')}. Reopening sets it back to Open with the same owner.
                      </p>
                      <button className="btn btn-line btn-sm" type="submit">
                        Reopen case
                      </button>
                    </form>
                  </details>
                )}
              </div>
            </div>
            {num('caseorigincode') !== undefined && (
              <p className="hint">
                Origin {label(ORIGIN, num('caseorigincode'))} · {fv(c, '_createdby_value') ? `created by ${fv(c, '_createdby_value')}` : ''}
              </p>
            )}
          </aside>
        </div>
      </section>
    </>
  )
}
