import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { MANAGE, ManageNav, SlaMeter, SlaStrip, SlaTag } from '@/components/support/Manage'
import { Flash, Options, PageHead, Pager, qs, Tid, When } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getSettings } from '@/lib/support/kpi-config'
import { ACTION_LABEL, ruleDef } from '@/lib/support/kpi-model'
import { atRiskBoard, loadDesk, slaNow, type CaseLite } from '@/lib/support/metrics'
import { label as optLabel, PRIORITY, VERTICAL } from '@/lib/support/options'
import { evaluateRules, recentEvents, verdictsByCase } from '@/lib/support/prevention'
import { getAgents, getPublicQueues } from '@/lib/support/reference'
import { requireManager } from '@/lib/support/session'
import { dmyHm } from '@/lib/support/format'
import { fmtMinutes } from '@/lib/support/sla'

import { nudgeAction, queueAction, reassignAction, sweepAction } from './actions'

export const metadata: Metadata = { title: 'At risk' }

type SP = { state?: string; owner?: string; page?: string; ok?: string; error?: string; run?: string; fired?: string; done?: string; skipped?: string; failed?: string; mode?: string; csatInvited?: string; csatReminded?: string; csatOverdue?: string }

const PATH = `${MANAGE}/at-risk`
const PAGE = 40

/* The prevention board: every active case the rules worry about, most urgent first, with the verdicts the rules reach now,
   the actions a manager can take on the spot, and what the sweep did last. */
export default async function AtRiskPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireManager()
  const settings = await getSettings()
  const [desk, agents, queues, events] = await Promise.all([loadDesk(me.auth, settings, '7d'), getAgents(me.auth).catch(() => []), getPublicQueues(me.auth).catch(() => []), recentEvents({ limit: 30 })])
  const now = slaNow(desk)
  const verdicts = verdictsByCase(evaluateRules(desk, settings))
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
  const lastRun = events[0]
  const enabledRules = settings.rules.filter((r) => r.enabled)
  return (
    <>
      <WorkspaceBar active="manage" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Manager view · live · {dmyHm(desk.fetchedAt)}</span>}
          title="Before it breaches"
          lede={
            <>
              {now.breached} active cases are past target, {now.atRisk} are at risk and {now.responsePending} have had no first response. Rules below say what should happen; the sweep applies them.
            </>
          }
          actions={
            <Link className="btn btn-line btn-sm" href={`${MANAGE}/kpis#prevention`}>
              Prevention rules →
            </Link>
          }
        />
        <ManageNav active="at-risk" period={settings.defaultPeriod} />
        {sp.ok === 'sweep' && (
          <Flash>
            Sweep {sp.run} ran in {sp.mode === 'live' ? 'live' : 'dry-run'} mode: {sp.fired} verdicts, {sp.done} recorded{sp.mode === 'live' ? ' and applied' : ''}, {sp.skipped} within cooldown, {sp.failed} failed.
            {sp.csatInvited !== undefined ? ` CSAT: ${sp.csatInvited} surveys ${sp.mode === 'live' ? 'sent' : 'to send'}, ${sp.csatReminded} reminders, ${sp.csatOverdue} follow-ups overdue.` : ''}
          </Flash>
        )}
        {sp.ok && sp.ok !== 'sweep' && <Flash>{sp.ok === 'reassigned' ? 'Case reassigned.' : sp.ok === 'nudged' ? 'Reminder posted on the case.' : 'Case added to the queue.'}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <SlaStrip n={now} href={PATH} />

        <div className="sweep-box">
          <p>
            {enabledRules.length} rules on: {enabledRules.map((r) => ruleDef(r.key).label).join('; ')}. Mode: <strong>{settings.sweep.live ? 'live' : 'dry run'}</strong>.
            {lastRun ? ` Last sweep ${dmyHm(lastRun.createdAt)} by ${lastRun.actor || 'cron'}.` : ' No sweep has run yet.'}
          </p>
          <form action={sweepAction}>
            <input type="hidden" name="return" value={ret} />
            <button className="btn btn-line btn-sm" type="submit" name="live" value="0">
              Dry run now
            </button>
            {settings.sweep.live && (
              <button className="btn btn-primary btn-sm" type="submit" name="live" value="1">
                Run live →
              </button>
            )}
          </form>
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
            const vs = verdicts.get(c.id) ?? []
            return (
              <article className={`board-row${c.resolve.state === 'breached' ? ' is-breached' : ''}`} key={c.id}>
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
                  {vs.length > 0 && (
                    <div className="verdicts" style={{ marginTop: 8 }}>
                      {vs.map((v) => (
                        <span className="tag tag-dashed" key={v.rule} title={`${v.reason}. ${v.actions.map((a) => ACTION_LABEL[a]).join(', ')}`}>
                          {v.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="m">
                  <SlaMeter r={c.resolve} label={`Resolution · target ${fmtMinutes(c.target.resolveMinutes)}`} />
                  {c.firstResponseAt ? (
                    <span className="label muted">
                      Response <SlaTag state={c.response.state} />
                    </span>
                  ) : (
                    <SlaMeter r={c.response} label={`First response · target ${fmtMinutes(c.target.responseMinutes)}`} />
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
          What the sweep did
          <span className="label">last {events.length}</span>
        </h2>
        {events.length === 0 ? (
          <p className="hint">No sweep has run yet. Run a dry run above, or schedule POST /api/support/sla/sweep.</p>
        ) : (
          <div className="events">
            {events.map((e) => (
              <div className="event" key={e.id}>
                <span className="when">{dmyHm(e.createdAt)}</span>
                <span>
                  <Tid ticket={e.ticket} href={`${WS}/cases/${e.caseId}`} /> · {ruleDef(e.rule as never)?.label ?? e.rule} · <span className={`tag${e.mode === 'live' ? ' tag-solid' : ' tag-dashed'}`}>{e.mode}</span>{' '}
                  <span className={`tag${e.outcome === 'failed' ? ' tag-signal' : ''}`}>{e.outcome}</span>
                  <span className="d" style={{ display: 'block' }}>
                    {e.actions}. {e.detail}
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
