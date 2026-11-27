import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { MANAGE, ManageNav } from '@/components/support/Manage'
import { Flash, Options, PageHead } from '@/components/support/Parts'
import { WorkspaceBar } from '@/components/support/WorkspaceBar'
import { dmyHm } from '@/lib/support/format'
import { getSettings } from '@/lib/support/kpi-config'
import { PERIODS } from '@/lib/support/kpi-model'
import { AUDIENCE_LABEL, DELIVERY_LABEL, DELIVERIES, GROUP_LABEL, GROUPS, NOTIFY_DEFS, ruleFor } from '@/lib/support/notify-model'
import { mailState } from '@/lib/support/notify'
import { requireManager } from '@/lib/support/session'

import { saveNotificationsAction, testNotificationAction } from './actions'

export const metadata: Metadata = { title: 'Notifications' }

type SP = { ok?: string; error?: string }

const OK: Record<string, string> = {
  saved: 'Notification settings saved.',
  'test-sent': 'Test email sent to your address.',
  'test-logged': 'No mail server is set (SMTP_URL), so the test was written to the server log instead. The bell works without it.',
  'test-suppressed': 'Your address is not on this server’s mail allowlist (SUPPORT_MAIL_ALLOWLIST), so the test was not sent.',
}

/* Who is told what (09-portal-guide.md §4g): one row per notification, grouped as the catalogue groups them, each with the
   audiences it may go to and how it is delivered. The rules themselves are the SLA targets and the KPI targets on the KPI
   settings page; this page only says who hears. */
export default async function NotificationSettingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  await requireManager()
  const s = await getSettings()
  const mail = mailState()
  const managers = s.notify.managers.length ? s.notify.managers : s.managers
  return (
    <>
      <WorkspaceBar active="manage" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Manager view · settings{s.updatedAt ? ` · saved ${dmyHm(s.updatedAt)}` : ' · defaults'}</span>}
          title="Notifications"
          lede="Who hears when an SLA clock goes at risk or past its target, when a KPI misses its target, and when something important happens on a case. The targets and shifts on the KPI settings page are the rules; this page says who is told and how."
          actions={
            <Link className="btn btn-line btn-sm" href={`${MANAGE}/kpis#targets`}>
              Targets and shifts →
            </Link>
          }
        />
        <ManageNav active="notifications" period={s.defaultPeriod} />
        {sp.ok && OK[sp.ok] && <Flash>{OK[sp.ok]}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="sweep-box">
          <p>
            Every notification lands on the bell of each person it names. Email: {mail.configured ? <strong>the mail server is set</strong> : <strong>no mail server yet (SMTP_URL)</strong>}
            {mail.configured ? '; email goes as each row says.' : '; the bell works, emails wait until SMTP_URL is set and each row records why none went.'} The watch reads the desk once a minute.
          </p>
          <form action={testNotificationAction}>
            <button className="btn btn-line btn-sm" type="submit">
              Send me a test
            </button>
          </form>
        </div>

        <form action={saveNotificationsAction} className="form-sheet" style={{ maxWidth: 'none' }}>
          <section className="settings-section" id="general">
            <h2>Who and when</h2>
            <label className="check" style={{ marginBottom: 16 }}>
              <input type="checkbox" name="enabled" value="1" defaultChecked={s.notify.enabled} /> Notifications on
            </label>
            <div className="two-col">
              <div className="field">
                <label className="label" htmlFor="ntf-managers">
                  Managers, one work email per line
                </label>
                <span className="control">
                  <textarea id="ntf-managers" name="managers" rows={5} defaultValue={managers.join('\n')} />
                </span>
                <span className="hint">An agent&apos;s address gets the bell and the email; any other address the email only.{s.notify.managers.length ? '' : ' Empty until saved: the list of managers on the KPI settings page is used.'}</span>
              </div>
              <div className="settings-grid">
                <div className="field">
                  <label className="label" htmlFor="ntf-period">
                    KPI notifications measure
                  </label>
                  <span className="control is-select">
                    <select id="ntf-period" name="kpiPeriod" defaultValue={s.notify.kpiPeriod}>
                      <Options items={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
                    </select>
                  </span>
                </div>
                <div className="field">
                  <label className="label" htmlFor="ntf-keep">
                    Keep read notifications (days)
                  </label>
                  <span className="control">
                    <input id="ntf-keep" name="retentionDays" type="number" min={1} max={365} defaultValue={s.notify.retentionDays} />
                  </span>
                </div>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              <em>Engineers on shift</em> are the members of the shifts working at the time (or opening next), set with the shifts. A case in a bin has no owner: what would go to its owner goes to the engineers on shift.
            </p>
          </section>

          {GROUPS.map((g) => (
            <section className="settings-section" id={g} key={g}>
              <h2>{GROUP_LABEL[g]}</h2>
              {g === 'sla' && <p>Each clock against its target in working minutes (KPI settings, Targets). At risk from {s.warnAtPercent}% of the target used. Each run of a clock is told once per state.</p>}
              {g === 'kpi' && <p>At the end of a shift, against the KPI cards&apos; targets over the period above. Nothing is sent when every figure is on target.</p>}
              <div className="rules ntf-rules">
                {NOTIFY_DEFS.filter((d) => d.group === g).map((d) => {
                  const r = ruleFor(s.notify, d.key)
                  return (
                    <div className="rule" key={d.key}>
                      <div>
                        <h3>{d.label}</h3>
                        <p>{d.what}</p>
                        <span className="label muted">{d.key}</span>
                      </div>
                      <div className="rule-fields">
                        <div className="field">
                          <span className="label">Tell</span>
                          {d.allowed.length === 1 ? (
                            <span className="ntf-fixed">{AUDIENCE_LABEL[d.allowed[0]!]}</span>
                          ) : (
                            <span className="ntf-aud">
                              {d.allowed.map((a) => (
                                <label className="check" key={a}>
                                  <input type="checkbox" name={`r_${d.key}_aud`} value={a} defaultChecked={r.audiences.includes(a)} /> {AUDIENCE_LABEL[a]}
                                </label>
                              ))}
                            </span>
                          )}
                        </div>
                        <div className="field">
                          <label className="label" htmlFor={`dl-${d.key}`}>
                            How
                          </label>
                          <span className="control is-select">
                            <select id={`dl-${d.key}`} name={`r_${d.key}_delivery`} defaultValue={r.delivery}>
                              {DELIVERIES.map((x) => (
                                <option value={x} key={x}>
                                  {DELIVERY_LABEL[x]}
                                </option>
                              ))}
                            </select>
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}

          <div className="form-actions">
            <button className="btn btn-primary" type="submit">
              Save notifications →
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
