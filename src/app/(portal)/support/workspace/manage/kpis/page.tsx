import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { MANAGE, ManageNav } from '@/components/support/Manage'
import { Flash, Options, PageHead } from '@/components/support/Parts'
import { WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getSettings } from '@/lib/support/kpi-config'
import { INVITE_MODE_LABEL } from '@/lib/support/csat-model'
import { KPI_DEFS, NEW_CLOCK_DEFAULTS, PERIODS } from '@/lib/support/kpi-model'
import { ORIGIN, PRIORITY, VERTICAL } from '@/lib/support/options'
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
const UNIT: Record<string, string> = { '%': '%', h: 'hours', min: 'minutes', n: 'cases', 'per-day': 'per day', score: 'of 5' }

/* Configuring support KPIs (09-portal-guide.md §4c): one form, one save. Targets are the heart of it: the most specific row wins,
   so a desk can say "Consumer resolves in two working hours, Critical in two, everything else in four". The shifts say which
   minutes are working minutes for every clock. Who is told what is on the notifications page (§4g). */
export default async function KpiSettingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  await requireManager()
  const s = await getSettings()
  const sel = (v: number | 'any') => String(v)
  const rows = [...s.targets, null]
  const shiftRows = [...s.hours.shifts, null]
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
              Working minutes for each SLA clock. For each case the most specific matching row wins: vertical before priority before origin. Leave the last row blank or clear a row&apos;s first-response and resolution minutes to drop it. Dynamics&apos; own SLAs resolve phone and email cases in 240 minutes with a warning at 120; these defaults start from there. <em>Follow-up</em> runs from a customer&apos;s message on an answered case to the next answer; <em>Pick-up</em> while a case sits in a bin (a shared account such as Support #, a team, or nobody); <em>Lab</em> from the case moving to In Progress-Lab until it is resolved.
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
                    <th scope="col">Follow-up (min)</th>
                    <th scope="col">Pick-up (min)</th>
                    <th scope="col">Lab (min)</th>
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
                      <td>
                        <input type="number" name={`t_${i}_followup`} min={1} defaultValue={t ? t.followUpMinutes : ''} placeholder={t ? '' : String(NEW_CLOCK_DEFAULTS.followUpMinutes)} aria-label="Follow-up reply minutes" />
                      </td>
                      <td>
                        <input type="number" name={`t_${i}_pickup`} min={1} defaultValue={t ? t.pickupMinutes : ''} placeholder={t ? '' : String(NEW_CLOCK_DEFAULTS.pickupMinutes)} aria-label="Pick-up minutes" />
                      </td>
                      <td>
                        <input type="number" name={`t_${i}_lab`} min={1} defaultValue={t ? t.labMinutes : ''} placeholder={t ? '' : String(NEW_CLOCK_DEFAULTS.labMinutes)} aria-label="Lab sample minutes" />
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
                <label className="label" htmlFor="tz">
                  Time zone
                </label>
                <span className="control">
                  <input id="tz" name="hours_tz" type="text" defaultValue={s.hours.timeZone} />
                </span>
              </div>
            </div>
            <h3 className="settings-sub" id="shifts">
              Shifts
            </h3>
            <p>
              The desk works the union of its shifts: every clock counts only those minutes. A shift ends after midnight when its end is before its start; its days are the days it starts on. Members are the engineers <em>on shift</em> for a notification: work emails, one per line. A shift ending is also when the shift-end digest and the KPI notifications go.
            </p>
            <input type="hidden" name="sh_count" value={s.hours.shifts.length} />
            <div className="table-wrap">
              <table className="dtable shifts">
                <thead>
                  <tr>
                    <th scope="col">Shift</th>
                    <th scope="col">Starts</th>
                    <th scope="col">Ends</th>
                    <th scope="col">Days</th>
                    <th scope="col">Members</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftRows.map((sh, i) => (
                    <tr className="row" key={sh?.key ?? 'new'}>
                      <td>
                        <input type="hidden" name={`sh_${i}_key`} value={sh?.key ?? ''} />
                        <input type="text" name={`sh_${i}_name`} defaultValue={sh?.name ?? ''} placeholder={sh ? '' : 'add a shift…'} aria-label="Shift name" />
                        {sh && s.hours.shifts.length > 1 && (
                          <label className="check" style={{ marginTop: 8 }}>
                            <input type="checkbox" name={`sh_${sh.key}_drop`} value="1" /> Remove
                          </label>
                        )}
                      </td>
                      <td>
                        <input type="time" name={`sh_${i}_start`} defaultValue={sh?.start ?? ''} aria-label="Starts" />
                      </td>
                      <td>
                        <input type="time" name={`sh_${i}_end`} defaultValue={sh?.end ?? ''} aria-label="Ends" />
                      </td>
                      <td>
                        <span className="shift-days">
                          {DAYS.map((d) => (
                            <label className="check" key={d.d}>
                              <input type="checkbox" name={`sh_${i}_day_${d.d}`} value="1" defaultChecked={sh ? sh.days.includes(d.d) : false} /> {d.l}
                            </label>
                          ))}
                        </span>
                      </td>
                      <td>
                        <textarea name={`sh_${i}_members`} rows={3} defaultValue={sh?.members.join('\n') ?? ''} aria-label="Members' work emails" placeholder="engineer@k7computing.com" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            <div className="field" style={{ marginTop: 20, maxWidth: 560 }}>
              <label className="label" htmlFor="auto-subj">
                Automatic emails, one subject start per line
              </label>
              <span className="control">
                <textarea id="auto-subj" name="automatedSubjects" rows={6} defaultValue={s.automatedSubjects.join('\n')} />
              </span>
              <span className="hint">Outgoing emails whose subject starts with one of these are the CRM&apos;s own (acknowledgements, reminders, closure notices): they never count as answering the customer.</span>
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

          <section className="settings-section" id="notifications">
            <h2>Notifications</h2>
            <p>
              Who is told when a clock goes at risk or past its target, when a KPI misses its target at the end of a shift, and when something important happens on a case: set on the <Link href={`${MANAGE}/notifications`}>notifications page</Link>. The targets and shifts above are the only rules.
            </p>
            <h3 className="settings-sub">The CSAT pass</h3>
            <div className="settings-grid">
              <label className="check">
                <input type="checkbox" name="sweep_enabled" value="1" defaultChecked={s.sweep.enabled} /> Scheduled CSAT pass on
              </label>
              <label className="check">
                <input type="checkbox" name="sweep_live" value="1" defaultChecked={s.sweep.live} /> Let it email customers (surveys and reminders)
              </label>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Schedule: <code>POST /api/support/sla/sweep</code> with <code>Authorization: Bearer $CRON_SECRET</code> every 15 minutes; send <code>{'{"live":true}'}</code> for a live run.
            </p>
          </section>

          <section className="settings-section" id="csat">
            <h2>Customer satisfaction</h2>
            <p>
              One question on a resolved case, answered 1 to 5. A low score opens a follow-up on the <Link href={`${MANAGE}/csat`}>CSAT page</Link> and marks the customer for extra care; the sweep emails surveys and reminders. Survey mail reaches customers only through SMTP_URL; keep invitations to portal cases while this runs against UAT, whose seeded cases carry real addresses.
            </p>
            <label className="check" style={{ marginBottom: 16 }}>
              <input type="checkbox" name="csat_enabled" value="1" defaultChecked={s.csat.enabled} /> CSAT on (survey, care bands, report)
            </label>
            <div className="settings-grid">
              <div className="field">
                <label className="label" htmlFor="cs-sat">
                  Satisfied from (score)
                </label>
                <span className="control">
                  <input id="cs-sat" name="csat_satisfiedFrom" type="number" min={2} max={5} defaultValue={s.csat.satisfiedFrom} />
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="cs-low">
                  Unhappy at or below (score)
                </label>
                <span className="control">
                  <input id="cs-low" name="csat_unhappyAtOrBelow" type="number" min={1} max={4} defaultValue={s.csat.unhappyAtOrBelow} />
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="cs-fu">
                  Follow-up target (working minutes)
                </label>
                <span className="control">
                  <input id="cs-fu" name="csat_followUpMinutes" type="number" min={15} defaultValue={s.csat.followUpMinutes} />
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="cs-mode">
                  Email surveys for
                </label>
                <span className="control is-select">
                  <select id="cs-mode" name="csat_inviteMode" defaultValue={s.csat.inviteMode}>
                    {(['off', 'portal', 'all'] as const).map((m) => (
                      <option value={m} key={m}>
                        {INVITE_MODE_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="cs-rem">
                  Remind after (hours, blank for none)
                </label>
                <span className="control">
                  <input id="cs-rem" name="csat_reminderAfterHours" type="number" min={0} defaultValue={s.csat.reminderAfterHours ?? ''} />
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="cs-days">
                  Survey link valid for (days)
                </label>
                <span className="control">
                  <input id="cs-days" name="csat_surveyDays" type="number" min={1} max={90} defaultValue={s.csat.surveyDays} />
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="cs-win">
                  Care band looks back (days)
                </label>
                <span className="control">
                  <input id="cs-win" name="csat_careWindowDays" type="number" min={7} max={730} defaultValue={s.csat.careWindowDays} />
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="cs-rec">
                  Latest ratings that make the band
                </label>
                <span className="control">
                  <input id="cs-rec" name="csat_careRecent" type="number" min={1} max={10} defaultValue={s.csat.careRecent} />
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px', marginTop: 20 }}>
              <label className="check">
                <input type="checkbox" name="csat_inviteOnResolve" value="1" defaultChecked={s.csat.inviteOnResolve} /> Email the survey when an agent resolves a case
              </label>
              <Link className="link-u" href={`${MANAGE}/notifications#csat`}>
                Who hears of a low score →
              </Link>
            </div>
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
