import type { Metadata } from 'next'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { Flash } from '@/components/partner/Parts'
import { Counter } from '@/components/partner/Reports'
import { jobLines, readiness, recentJobRuns } from '@/lib/partner/ops'
import { cadenceText, CHECK_LEVEL_LABEL, DRAFT_RETENTION_DAYS, JOB_RUN_RETENTION_DAYS, JOB_STANDING_LABEL, jobSpec, overallLevel, type CheckLevel, type JobStanding } from '@/lib/partner/ops-model'
import { requireK7Role } from '@/lib/partner/session'
import { dmyHm } from '@/lib/support/format'

import { runHousekeepingAction } from './actions'

export const metadata: Metadata = { title: 'Operations' }

const PATH = '/partners/portal/k7/operations'
type SP = { ok?: string; error?: string }

const levelTag = (level: CheckLevel) => <span className={level === 'fail' ? 'tag tag-signal' : level === 'warn' ? 'tag tag-state' : 'tag tag-quiet'}>{CHECK_LEVEL_LABEL[level]}</span>
const standingTag = (state: JobStanding) => <span className={state === 'overdue' || state === 'failed' ? 'tag tag-signal' : state === 'never' ? 'tag tag-state' : 'tag tag-quiet'}>{JOB_STANDING_LABEL[state]}</span>

/* Operations (M9, docs/partner-portal/05-staging-and-go-live.md): is this host ready, and is the scheduler firing. The
   readiness ledger reads the environment, the settings and the upload directories; the jobs ledger reads the newest run of
   each scheduled job. Nothing here changes anything but housekeeping, by the one button. */
export default async function K7OperationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireK7Role(['channelManager'], PATH)
  const [checks, jobs, recent] = await Promise.all([readiness(), jobLines(), recentJobRuns(20)])
  const overall = overallLevel(checks)
  const fails = checks.filter((c) => c.level === 'fail').length
  const warns = checks.filter((c) => c.level === 'warn').length
  const silent = jobs.filter((j) => j.state !== 'ok').length
  return (
    <>
      <K7Nav active="operations" roles={me.roles} counts={{ operations: fails + silent || undefined }} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">Partner desk · operations</span>
            <h1 className="h-util">{overall === 'fail' ? 'Something is not ready.' : overall === 'warn' ? 'Ready, with notes.' : 'Ready.'}</h1>
            <p className="lede">Whether this host is set up to run the portal and whether the scheduler is calling the jobs. The checks read the environment, the settings and the upload directories; the jobs ledger reads each job’s newest run. A monitor asks the same question at /api/partners/health.</p>
          </div>
          <form action={runHousekeepingAction} className="ws-actions">
            <button className="btn btn-line btn-sm" type="submit" title={`Remove join drafts untouched for ${DRAFT_RETENTION_DAYS} days and job runs older than ${JOB_RUN_RETENTION_DAYS} days`}>
              Run housekeeping
            </button>
          </form>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis rep-cards">
          <Counter label="checks failing" n={String(fails).padStart(2, '0')} hot={fails > 0} />
          <Counter label="notes" n={String(warns).padStart(2, '0')} />
          <Counter label="jobs silent or failed" n={String(silent).padStart(2, '0')} hot={silent > 0} />
          <Counter label="scheduled jobs" n={String(jobs.length).padStart(2, '0')} />
        </div>

        <div className="rep-stack">
          <div className="filed ledger rep">
            <span className="tab label">
              Readiness <span className="n">{String(checks.length).padStart(2, '0')}</span>
            </span>
            <div className="table-wrap">
              <table className="dtable rep-table ops-table">
                <thead>
                  <tr>
                    <th scope="col">Check</th>
                    <th scope="col">Standing</th>
                    <th scope="col">What it found</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c) => (
                    <tr className={`row${c.level === 'fail' ? ' is-breached' : ''}`} key={c.key}>
                      <td className="title">{c.label}</td>
                      <td className="status">{levelTag(c.level)}</td>
                      <td className="text">{c.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ledger-foot">
              <span className="label">Fails stop the portal or a feature; notes are right for one environment and wrong for another. The go-live gate is in docs/partner-portal/05-staging-and-go-live.md.</span>
            </div>
          </div>

          <div className="filed ledger rep">
            <span className="tab label">
              Scheduled jobs <span className="n">{String(jobs.length).padStart(2, '0')}</span>
            </span>
            <div className="table-wrap">
              <table className="dtable rep-table ops-table">
                <thead>
                  <tr>
                    <th scope="col">Job</th>
                    <th scope="col">Every</th>
                    <th scope="col">Last run</th>
                    <th scope="col">Standing</th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr className={`row${j.state === 'overdue' || j.state === 'failed' ? ' is-breached' : ''}`} key={j.key}>
                      <td className="title">
                        {j.label}
                        <div className="muted">
                          POST {j.route}
                        </div>
                      </td>
                      <td className="num">{cadenceText(j.cadenceMinutes)}</td>
                      <td className="num">{j.last ? `${dmyHm(j.last.at)}${j.last.trigger === 'manual' ? ' · by hand' : ''}` : '—'}</td>
                      <td className="status">{standingTag(j.state)}</td>
                      <td className="text">{j.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ledger-foot">
              <span className="label">Each route takes POST with Authorization: Bearer CRON_SECRET; a job is overdue after twice its cadence (two hours at least). Runs by hand from the desk’s pages are recorded too.</span>
            </div>
          </div>

          <div className="filed ledger rep">
            <span className="tab label">
              Recent runs <span className="n">{String(recent.length).padStart(2, '0')}</span>
            </span>
            {recent.length === 0 ? (
              <p className="hint" style={{ padding: '18px 0 0' }}>
                No run recorded yet. The scheduler’s first call to any route writes the first row.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="dtable rep-table ops-table">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Job</th>
                      <th scope="col">By</th>
                      <th scope="col">Took</th>
                      <th scope="col">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr className={`row${r.ok ? '' : ' is-breached'}`} key={r.id}>
                        <td className="num">{dmyHm(r.at)}</td>
                        <td className="title">{jobSpec(r.job)?.label ?? r.job}</td>
                        <td className="text">{r.trigger === 'manual' ? r.actor || 'by hand' : 'scheduler'}</td>
                        <td className="num">{r.durationMs >= 1000 ? `${(r.durationMs / 1000).toFixed(1)} s` : `${r.durationMs} ms`}</td>
                        <td className="text">{r.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="ledger-foot">
              <span className="label">Rows are kept for {JOB_RUN_RETENTION_DAYS} days; housekeeping removes the older ones.</span>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
