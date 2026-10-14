import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { RateScale, ScoreTag } from '@/components/support/Csat'
import { Field, Flash, MetaRows, StateTag, Tid, Track } from '@/components/support/Parts'
import { Conversation } from '@/components/support/Timeline'
import { fv } from '@/lib/dataverse/types'
import { getCustomerCase } from '@/lib/support/cases'
import { csatForCase } from '@/lib/support/csat'
import { dmy, dmyHm, htmlToText } from '@/lib/support/format'
import { getSettings } from '@/lib/support/kpi-config'
import { STATE } from '@/lib/support/options'
import { requireCustomer } from '@/lib/support/session'
import { canReopen, customerState } from '@/lib/support/status'
import { getTimeline, type TimelineEntry } from '@/lib/support/timeline'

import { rateCase, replyToCase, reopenCase } from './actions'

export async function generateMetadata({ params }: { params: Promise<{ ticket: string }> }): Promise<Metadata> {
  const { ticket } = await params
  return { title: `Case ${decodeURIComponent(ticket).toUpperCase()}` }
}

const ERRORS: Record<string, string> = {
  empty: 'Write a reply or attach a file before sending.',
  closed: 'This case was cancelled, so it cannot take replies. Open a new case instead.',
  'file-size': 'The file is larger than 5 MB. Try a smaller screenshot or zip the log.',
  'file-type': 'We accept images, PDF, text and log files, and zip archives.',
  'reopen-window': 'This case closed more than 14 days ago. Open a new case and mention its number.',
  failed: 'We could not save that.',
  score: 'Pick a number from 1 to 5 first.',
  'not-closed': 'You can rate a case once it is closed.',
}

type SP = { created?: string; attach?: string; replied?: string; reopened?: string; rated?: string; error?: string; message?: string }

/* One case, as the customer sees it: where it stands, the conversation in order, and one place to reply. */
export default async function CustomerCasePage({ params, searchParams }: { params: Promise<{ ticket: string }>; searchParams: Promise<SP> }) {
  const [{ ticket: raw }, sp] = await Promise.all([params, searchParams])
  const ticket = decodeURIComponent(raw).toUpperCase()
  const ctx = await requireCustomer(`/support/cases/${encodeURIComponent(ticket)}`)
  const c = await getCustomerCase(ctx.auth, ctx.scope, ticket)
  if (!c) notFound()
  const [timeline, settings, rating] = await Promise.all([getTimeline(ctx.auth, c.incidentid, 'customer'), getSettings(), csatForCase(c.incidentid)])
  const canRate = settings.csat.enabled && c.statecode === STATE.RESOLVED
  const ratedLow = sp.rated === '1' && rating?.score !== null && rating?.score !== undefined && rating.score <= settings.csat.unhappyAtOrBelow

  const opening: TimelineEntry = {
    id: 'opening',
    kind: 'note',
    when: c.createdon,
    subject: '',
    html: '',
    text: htmlToText(typeof c.description === 'string' ? c.description : '') || 'Opened the case.',
    preview: '',
    by: { id: '', name: 'You' },
    attachments: [],
    customerVisible: true,
    fromCustomer: true,
  }
  const entries = [opening, ...timeline.slice().reverse()]
  const state = customerState(c.statuscode, c.statecode)
  const closed = c.statecode === STATE.RESOLVED || c.statecode === STATE.CANCELED
  const reopenable = canReopen(c.statecode, c.modifiedon)
  const cancelled = c.statecode === STATE.CANCELED
  const attachmentHref = (a: { id: string; kind: 'note' | 'email' }) => `/support/cases/${encodeURIComponent(ticket)}/attachment/${a.kind}/${a.id}`
  const error = sp.error ? `${ERRORS[sp.error] ?? 'Try again.'}${sp.error === 'failed' && sp.message ? ` ${sp.message}` : ''}` : null

  return (
    <>
      <section className="sheet ws g-panel">
        <span className="label muted">
          <Link href="/support/cases" style={{ textDecoration: 'none' }}>
            My cases
          </Link>{' '}
          / {ticket}
        </span>
        <div className="case-head" style={{ marginTop: 12 }}>
          <div>
            <Tid ticket={c.ticketnumber} display />
            <h1>{c.title || 'Untitled case'}</h1>
            <div className="tags">
              <StateTag state={state} />
              {fv(c, '_productid_value') && <span className="tag">{fv(c, '_productid_value')}</span>}
            </div>
          </div>
          <MetaRows
            items={[
              { k: 'Opened', v: dmy(c.createdon) },
              { k: 'Last update', v: dmyHm(c.modifiedon) },
              { k: 'Topic', v: fv(c, '_new_issue_value') ? `${fv(c, '_new_issue_value')}${fv(c, '_new_subcategory_value') ? ` · ${fv(c, '_new_subcategory_value')}` : ''}` : '', sans: true },
              { k: 'Case number', v: c.ticketnumber },
            ]}
          />
        </div>
        {sp.created === '1' && (
          <Flash>
            We have your case. Its number is <strong>{c.ticketnumber}</strong>; we have emailed it to you too.
            {sp.attach === 'failed' ? ' The attachment did not go through: add it again below.' : ''}
          </Flash>
        )}
        {sp.replied === '1' && <Flash>Your reply is with the engineer.</Flash>}
        {sp.reopened === '1' && <Flash>The case is open again. An engineer will pick it up.</Flash>}
        {sp.rated === '1' && <Flash>{ratedLow ? 'Thank you for telling us. We are sorry we let you down; a support manager will be in touch.' : 'Thank you for your rating.'}</Flash>}
        {error && <Flash kind="error">{error}</Flash>}
        <Track statuscode={c.statuscode} statecode={c.statecode} />
      </section>

      <section className="sheet ws g-paper" id="conversation" aria-labelledby="conv-h">
        <h2 id="conv-h" className="sub-head">
          Conversation
          <span className="label">{entries.length === 1 ? '1 entry' : `${entries.length} entries`}</span>
        </h2>
        <Conversation entries={entries} attachmentHref={attachmentHref} />

        {canRate && (
          <div id="rate" className="rate-block" style={{ marginTop: 'clamp(32px, 4cqw, 48px)' }}>
            <h2 className="sub-head">How did we do?</h2>
            {rating?.score ? (
              <p className="rated">
                You rated this case <ScoreTag score={rating.score} settings={settings.csat} /> <span className="label muted">on {dmy(rating.respondedAt)}</span>. Changed your mind? Pick again below.
              </p>
            ) : (
              <p className="form-intro">One tap tells the engineer and their manager whether the fix worked for you. A low rating brings a manager back to you.</p>
            )}
            <form action={rateCase} className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <input type="hidden" name="ticket" value={c.ticketnumber} />
              <RateScale selected={rating?.score ?? null} />
              <div className="rate-comment">
                <Field id="rate-comment" label="Anything you want to tell us?" hint="Optional. Read by the engineer's manager.">
                  <textarea id="rate-comment" name="comment" rows={2} maxLength={2000} defaultValue={rating?.source === 'agent' ? '' : (rating?.comment ?? '')} />
                </Field>
              </div>
              <div className="form-actions">
                <button className="btn btn-line" type="submit">
                  {rating?.score ? 'Update my rating' : 'Send my rating →'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div id="reply" style={{ marginTop: canRate ? 0 : 'clamp(32px, 4cqw, 48px)' }}>
          {cancelled ? (
            <div className="notice">
              <p>This case was cancelled, so it no longer takes replies. If the problem is back, open a new case and mention {c.ticketnumber}.</p>
            </div>
          ) : (
            <>
              <h2 className="sub-head">{closed ? 'Not fixed after all?' : 'Reply'}</h2>
              {closed && !reopenable && (
                <p className="form-intro">This case closed more than 14 days ago. Open a new case and mention {c.ticketnumber} so the engineer has the history.</p>
              )}
              {closed && reopenable && <p className="form-intro">Replying reopens the case and sends it back to the engineer who handled it.</p>}
              {(!closed || reopenable) && (
                <form action={replyToCase} className="form-grid">
                  <input type="hidden" name="ticket" value={c.ticketnumber} />
                  <Field id="text" label={closed ? 'What is still wrong?' : 'Your reply'} span hint={state === 'waiting' ? 'The engineer asked you something: answer it here and the case goes back to them.' : undefined}>
                    <textarea id="text" name="text" rows={5} maxLength={8000} placeholder={closed ? 'The same error came back this morning…' : 'Write your reply…'} />
                  </Field>
                  <Field id="file" label="Attach a screenshot or log" hint="Optional. Up to 5 MB." span>
                    <input id="file" name="file" type="file" accept="image/*,.pdf,.txt,.log,.csv,.zip" />
                  </Field>
                  <div className="form-actions span-2">
                    <button className="btn btn-primary" type="submit">
                      {closed ? 'Reopen with this reply →' : 'Send reply →'}
                    </button>
                  </div>
                </form>
              )}
              {closed && reopenable && (
                <form action={reopenCase} className="actions" style={{ marginTop: 16 }}>
                  <input type="hidden" name="ticket" value={c.ticketnumber} />
                  <span className="hint">Nothing to add?</span>
                  <button className="link-u textbtn" type="submit">
                    Just reopen it
                  </button>
                </form>
              )}
              {closed && !reopenable && (
                <div className="actions">
                  <Link className="btn btn-primary" href="/support/cases/new">
                    Open a new case →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  )
}
