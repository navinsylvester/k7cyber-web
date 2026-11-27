import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { MANAGE, ManageNav, SlaMeter, SlaStrip, SlaTag } from '@/components/support/Manage'
import { Flash, Options, PageHead, Pager, qs, Tid, When } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getSettings } from '@/lib/support/kpi-config'
import { atRiskBoard, loadDesk, runningClocks, slaNow, worstClock, type CaseLite } from '@/lib/support/metrics'
import { clockDef, notifyDef } from '@/lib/support/notify-model'
import { recentSent } from '@/lib/support/notify'
import { label as optLabel, PRIORITY, VERTICAL } from '@/lib/support/options'
import { getAgents, getPublicQueues } from '@/lib/support/reference'
import { requireManager } from '@/lib/support/session'
import { dmyHm } from '@/lib/support/format'
import { fmtMinutes } from '@/lib/support/sla'

import { checkAction, nudgeAction, queueAction, reassignAction, sweepAction } from './actions'

export const metadata: Metadata = { title: 'At risk' }

type SP = { state?: string; owner?: string; page?: string; ok?: string; error?: string; mode?: string; csatInvited?: string; csatReminded?: string; csatOverdue?: string; cases?: string; first?: string; events?: string; told?: string; runs?: string; closed?: string; ms?: string }

const PATH = `${MANAGE}/at-risk`
const PAGE = 40

/* Before it breaches: every active case with an SLA clock at risk or past target, most urgent first, each running clock as a
   meter, the actions a manager can take on the spot, and what the notification watch told lately (09-portal-guide.md §4c, §4g). */
export default async function AtRiskPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireManager()
  const settings = await getSettings()
  const [desk, agents, queues, sent] = await Promise.all([loadDesk(me.auth, settings, '7d'), getAgents(me.auth).catch(() => []), getPublicQueues(me.auth).catch(() => []), recentSent({ limit: 40 })])
  const now = slaNow(desk)
  const state = sp.state
  let rows: CaseLite[]
  let heading: string
  if (state === 'ok') {
    rows = desk.activeCases.filter((c) => c.resolve.state === 'ok').sort((a, b) => a.resolve.left - b.resolve.left)
    heading = 'On track, least time left first'
  } else if (state === 'paused') {
    rows = desk.activeCases.filter((c) => c.resolve.state === 'paused').sort((a, b) => a.modifiedon.getTime() - b.modifiedon.getTime())
    heading = 'Paused while waiting on the customer, longest wait first'
  } else if (state === 'response') {
    rows = desk.activeCases.filter((c) => !c.firstResponseAt && c.response.state !== 'paused').sort((a, b) => a.response.left - b.response.left)
    heading = 'No first response yet, least time left first'
  } else if (state === 'follow-up') {
    rows = desk.activeCases.filter((c) => c.followUpSince).sort((a, b) => a.followUp.left - b.followUp.left)
    heading = 'The customer wrote and waits for an answer, least time left first'
  } else if (state === 'pickup') {
    rows = desk.activeCases.filter((c) => c.binSince).sort((a, b) => a.pickup.left - b.pickup.left)
    heading = 'In the bin, waiting to be picked, longest first'
  } else if (state === 'lab') {
    rows = desk.activeCases.filter((c) => c.labSince).sort((a, b) => a.lab.left - b.lab.left)
    heading = 'With the Lab, least time left first'
  } else if (state === 'breached' || state === 'at-risk') {
    rows = desk.activeCases.filter((c) => c.resolve.state === state).sort((a, b) => a.resolve.left - b.resolve.left)
    heading = state === 'breached' ? 'Past target' : 'At risk, least time left first'
  } else {
    rows = atRiskBoard(desk)
    heading = 'Needs attention, most urgent first'
  }
  if (sp.owner) rows = rows.filter((c) => c.owner.id === sp.owner)
  const owners = [...new Map(desk.activeCases.map((c) => [c.owner.id, c.owner])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const page = Math.max(1, Number(sp.page) || 1)
  const slice = rows.slice((page - 1) * PAGE, page * PAGE)
  const base = { state, owner: sp.owner, page: page > 1 ? page : undefined }
  const ret = PATH + qs(base)
  const last = sent[0]
  return (
    <>
      <WorkspaceBar active="manage" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Manager view · live · {dmyHm(desk.fetchedAt)}</span>}
          title="Before it breaches"
          lede={
            <>
              {now.breached} active cases are past their resolution target, {now.atRisk} are at risk, {now.responsePending} have had no first response, {now.followUps} have a customer waiting for an answer, {now.inBin} sit in a bin and {now.withLab} are with the Lab. The watch tells people as clocks turn; who hears what is on the notifications page.
            </>
          }
          actions={
            <Link className="btn btn-line btn-sm" href={`${MANAGE}/notifications`}>
              Notifications →
            </Link>
          }
        />
        <ManageNav active="at-risk" period={settings.defaultPeriod} />
        {sp.ok === 'watch' && (
          <Flash>
            The watch read {sp.cases} active cases in {Math.round(Number(sp.ms ?? 0) / 100) / 10} s: {sp.first} seen for the first time, {sp.events} events and {sp.told} clock states told, {sp.runs} pick-up or Lab runs finished, {sp.closed} cases left the desk.
          </Flash>
        )}
        {sp.ok === 'csat' && (
          <Flash>
            CSAT pass ({sp.mode === 'live' ? 'live' : 'dry run'}): {sp.csatInvited ?? 0} surveys {sp.mode === 'live' ? 'sent' : 'to send'}, {sp.csatReminded ?? 0} reminders, {sp.csatOverdue ?? 0} follow-ups overdue.
          </Flash>
        )}
        {sp.ok && sp.ok !== 'watch' && sp.ok !== 'csat' && <Flash>{sp.ok === 'reassigned' ? 'Case reassigned.' : sp.ok === 'nudged' ? 'Reminder posted on the case.' : 'Case added to the queue.'}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <SlaStrip n={now} href={PATH} />

        <div className="sweep-box">
          <p>
            Notifications {settings.notify.enabled ? 'on' : <strong>off</strong>}: the watch reads the desk every minute and tells the people each notification&apos;s rule names; the list below is everything told, to whom.
            {last ? ` Last told ${dmyHm(last.at)}.` : ' Nothing told yet.'}
          </p>
          <form action={checkAction}>
            <input type="hidden" name="return" value={ret} />
            <button className="btn btn-line btn-sm" type="submit">
              Check now
            </button>
          </form>
          {settings.csat.enabled && (
            <form action={sweepAction}>
              <input type="hidden" name="return" value={ret} />
              <button className="btn btn-line btn-sm" type="submit" name="live" value="0">
                CSAT pass, dry run
              </button>
              {settings.sweep.live && (
                <button className="btn btn-primary btn-sm" type="submit" name="live" value="1">
                  CSAT pass, live →
                </button>
              )}
            </form>
          )}
        </div>

        <form className="filters-inline" action={PATH} method="get" aria-label="Filter the board">
          {state && <input type="hidden" name="state" value={state} />}
          <div className="field">
            <label className="label" htmlFor="b-owner">
              Owner
            </label>
            <span className="control is-select">
              <select id="b-owner" name="owner" defaultValue={sp.owner ?? ''}>
                <Options empty="Anyone" items={owners.map((o) => ({ value: o.id, label: o.name }))} />
              </select>
            </span>
          </div>
          <div className="filters-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Filter
            </button>
            {(sp.owner || state) && (
              <Link className="link-u" href={PATH}>
                Clear
              </Link>
            )}
          </div>
        </form>

        <h2 className="sub-head">
          {heading}
          <span className="label">{rows.length}</span>
        </h2>
        <div className="board">
          {rows.length === 0 && <p className="hint" style={{ padding: '24px 0' }}>Nothing here. Every active case is inside its target.</p>}
          {slice.map((c) => {
            const clocks = runningClocks(c)
            return (
              <article className={`board-row${worstClock(c).rank === 0 ? ' is-breached' : ''}`} key={c.id}>
                <div>
                  <div className="t">
                    <Link href={`${WS}/cases/${c.id}`}>{c.title || '(no title)'}</Link>
                  </div>
                  <div className="s">
                    <Tid ticket={c.ticket} />
                    <span>{c.customer || 'No customer'}</span>
                    <span>{c.status}</span>
                    <span>{optLabel(PRIORITY, c.priority) || 'No priority'}</span>
                    <span>{optLabel(VERTICAL, c.vertical) || 'No vertical'}</span>
                    <span>
                      owner <Link href={`${MANAGE}/engineers/${c.owner.id}`}>{c.owner.name}</Link>
                      {c.owner.kind !== 'user' ? ` (${c.owner.kind})` : ''}
                    </span>
                    <span>
                      changed <When date={c.modifiedon.toISOString()} />
                    </span>
                  </div>
                </div>
                <div className="m">
                  {clocks.map(({ clock, reading }) => (
                    <SlaMeter r={reading} label={`${clockDef(clock).label} · target ${fmtMinutes(reading.target)}`} key={clock} />
                  ))}
                  {c.firstResponseAt && (
                    <span className="label muted">
                      Response <SlaTag state={c.response.state} />
                    </span>
                  )}
                  {c.crm && (
                    <span className="label muted">
                      CRM {c.crm.name} <SlaTag state={c.crm.state} />
                    </span>
                  )}
                </div>
                <div className="acts-inline">
                  <form action={reassignAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="return" value={ret} />
                    <select name="owner" aria-label="Reassign to" defaultValue="">
                      <option value="">Reassign to…</option>
                      {agents.map((a) => (
                        <option value={`user:${a.id}`} key={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-line btn-sm" type="submit">
                      Assign
                    </button>
                    <button className="link-u textbtn" type="submit" name="me" value="1">
                      to me
                    </button>
                  </form>
                  <form action={nudgeAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="return" value={ret} />
                    <button className="btn btn-line btn-sm" type="submit">
                      Remind owner
                    </button>
                  </form>
                  {queues.length > 0 && (
                    <form action={queueAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="return" value={ret} />
                      <select name="queue" aria-label="Add to queue" defaultValue="">
                        <option value="">Queue…</option>
                        {queues.map((q) => (
                          <option value={q.id} key={q.id}>
                            {q.name}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn-line btn-sm" type="submit">
                        Queue
                      </button>
                    </form>
                  )}
                </div>
              </article>
            )
          })}
        </div>
        <div className="ledger-foot label">
          <span>
            {rows.length.toLocaleString('en-IN')} cases · page {page}
          </span>
          <Pager page={page} totalPages={Math.max(1, Math.ceil(rows.length / PAGE))} href={(p) => PATH + qs(base, { page: p > 1 ? p : undefined })} label="Cases" newer="Previous" older="Next" />
        </div>

        <h2 className="sub-head" style={{ marginTop: 'clamp(32px, 4cqw, 48px)' }}>
          What the workspace told
          <span className="label">last {sent.length}</span>
        </h2>
        {sent.length === 0 ? (
          <p className="hint">Nothing yet. People are told when a clock goes at risk or past its target, when a KPI misses its target at the end of a shift, and when something important happens on a case; schedule POST /api/support/notify/watch every minute, or press Check now.</p>
        ) : (
          <div className="events">
            {sent.map((e) => (
              <div className="event" key={e.key}>
                <span className="when">{dmyHm(e.at)}</span>
                <span>
                  {e.caseId ? (
                    <>
                      <Tid ticket={e.ticket} href={`${WS}/cases/${e.caseId}`} /> ·{' '}
                    </>
                  ) : null}
                  {notifyDef(e.event)?.label ?? e.event}
                  {e.emailed > 0 ? <span className="tag tag-solid">emailed</span> : null}
                  <span className="d" style={{ display: 'block' }}>
                    To {e.to.join(', ')}.{e.emailed === 0 && e.emailError ? ` No email: ${e.emailError}.` : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
