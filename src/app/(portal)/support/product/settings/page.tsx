import type { Metadata } from 'next'
import React from 'react'

import { Field, Flash, PageHead } from '@/components/support/Parts'
import { ProductNav } from '@/components/support/Product'
import { WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getProductSettings } from '@/lib/support/product-config'
import { requireLead } from '@/lib/support/session'

import { saveProductSettingsAction } from './actions'

export const metadata: Metadata = { title: 'Product desk settings' }

/* The product desk's configuration (10-product-desk.md §5), for team leads: the two teams, who is principal support, the priorities
   and their clocks, the mirror switches and the notifications. The tracker stays link-only until phase B. */
export default async function ProductSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams
  await requireLead()
  const s = await getProductSettings()
  const check = (name: string, label: string, checked: boolean, hint?: string) => (
    <label className="check" key={name}>
      <input type="checkbox" name={name} value="1" defaultChecked={checked} />
      <span>
        {label}
        {hint ? <span className="hint"> · {hint}</span> : null}
      </span>
    </label>
  )
  return (
    <>
      <WorkspaceBar active="product" />
      <section className="sheet ws g-paper">
        <ProductNav active="settings" lead />
        <PageHead above={<span className="label muted">Product desk · settings</span>} title="How the loop runs." lede="Who triages, which team gets what, how fast product has to answer, and what the desk writes back to Dynamics. Nothing here touches the CRM's schema." />
        {sp.ok && <Flash>Settings saved. They apply at once.</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <form action={saveProductSettingsAction} className="form-grid" style={{ gap: 40 }}>
          <div className="span-2">{check('enabled', 'Product desk on', s.enabled, 'the escalate panel on cases and the inbox for principal support')}</div>

          <div className="span-2 settings-grid">
            {s.teams.map((t) => (
              <div key={t.key}>
                <h2 className="sub-head">{t.name}</h2>
                <div className="form-grid">
                  <Field id={`team_${t.key}_name`} label="Name" span>
                    <input id={`team_${t.key}_name`} name={`team_${t.key}_name`} defaultValue={t.name} />
                  </Field>
                  <Field id={`team_${t.key}_inbox`} label="Inbox email" span hint="Mailed when an item is accepted for this team.">
                    <input id={`team_${t.key}_inbox`} name={`team_${t.key}_inbox`} type="email" defaultValue={t.inboxEmail} />
                  </Field>
                  <Field id={`team_${t.key}_leads`} label="Leads (emails)" span hint="Leads edit these settings and are mailed the weekly digest.">
                    <textarea id={`team_${t.key}_leads`} name={`team_${t.key}_leads`} rows={2} defaultValue={t.leads.join('\n')} />
                  </Field>
                  <Field id={`team_${t.key}_project`} label="Tracker project id" span hint="The Yodiz project for this team (phase B).">
                    <input id={`team_${t.key}_project`} name={`team_${t.key}_project`} defaultValue={t.trackerProject} />
                  </Field>
                </div>
              </div>
            ))}
            <div>
              <h2 className="sub-head">Principal support</h2>
              <div className="form-grid">
                <Field id="principals_roles" label="Dynamics security roles" span hint="One per line. Agents holding any of them triage.">
                  <textarea id="principals_roles" name="principals_roles" rows={3} defaultValue={s.principals.roles.join('\n')} />
                </Field>
                <Field id="principals_emails" label="Or by email" span>
                  <textarea id="principals_emails" name="principals_emails" rows={3} defaultValue={s.principals.emails.join('\n')} />
                </Field>
                <div className="span-2">{check('principals_managers', 'Service managers triage too', s.principals.managersAreprincipals)}</div>
              </div>
            </div>
          </div>

          <div className="span-2">
            <h2 className="sub-head">Priorities and clocks</h2>
            <p className="hint" style={{ marginBottom: 16 }}>
              Triage: working hours to accept or decline a raised item. Cadence: working days between updates while it is with product. Business hours are the desk&rsquo;s (KPI settings).
            </p>
            <div className="table-wrap">
              <table className="dtable" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th scope="col">Priority</th>
                    <th scope="col">Means</th>
                    <th scope="col">Triage (h)</th>
                    <th scope="col">Update every (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {s.priorities.map((p) => (
                    <tr key={p.key}>
                      <td className="id">{p.key}</td>
                      <td className="text" style={{ maxWidth: 'none' }}>
                        <input name={`prio_${p.key}_label`} defaultValue={p.label} style={{ width: '100%' }} aria-label={`${p.key} meaning`} />
                      </td>
                      <td className="num">
                        <input name={`prio_${p.key}_triage`} defaultValue={p.triageHours} inputMode="numeric" style={{ width: 72, textAlign: 'right' }} aria-label={`${p.key} triage hours`} />
                      </td>
                      <td className="num">
                        <input name={`prio_${p.key}_cadence`} defaultValue={p.updateEveryDays} inputMode="numeric" style={{ width: 72, textAlign: 'right' }} aria-label={`${p.key} cadence days`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-grid" style={{ marginTop: 20 }}>
              <div className="span-2">{check('clock_pause', 'Time with product pauses the engineer’s resolution clock', s.clock.pauseWhileWithProduct, 'the desk-wide clock keeps running; the SLA strip shows "with product" (phase B)')}</div>
              <Field id="clock_autoclose" label="Auto-close released items after (days)">
                <input id="clock_autoclose" name="clock_autoclose" defaultValue={s.clock.autoCloseDays} inputMode="numeric" />
              </Field>
              <Field id="clock_warn" label="Warn at (% of target)">
                <input id="clock_warn" name="clock_warn" defaultValue={s.clock.warnAtPercent} inputMode="numeric" />
              </Field>
            </div>
          </div>

          <div className="span-2 settings-grid">
            <div>
              <h2 className="sub-head">CRM mirror</h2>
              <p className="hint" style={{ marginBottom: 12 }}>
                What the desk writes back to Dynamics, always through the guarded client, never a new field. Off: every write is recorded in the outbox as queued and nothing reaches the CRM.
              </p>
              <div className="form-grid">
                <div className="span-2">{check('mirror_enabled', 'Mirror on', s.mirror.enabled, 'UAT first; production refuses writes until the product flag opens')}</div>
                <div className="span-2">{check('mirror_notes', 'Internal note on every linked case at each change', s.mirror.notesOnLinkedCases)}</div>
                <div className="span-2">{check('mirror_status', 'Move the case status reason (Principle Support / Lab, and back to Support)', s.mirror.statusBack)}</div>
                <div className="span-2">{check('mirror_rows', 'Create and update the CRM\u2019s RFE and defect rows', s.mirror.createCrmRows, 'an enhancement is a k7_rfe, a defect or detection a k7_defect; status, priority and the YODIZ id follow the item')}</div>
              </div>
            </div>
            <div>
              <h2 className="sub-head">Notifications</h2>
              <div className="form-grid">
                <div className="span-2">{check('notify_principals', 'Mail principal support and the leads when an item is raised', s.notify.principalsOnRaise)}</div>
                <div className="span-2">{check('notify_inbox', 'Mail the team inbox when an item is accepted', s.notify.inboxOnAccept)}</div>
                <div className="span-2">{check('notify_owner', 'Mail the support owner on every product-side change', s.notify.ownerOnChange)}</div>
                <p className="hint span-2">Mail leaves only through SMTP_URL; without it the message is logged.</p>
              </div>
              <h2 className="sub-head" style={{ marginTop: 32 }}>
                Tracker <span className="label">{s.tracker.kind === 'none' ? 'link only' : s.tracker.kind}</span>
              </h2>
              <p className="hint">Keys are typed by hand on the item and open through YODIZ_URL_PATTERN when set. The Yodiz adapter (create, status, attachments, polling) is phase B.</p>
            </div>
          </div>

          <div className="form-actions span-2">
            <button className="btn btn-primary btn-sm" type="submit">
              Save settings →
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
