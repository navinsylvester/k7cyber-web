import type { CrmFeatures } from './settings-model'

/* The partner portal's operations, pure (M9, docs/partner-portal/05-staging-and-go-live.md): the catalogue of scheduled
   jobs with their cadence, the standing of a job from its last run, the readiness checks over a plain picture of the
   environment, and the two retention periods housekeeping applies. The server side (ops.ts) gathers the picture and records
   the runs; this file is tested without a tenant. */

export type JobKey = 'outbox' | 'sync' | 'dealsSweep' | 'digest' | 'slaSweep' | 'schemesRun' | 'certificatesSweep' | 'housekeeping'
export type JobSpec = { key: JobKey; label: string; route: string; /** How often the scheduler should call it. */ cadenceMinutes: number; what: string }

export const JOBS: JobSpec[] = [
  { key: 'outbox', label: 'CRM outbox drain', route: '/api/partners/outbox', cadenceMinutes: 15, what: 'Runs the pending, failed and skipped CRM jobs as the service identity, when the mirror and the job’s feature are on.' },
  { key: 'sync', label: 'CRM read-back', route: '/api/partners/sync', cadenceMinutes: 60, what: 'Reads the portal’s own opportunities back for the dashboards; runs at most every crm.syncMinutes unless forced.' },
  { key: 'dealsSweep', label: 'Deal sweep', route: '/api/partners/deals/sweep', cadenceMinutes: 24 * 60, what: 'Expires approved deals past their protection end; tells the partner once when the end is near.' },
  { key: 'slaSweep', label: 'Approval SLA pass', route: '/api/partners/sla/sweep', cadenceMinutes: 60, what: 'One breach notice per deal or application past the target, to the queue’s role, the managers and the escalation addresses.' },
  { key: 'digest', label: 'Daily digest', route: '/api/partners/notifications/digest', cadenceMinutes: 24 * 60, what: 'Mails the bell rows whose template says digest, one email per person; removes read rows past the retention.' },
  { key: 'schemesRun', label: 'Scheme eligibility', route: '/api/partners/schemes/run', cadenceMinutes: 24 * 60, what: 'Computes the results of every published scheme that has closed and has none yet.' },
  { key: 'certificatesSweep', label: 'Certificate sweep', route: '/api/partners/certificates/sweep', cadenceMinutes: 24 * 60, what: 'Expires certificates past their date, sends the 60- and 30-day reminders once each, keeps the organisations’ certificate mirror true, and raises the renewal request when an expired organisation still meets the rule.' },
  { key: 'housekeeping', label: 'Housekeeping', route: '/api/partners/housekeeping', cadenceMinutes: 24 * 60, what: 'Removes abandoned join drafts and old job-run rows.' },
]
export const jobSpec = (key: JobKey): JobSpec => JOBS.find((j) => j.key === key)!

export type JobRun = { id: string; job: JobKey; trigger: 'cron' | 'manual'; ok: boolean; at: string; durationMs: number; summary: string; actor: string }

export type JobStanding = 'never' | 'ok' | 'failed' | 'overdue'
export const JOB_STANDING_LABEL: Record<JobStanding, string> = { never: 'Never run', ok: 'Running', failed: 'Last run failed', overdue: 'Overdue' }

/** How long after the cadence a job may be silent before it counts as overdue: twice the cadence, at least two hours, so a
    scheduler that fires a little late or a host that restarted is not a false alarm. */
export const overdueAfterMinutes = (spec: JobSpec): number => Math.max(2 * spec.cadenceMinutes, 120)

export const jobStanding = (spec: JobSpec, last: JobRun | null, now: Date = new Date()): { state: JobStanding; note: string } => {
  if (!last) return { state: 'never', note: `No run recorded. The scheduler should call ${spec.route} every ${cadenceText(spec.cadenceMinutes)}.` }
  const ageMin = (now.getTime() - new Date(last.at).getTime()) / 60_000
  if (ageMin > overdueAfterMinutes(spec)) return { state: 'overdue', note: `Last run ${ageText(ageMin)} ago; expected every ${cadenceText(spec.cadenceMinutes)}.` }
  if (!last.ok) return { state: 'failed', note: last.summary || 'The last run threw.' }
  return { state: 'ok', note: `Last run ${ageText(ageMin)} ago${last.summary ? `: ${last.summary}` : ''}` }
}

export const cadenceText = (minutes: number): string => (minutes % (24 * 60) === 0 ? `${minutes / (24 * 60)} day${minutes === 24 * 60 ? '' : 's'}` : minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}` : `${minutes} min`)
export const ageText = (minutes: number): string => {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} min`
  if (m < 48 * 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
  return `${Math.floor(m / (24 * 60))} d`
}

/** One line for the job-run row from what the job returned, so the Operations page reads without opening the detail. */
export const summariseResult = (job: JobKey, r: unknown): string => {
  const x = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
  const n = (k: string): number => (typeof x[k] === 'number' ? (x[k] as number) : Array.isArray(x[k]) ? (x[k] as unknown[]).length : 0)
  switch (job) {
    case 'outbox':
      return x.lines && Array.isArray(x.lines) && n('ran') === 0 && x.lines.length ? String(x.lines[0]).slice(0, 160) : `${n('ran')} ran · ${n('done')} done · ${n('failed')} failed · ${n('skipped')} skipped · ${n('pending')} waiting`
    case 'sync':
      return x.skipped ? `skipped: ${String(x.skipped).slice(0, 140)}` : `${n('scanned')} deals · ${n('fetched')} read · ${n('changed')} changed · ${n('missing')} missing · ${n('errors')} errors`
    case 'dealsSweep':
      return `${n('expired')} expired · ${n('noticed')} told of the end${n('errors') ? ` · ${n('errors')} errors` : ''}`
    case 'slaSweep':
      return `${n('checked')} on the clock · ${n('breached')} past the target · ${n('noticed')} notices${n('errors') ? ` · ${n('errors')} errors` : ''}`
    case 'certificatesSweep':
      return `${n('checked')} checked · ${n('expired')} expired · ${n('reminded')} reminded · ${n('requested')} renewal requests${n('errors') ? ` · ${n('errors')} errors` : ''}`
    case 'digest':
      return `${n('mails')} emails · ${n('rows')} rows · ${n('removed')} read rows removed${n('errors') ? ` · ${n('errors')} errors` : ''}`
    case 'schemesRun':
      return `${n('schemes')} schemes computed${n('errors') ? ` · ${n('errors')} errors` : ''}`
    case 'housekeeping':
      return `${n('drafts')} drafts removed · ${n('jobRuns')} old job runs removed${n('errors') ? ` · ${n('errors')} errors` : ''}`
  }
}

/* ---------- Readiness ---------- */

export type CheckLevel = 'ok' | 'warn' | 'fail'
export type Check = { key: string; label: string; level: CheckLevel; note: string }
export const CHECK_LEVEL_LABEL: Record<CheckLevel, string> = { ok: 'OK', warn: 'Note', fail: 'Fails' }

export type DirCheck = { label: string; path: string; exists: boolean; writable: boolean }

/** The environment as the checks read it, gathered by ops.ts from process.env, the settings and the file system. */
export type ReadinessEnv = {
  production: boolean
  portalEnabled: boolean
  authSecretLength: number
  cronSecretUsable: boolean
  databaseUrl: boolean
  smtp: boolean
  allowlist: boolean
  showCode: boolean
  devAgentDoor: boolean
  devServiceProbe: boolean
  dataverseUrl: string
  serviceConfigured: boolean
  writesEnabled: boolean
  crm: { enabled: boolean; features: CrmFeatures }
  devStaffPass: boolean
  dirs: DirCheck[]
}

export const PRODUCTION_DATAVERSE_HOST = 'k7crm.crm8.dynamics.com'

export const readinessChecks = (e: ReadinessEnv): Check[] => {
  const out: Check[] = []
  const add = (key: string, label: string, level: CheckLevel, note: string) => out.push({ key, label, level, note })

  add('portal', 'Portal switch', e.production && !e.portalEnabled ? 'fail' : 'ok', e.production ? (e.portalEnabled ? 'PARTNER_PORTAL_ENABLED=1: the portal answers.' : 'PARTNER_PORTAL_ENABLED is not 1: every /partners/portal page is a 404 in production.') : 'Development: on unless PARTNER_PORTAL_ENABLED=0.')
  add('authSecret', 'Session secret', e.authSecretLength >= 32 ? 'ok' : 'fail', e.authSecretLength >= 32 ? 'AUTH_SECRET is set and long enough.' : e.authSecretLength ? `AUTH_SECRET has ${e.authSecretLength} characters; 32 or more are needed.` : 'AUTH_SECRET is not set: no session or one-time code can be signed.')
  add('cronSecret', 'Scheduler secret', e.cronSecretUsable ? 'ok' : 'fail', e.cronSecretUsable ? 'CRON_SECRET is set and long enough; the scheduled routes answer to it.' : 'CRON_SECRET is unset or shorter than 16 characters: every scheduled route refuses, so nothing runs.')
  add('database', 'Database', e.databaseUrl ? 'ok' : 'fail', e.databaseUrl ? 'DATABASE_URL is set.' : 'DATABASE_URL is not set.')
  add('smtp', 'Mail', e.smtp ? 'ok' : e.production ? 'fail' : 'warn', e.smtp ? 'SMTP_URL is set: codes and notifications leave by mail.' : e.production ? 'No SMTP_URL: no code and no notification can leave, so nobody can sign in.' : 'No SMTP_URL: mail goes to the console; codes show on screen only on localhost or with the allowlist set.')
  if (e.allowlist) add('allowlist', 'Mail allowlist', 'warn', 'SUPPORT_MAIL_ALLOWLIST is set: mail and codes go only to the listed addresses and domains. Right for a shared test host; remove it for launch.')
  else add('allowlist', 'Mail allowlist', e.production || !e.showCode ? 'ok' : 'warn', e.production ? 'No allowlist: every address may be mailed.' : e.showCode ? 'SUPPORT_DEV_SHOW_CODE=1 without an allowlist: the on-screen code appears on localhost only.' : 'No allowlist; development.')
  const devDoors = e.devAgentDoor || e.devServiceProbe
  add('devDoors', 'Development doors', devDoors ? (e.production ? 'fail' : 'warn') : 'ok', devDoors ? (e.production ? 'SUPPORT_DEV_AGENT or SUPPORT_DEV_SERVICE is set in production: the probe door must be off on any host other people can reach.' : `Development: ${[e.devAgentDoor ? 'the probe door is open' : '', e.devServiceProbe ? 'the probe token stands in for the service identity' : ''].filter(Boolean).join('; ')}. Off on shared hosts.`) : 'The probe door is off.')
  add('showCode', 'Codes on screen', e.showCode && e.production ? 'fail' : 'ok', e.showCode ? (e.production ? 'SUPPORT_DEV_SHOW_CODE=1 in production: the code never shows there in code, but the flag should be off.' : 'SUPPORT_DEV_SHOW_CODE=1: development only, localhost or the allowlist.') : 'Off.')

  const host = (() => {
    try {
      return e.dataverseUrl ? new URL(e.dataverseUrl).host.toLowerCase() : ''
    } catch {
      return ''
    }
  })()
  if (!host) add('dataverse', 'Dynamics host', e.crm.enabled ? 'fail' : 'warn', e.crm.enabled ? 'DATAVERSE_URL is not set while the CRM mirror is on: every job fails.' : 'DATAVERSE_URL is not set; the mirror is off, so nothing needs it yet.')
  else if (host === PRODUCTION_DATAVERSE_HOST) add('dataverse', 'Dynamics host', e.crm.enabled ? 'warn' : 'ok', `Production (${host}): read-only in code. The read-back works; every write job is skipped as "production is read-only" until the go-live gate decides otherwise (07-production-safety.md §7).`)
  else add('dataverse', 'Dynamics host', 'ok', `${host}: writes allowed when DATAVERSE_WRITES_ENABLED=1.`)
  if (e.crm.enabled) {
    add('service', 'CRM service identity', e.serviceConfigured ? 'ok' : e.devServiceProbe && !e.production ? 'warn' : 'fail', e.serviceConfigured ? 'DATAVERSE_CLIENT_ID and DATAVERSE_CLIENT_SECRET are set.' : e.devServiceProbe && !e.production ? 'No service identity; the probe token stands in (development only).' : 'No DATAVERSE_CLIENT_ID / DATAVERSE_CLIENT_SECRET: the jobs and the read-back cannot sign in.')
    add('writes', 'CRM writes flag', e.writesEnabled ? 'ok' : 'warn', e.writesEnabled ? 'DATAVERSE_WRITES_ENABLED=1.' : 'DATAVERSE_WRITES_ENABLED is off: every write job is skipped until it is 1 (the read-back still runs).')
    const on = (Object.keys(e.crm.features) as (keyof CrmFeatures)[]).filter((f) => e.crm.features[f])
    add('features', 'CRM features', 'ok', on.length === 3 ? 'All three features are on.' : on.length ? `On: ${on.join(', ')}. The others wait as pending.` : 'Every feature is off: the mirror is on in name only.')
  } else add('crm', 'CRM mirror', 'ok', 'Off in the partner settings: jobs queue as pending and the read-back does not run. Turn it on, feature by feature, at the gate.')
  if (e.production && e.devStaffPass) add('devStaffPass', 'Development staff pass', 'ok', 'On, but ignored in production (a development sign-in never holds every role there).')
  for (const d of e.dirs) add(`dir:${d.label}`, `Uploads · ${d.label}`, d.exists && d.writable ? 'ok' : d.exists ? 'fail' : 'warn', d.exists ? (d.writable ? `${d.path} exists and is writable.` : `${d.path} exists but is not writable: uploads will fail.`) : `${d.path} does not exist yet; it is created on the first upload, so the parent must be writable and the directory must persist across deploys.`)
  return out
}

export const overallLevel = (checks: Check[]): CheckLevel => (checks.some((c) => c.level === 'fail') ? 'fail' : checks.some((c) => c.level === 'warn') ? 'warn' : 'ok')

/* ---------- Housekeeping ---------- */

/** A join draft nobody touched for this long is removed (it never reached the queue and holds a stranger's address). */
export const DRAFT_RETENTION_DAYS = 30
/** Job-run rows older than this are removed; the trail of what the jobs did is in the audit and the objects themselves. */
export const JOB_RUN_RETENTION_DAYS = 90
