import 'server-only'
import configPromise from '@payload-config'
import { accessSync, constants, existsSync } from 'fs'
import { getPayload } from 'payload'

import { COLLATERAL_DIR } from '@/collections/partner/PartnerCollateralFiles'
import { cronSecretUsable } from '@/lib/cron-auth'
import { serviceConfigured } from '@/lib/dataverse/auth'
import { mailAllowlist, mailConfigured } from '@/lib/support/mail'

import type { Actor } from './audit'
import { DEAL_FILE_DIR } from './deal-files'
import { DRAFT_RETENTION_DAYS, JOB_RUN_RETENTION_DAYS, JOBS, jobStanding, readinessChecks, summariseResult, type Check, type DirCheck, type JobKey, type JobRun, type JobStanding } from './ops-model'
import { SCHEME_FILE_DIR } from './schemes'
import { getPartnerSettings } from './settings'
import { isDeployed } from '@/lib/env'

/* Operations (M9, docs/partner-portal/05-staging-and-go-live.md): every scheduled job records its run so the Operations page
   can say whether the scheduler fires; the readiness checks read the environment, the settings and the upload directories;
   the health route answers a monitor with nothing but ok or not; housekeeping removes what nobody needs any more. */

type Doc = Record<string, unknown>
const db = () => getPayload({ config: configPromise })
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

const toRun = (x: Doc): JobRun => ({ id: s(x.id), job: x.job as JobKey, trigger: x.trigger === 'manual' ? 'manual' : 'cron', ok: x.ok !== false, at: s(x.createdAt), durationMs: typeof x.durationMs === 'number' ? x.durationMs : 0, summary: s(x.summary), actor: s(x.actor) })

/** Runs a job and records the run, whatever happens; the error is rethrown after the row is written. */
export const recordJobRun = async <T>(job: JobKey, fn: () => Promise<T>, o: { trigger?: 'cron' | 'manual'; actor?: Actor } = {}): Promise<T> => {
  const started = Date.now()
  const write = async (ok: boolean, summary: string, detail: unknown) => {
    try {
      const payload = await db()
      await payload.create({ collection: 'partner-job-runs', overrideAccess: true, depth: 0, data: { job, trigger: o.trigger ?? 'cron', ok, durationMs: Date.now() - started, actor: o.actor ? o.actor.email || o.actor.name : '', summary: summary.slice(0, 400), detail: trim(detail) } as never })
    } catch (e) {
      console.error(`[partner ops] could not record the ${job} run: ${(e as Error).message}`)
    }
  }
  try {
    const result = await fn()
    await write(true, summariseResult(job, result), result)
    return result
  } catch (e) {
    await write(false, `failed: ${(e as Error).message.slice(0, 300)}`, { error: (e as Error).message })
    throw e
  }
}

/** The result as stored: arrays cut to twenty lines so a run over thousands of rows stays a small row. */
const trim = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.slice(0, 20)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Doc).map(([k, x]) => [k, Array.isArray(x) ? x.slice(0, 20) : x]))
  return v ?? null
}

/** The newest run of every job, null where none is recorded. */
export const lastJobRuns = async (): Promise<Record<JobKey, JobRun | null>> => {
  const payload = await db()
  const rows = await Promise.all(JOBS.map((j) => payload.find({ collection: 'partner-job-runs', where: { job: { equals: j.key } }, sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true })))
  return Object.fromEntries(JOBS.map((j, i) => [j.key, rows[i]!.docs[0] ? toRun(rows[i]!.docs[0] as unknown as Doc) : null])) as Record<JobKey, JobRun | null>
}

export const recentJobRuns = async (limit = 30): Promise<JobRun[]> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-job-runs', sort: '-createdAt', limit, depth: 0, overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toRun)
}

export type JobLine = { key: JobKey; label: string; route: string; cadenceMinutes: number; what: string; last: JobRun | null; state: JobStanding; note: string }

export const jobLines = async (now = new Date()): Promise<JobLine[]> => {
  const last = await lastJobRuns()
  return JOBS.map((j) => ({ ...j, last: last[j.key], ...jobStanding(j, last[j.key], now) }))
}

const dirCheck = (label: string, path: string): DirCheck => {
  const exists = existsSync(path)
  let writable = false
  if (exists) {
    try {
      accessSync(path, constants.W_OK)
      writable = true
    } catch {
      writable = false
    }
  }
  return { label, path, exists, writable }
}

export const uploadDirs = (): DirCheck[] => [dirCheck('collateral', COLLATERAL_DIR), dirCheck('deal files', DEAL_FILE_DIR), dirCheck('scheme files', SCHEME_FILE_DIR)]

/** The readiness checks over the live environment and settings. */
export const readiness = async (): Promise<Check[]> => {
  const settings = await getPartnerSettings()
  const env = process.env
  return readinessChecks({
    production: isDeployed(env),
    portalEnabled: env.PARTNER_PORTAL_ENABLED === '1' || (!isDeployed(env) && env.PARTNER_PORTAL_ENABLED !== '0'),
    authSecretLength: (env.AUTH_SECRET ?? '').length,
    cronSecretUsable: cronSecretUsable(),
    databaseUrl: Boolean(env.DATABASE_URL),
    smtp: mailConfigured(),
    allowlist: Boolean(mailAllowlist()),
    showCode: env.SUPPORT_DEV_SHOW_CODE === '1',
    devAgentDoor: env.SUPPORT_DEV_AGENT === 'probe',
    devServiceProbe: env.SUPPORT_DEV_SERVICE === 'probe' || env.SUPPORT_DEV_AGENT === 'probe',
    dataverseUrl: env.DATAVERSE_URL ?? '',
    serviceConfigured: serviceConfigured(),
    writesEnabled: env.DATAVERSE_WRITES_ENABLED === '1',
    crm: { enabled: settings.crm.enabled, features: settings.crm.features },
    devStaffPass: settings.devStaffPass,
    testerStaffPass: settings.testerStaffPass,
    dirs: uploadDirs(),
  })
}

export type Health = { ok: boolean; failing: string[] }

/** For a monitor: the database answers and no check fails. Says which checks fail by key and nothing else. */
export const health = async (): Promise<Health> => {
  const failing: string[] = []
  try {
    const payload = await db()
    await payload.count({ collection: 'partner-counters', overrideAccess: true })
  } catch {
    failing.push('database')
  }
  try {
    for (const c of await readiness()) if (c.level === 'fail' && !failing.includes(c.key)) failing.push(c.key)
  } catch {
    failing.push('readiness')
  }
  return { ok: failing.length === 0, failing }
}

export type HousekeepingResult = { drafts: number; jobRuns: number; errors: string[] }

/** Removes join drafts untouched for DRAFT_RETENTION_DAYS (never submitted: no number) and job-run rows past their retention. */
export const housekeeping = async (now = new Date()): Promise<HousekeepingResult> => {
  const r: HousekeepingResult = { drafts: 0, jobRuns: 0, errors: [] }
  const payload = await db()
  const draftBefore = new Date(now.getTime() - DRAFT_RETENTION_DAYS * 86_400_000).toISOString()
  try {
    const del = await payload.delete({ collection: 'partner-applications', where: { and: [{ status: { equals: 'draft' } }, { updatedAt: { less_than: draftBefore } }, { or: [{ number: { exists: false } }, { number: { equals: '' } }] }] }, overrideAccess: true })
    r.drafts = del.docs.length
  } catch (e) {
    r.errors.push(`drafts: ${(e as Error).message.slice(0, 160)}`)
  }
  const runsBefore = new Date(now.getTime() - JOB_RUN_RETENTION_DAYS * 86_400_000).toISOString()
  try {
    const del = await payload.delete({ collection: 'partner-job-runs', where: { createdAt: { less_than: runsBefore } }, overrideAccess: true })
    r.jobRuns = del.docs.length
  } catch (e) {
    r.errors.push(`job runs: ${(e as Error).message.slice(0, 160)}`)
  }
  return r
}
