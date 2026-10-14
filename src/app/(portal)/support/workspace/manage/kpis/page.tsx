import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { MANAGE, ManageNav } from '@/components/support/Manage'
import { Flash, Options, PageHead } from '@/components/support/Parts'
import { WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getSettings } from '@/lib/support/kpi-config'
import { ACTION_LABEL, KPI_DEFS, PERIODS, RULE_DEFS, type RuleAction } from '@/lib/support/kpi-model'
import { ORIGIN, PRIORITY, VERTICAL } from '@/lib/support/options'
import { getPublicQueues } from '@/lib/support/reference'
import { requireManager } from '@/lib/support/session'
import { dmyHm } from '@/lib/support/format'

import { saveSettingsAction } from './actions'

export const metadata: Metadata = { title: 'KPI settings' }

type SP = { ok?: string; error?: string }

const DAYS = [
  { d: 1, l: 'Mon' },
  { d: 2, l: 'Tue' },
  { d: 3, l: 'Wed' },
  { d: 4, l: 'Thu' },
  { d: 5, l: 'Fri' },
  { d: 6, l: 'Sat' },
  { d: 0, l: 'Sun' },
]
const ACTIONS = Object.keys(ACTION_LABEL) as RuleAction[]
const UNIT: Record<string, string> = { '%': '%', h: 'hours', min: 'minutes', n: 'cases', 'per-day': 'per day' }

/* Configuring support KPIs (09-portal-guide.md §4c): one form, five sections, one save. Targets are the heart of it:
   the most specific row wins, so a desk can say "Consumer resolves in two working hours, Critical in two, everything else in four". */
export default async function KpiSettingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireManager()
  const [s, queues] = await Promise.all([getSettings(), getPublicQueues(me.auth).catch(() => [])])
  const sel = (v: number | 'any') => String(v)
  const rows = [...s.targets, null]
  return (
    <>
      <WorkspaceBar active="manage" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Manager view · settings{s.updatedAt ? ` · saved ${dmyHm(s.updatedAt)}` : ' · defaults'}</span>}
          title="Support KPIs and SLA targets"
          lede="What the manager view measures against. Changes apply to every reading at once; nothing here writes to Dynamics."
        />
        <ManageNav active="kpis" period={s.defaultPeriod} />
        {sp.ok && <Flash>Settings saved.</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <form action={saveSettingsAction} className="form-sheet" style={{ maxWidth: 'none' }}>
          <section className="settings-section" id="targets">
            <h2>Targets</h2>
            <p>
              Working minutes to the first response and to resolution. For each case the most specific matching row wins: vertical before priority before origin. Leave the last row blank or clear a row&apos;s minutes to drop it. Dynamics&apos; own SLAs resolve phone and email cases in 240 minutes with a warning at 120; these defaults start from there.
            </p>
            <input type="hidden" name="t_count" value={s.targets.length} />
            <div className="table-wrap">
              <table className="dtable targets">
                <thead>
                  <tr>
                    <th scope="col">Vertical</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Origin</th>
                    <th scope="col">First response (min)</th>
                    <th scope="col">Resolution (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t, i) => (
                    <tr className="row" key={i}>
                      <td>
                        <select name={`t_${i}_vertical`} defaultValue={t ? sel(t.vertical) : 'any'} aria-label="Vertical">
                          <option value="any">Any vertical</option>
                          <Options items={VERTICAL} />
                        </select>
                      </td>
                      <td>
                        <select name={`t_${i}_priority`} defaultValue={t ? sel(t.priority) : 'any'} aria-label="Priority">
                          <option value="any">Any priority</option>
                          <Options items={PRIORITY} />
                        </select>
                      </td>
                      <td>
                        <select name={`t_${i}_origin`} defaultValue={t ? sel(t.origin) : 'any'} aria-label="Origin">
                          <option value="any">Any origin</option>
                          <Options items={ORIGIN} />
                        </select>
                      </td>
                      <td>
                        <input type="number" name={`t_${i}_response`} min={1} defaultValue={t ? t.responseMinutes : ''} placeholder={t ? '' : 'add a row…'} aria-label="First response minutes" />
                      </td>
                      <td>
                        <input type="number" name={`t_${i}_resolve`} min={1} defaultValue={t ? t.resolveMinutes : ''} aria-label="Resolution minutes" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="settings-section" id="clock">
            <h2>The clock</h2>
            <p>How elapsed time is counted and when a case becomes &quot;at risk&quot;.</p>
            <div className="settings-grid">
              <div className="field">
                <label className="label" htmlFor="warn">
                  At risk from (% of target used)
                </label>
                <span className="control">
                  <input id="warn" name="warnAtPercent" type="number" min={10} max={99} defaultValue={s.warnAtPercent} />
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="mode">
                  Counting
                </label>
                <span className="control is-select">
                  <select id="mode" name="hours_mode" defaultValue={s.hours.mode}>
                    <option value="business">Business hours only</option>
                    <option value="always">Around the clock</option>
                  </select>
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="hstart">
                  Day starts
                </label>
                <span className="control">
                  <input id="hstart" name="hours_start" type="time" defaultValue={s.hours.start} />
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="hend">
                  Day ends
                </label>
                <span className="control">
                  <input id="hend" name="hours_end" type="time" defaultValue={s.hours.end} />
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="tz">
                  Time zone
                </label>
                <span className="control">
                  <input id="tz" name="hours_tz" type="text" defaultValue={s.hours.timeZone} />
                </span>
              </div>
              <div className="field">
                <span className="label">Working days</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', paddingTop: 8 }}>
                  {DAYS.map((d) => (
                    <label className="check" key={d.d}>
                      <input type="checkbox" name={`day_${d.d}`} value="1" defaultChecked={s.hours.days.includes(d.d)} /> {d.l}
                    </label>
                  ))}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px', marginTop: 20 }}>
              <label className="check">
                <input type="checkbox" name="phoneCountsAsResponded" value="1" defaultChecked={s.phoneCountsAsResponded} /> Phone cases count as answered on the call
              </label>
              <label className="check">
                <input type="checkbox" name="pauseWhileWaiting" value="1" defaultChecked={s.pauseWhileWaiting} /> Pause the clock while In Progress-Customer
              </label>
              <label className="check">
                <input type="checkbox" name="subtractOnHold" value="1" defaultChecked={s.subtractOnHold} /> Subtract Dynamics on-hold minutes
              </label>
            </div>
          </section>

          <section className="settings-section" id="cards">
            <h2>KPI cards</h2>
            <p>Which cards the overview shows and the target each is held to. A blank target keeps the card informational.</p>
            <div className="kpi-rows">
              {KPI_DEFS.map((d) => {
                const k = s.kpis.find((x) => x.key === d.key) ?? { key: d.key, enabled: false, target: d.defaultTarget }
                return (
                  <div className="kpi-row" key={d.key}>
                    <label className="check" aria-label={`Show ${d.label}`}>
                      <input type="checkbox" name={`kpi_${d.key}_enabled`} value="1" defaultChecked={k.enabled} />
                    </label>
                    <span>
                      <span className="lab">{d.label}</span>
                      <span className="what" style={{ display: 'block' }}>
                        {d.what}
                      </span>
                    </span>
                    <span>
                      <input type="number" name={`kpi_${d.key}_target`} step="any" defaultValue={k.target ?? ''} aria-label={`${d.label} target`} placeholder="no target" />
                      <span className="unit">
                        {d.direction === 'up' ? '≥' : '≤'} · {UNIT[d.unit]}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="field" style={{ marginTop: 20, maxWidth: 280 }}>
              <label className="label" htmlFor="dp">
                Default period
              </label>
              <span className="control is-select">
                <select id="dp" name="defaultPeriod" defaultValue={s.defaultPeriod}>
                  <Options items={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
                </select>
              </span>
            </div>
          </section>

          <section className="settings-section" id="prevention">
            <h2>Prevention rules</h2>
            <p>
              What should happen before a case breaches. The <Link href={`${MANAGE}/at-risk`}>at-risk board</Link> shows every verdict live; the sweep applies the actions. A dry run only records what it would do. Live runs write to the CRM and send mail, and only ever to UAT: production is read-only in code.
            </p>
            <div className="rules">
              {RULE_DEFS.map((d) => {
                const r = s.rules.find((x) => x.key === d.key) ?? { key: d.key, enabled: false, thresholdMinutes: d.defaultThreshold, cooldownHours: 8, actions: d.defaultActions, queueId: null }
                return (
                  <div className="rule" key={d.key}>
                    <div>
                      <label className="check" style={{ alignItems: 'flex-start' }}>
                        <input type="checkbox" name={`rule_${d.key}_enabled`} value="1" defaultChecked={r.enabled} />
                        <span>
                          <h3 style={{ display: 'inline' }}>{d.label}</h3>
                          <p>{d.what}</p>
                        </span>
                      </label>
                    </div>
                    <div className="rule-fields">
                      {d.thresholdLabel && (
                        <div className="field">
                          <label className="label" htmlFor={`th-${d.key}`}>
                            {d.thresholdLabel}
                          </label>
                          <span className="control">
                            <input id={`th-${d.key}`} type="number" min={0} name={`rule_${d.key}_threshold`} defaultValue={r.thresholdMinutes ?? ''} />
                          </span>
                        </div>
                      )}
                      <div className="field">
                        <label className="label" htmlFor={`cd-${d.key}`}>
                          Cooldown (hours)
                        </label>
                        <span className="control">
                          <input id={`cd-${d.key}`} type="number" min={1} name={`rule_${d.key}_cooldown`} defaultValue={r.cooldownHours} />
                        </span>
                      </div>
                      <div className="field" style={{ gridColumn: '1 / -1' }}>
                        <span className="label">Actions</span>
                        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', paddingTop: 8 }}>
                          {ACTIONS.map((a) => (
                            <label className="check" key={a}>
                              <input type="checkbox" name={`rule_${d.key}_actions`} value={a} defaultChecked={r.actions.includes(a)} /> {ACTION_LABEL[a]}
                            </label>
                          ))}
                        </span>
                      </div>
                      <div className="field">
                        <label className="label" htmlFor={`q-${d.key}`}>
                          Queue for &quot;Add to a queue&quot;
                        </label>
                        <span className="control is-select">
                          <select id={`q-${d.key}`} name={`rule_${d.key}_queue`} defaultValue={r.queueId ?? ''}>
                            <Options empty="—" items={queues.map((q) => ({ value: q.id, label: q.name }))} />
                          </select>
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="settings-grid" style={{ marginTop: 24 }}>
              <label className="check">
                <input type="checkbox" name="sweep_enabled" value="1" defaultChecked={s.sweep.enabled} /> Scheduled sweep on
              </label>
              <label className="check">
                <input type="checkbox" name="sweep_live" value="1" defaultChecked={s.sweep.live} /> Allow live runs (write notes, queue, send mail)
              </label>
              <div className="field" style={{ gridColumn: '1 / -1', maxWidth: 560 }}>
                <label className="label" htmlFor="emails">
                  Manager emails for &quot;Email the managers&quot;
                </label>
                <span className="control">
                  <input id="emails" name="sweep_emails" type="text" defaultValue={s.sweep.managerEmails.join(', ')} placeholder="one@k7computing.com, two@k7computing.com" />
                </span>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Schedule: <code>POST /api/support/sla/sweep</code> with <code>Authorization: Bearer $CRON_SECRET</code> every 15 minutes; send <code>{'{"live":true}'}</code> for a live run. Mail goes through SMTP_URL when set, otherwise to the server log.
            </p>
          </section>

          <section className="settings-section" id="access">
            <h2>Who is a manager</h2>
            <p>Agents holding any of these Dynamics security roles see the Manage tab. Add work emails for anyone else who should.</p>
            <div className="two-col">
              <div className="field">
                <label className="label" htmlFor="roles">
                  Security roles, one per line
                </label>
                <span className="control">
                  <textarea id="roles" name="managerRoles" rows={5} defaultValue={s.managerRoles.join('\n')} />
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="mgrs">
                  Manager emails, one per line
                </label>
                <span className="control">
                  <textarea id="mgrs" name="managers" rows={5} defaultValue={s.managers.join('\n')} />
                </span>
              </div>
            </div>
          </section>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit">
              Save settings →
            </button>
            <Link className="link-u" href={MANAGE}>
              Back to the overview
            </Link>
          </div>
        </form>
      </section>
    </>
  )
}
