import 'server-only'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import type { DataverseAuth } from '@/lib/dataverse'

import { addCaseToQueue } from './cases'
import { getSettings } from './kpi-config'
import { ACTION_LABEL, ruleDef, type RuleAction, type RuleKey, type RuleSetting, type Settings } from './kpi-model'
import { sendMail } from './mail'
import { atRiskBoard, loadDesk, type CaseLite, type Desk } from './metrics'
import { getAgents } from './reference'
import { fmtLeft, fmtMinutes } from './sla'
import { addNote } from './timeline'

/* The proactive workflow (09-portal-guide.md §4c): rules read the live desk and say what should happen before a case breaches.
   The at-risk board shows the verdicts at once; the sweep (cron, or a manager's "run now") applies them: a dry run only records,
   a live run writes notes, queues items and sends mail. Every verdict lands in `support-sla-events`, with a cooldown per case and rule.
   Dataverse writes still pass the production guard: the sweep can never change production. */

export type Verdict = { c: CaseLite; rule: RuleKey; label: string; actions: RuleAction[]; reason: string; queueId: string | null; cooldownHours: number }

const minutesSince = (d: Date, now: Date) => (now.getTime() - d.getTime()) / 60_000

/** Pure: which rules fire on which active cases right now. */
export const evaluateRules = (desk: Desk, settings: Settings = desk.settings): Verdict[] => {
  const out: Verdict[] = []
  const rules = settings.rules.filter((r) => r.enabled)
  const push = (c: CaseLite, r: RuleSetting, reason: string) => out.push({ c, rule: r.key, label: ruleDef(r.key).label, actions: r.actions.length ? r.actions : ['flag'], reason, queueId: r.queueId, cooldownHours: r.cooldownHours })
  for (const c of desk.activeCases) {
    const hot = c.resolve.state === 'breached' || c.resolve.state === 'at-risk'
    for (const r of rules) {
      switch (r.key) {
        case 'unowned-at-risk':
          if (hot && c.owner.kind !== 'user') push(c, r, `${fmtLeft(c.resolve)} and owned by ${c.owner.kind === 'none' ? 'nobody' : `${c.owner.name} (${c.owner.kind})`}`)
          break
        case 'nudge-at-risk':
          if (c.resolve.state === 'at-risk' && c.resolve.left <= (r.thresholdMinutes ?? 60)) push(c, r, `${fmtLeft(c.resolve)} of a ${fmtMinutes(c.resolve.target)} target`)
          break
        case 'escalate-breach':
          if (c.resolve.state === 'breached') push(c, r, `${fmtLeft(c.resolve)}; target ${fmtMinutes(c.resolve.target)}`)
          break
        case 'stale':
          if (!c.waiting && c.resolve.state !== 'paused' && minutesSince(c.modifiedon, desk.now) >= (r.thresholdMinutes ?? 480)) push(c, r, `no change for ${fmtMinutes(minutesSince(c.modifiedon, desk.now))}`)
          break
        case 'waiting-followup':
          if (c.waiting && minutesSince(c.modifiedon, desk.now) >= (r.thresholdMinutes ?? 2880)) push(c, r, `waiting on the customer for ${fmtMinutes(minutesSince(c.modifiedon, desk.now))}`)
          break
      }
    }
  }
  return out
}

/** Verdicts grouped per case, for the board. */
export const verdictsByCase = (vs: Verdict[]): Map<string, Verdict[]> => {
  const m = new Map<string, Verdict[]>()
  for (const v of vs) m.set(v.c.id, [...(m.get(v.c.id) ?? []), v])
  return m
}

/* ---------- Events ---------- */

export type SlaEvent = { id: string; caseId: string; ticket: string; rule: string; mode: 'dry-run' | 'live'; actions: string; outcome: 'planned' | 'done' | 'failed' | 'skipped'; detail: string; runId: string; actor: string; createdAt: string }

const db = () => getPayload({ config: configPromise })

export const recentEvents = async (o: { limit?: number; caseId?: string; runId?: string } = {}): Promise<SlaEvent[]> => {
  try {
    const payload = await db()
    const where: Where = {}
    if (o.caseId) where.caseId = { equals: o.caseId }
    if (o.runId) where.runId = { equals: o.runId }
    const r = await payload.find({ collection: 'support-sla-events', where, sort: '-createdAt', limit: o.limit ?? 50, depth: 0, overrideAccess: true })
    return r.docs.map((d) => ({ id: String(d.id), caseId: d.caseId, ticket: d.ticket, rule: d.rule, mode: d.mode, actions: d.actions, outcome: d.outcome, detail: d.detail ?? '', runId: d.runId ?? '', actor: d.actor ?? '', createdAt: d.createdAt }))
  } catch (e) {
    console.error(`[sla events] read failed: ${(e as Error).message}`)
    return []
  }
}

/** The last time each (case, rule) acted, for cooldowns: one query over the recent window. */
const lastActed = async (sinceHours: number): Promise<Map<string, Date>> => {
  const m = new Map<string, Date>()
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'support-sla-events', where: { createdAt: { greater_than: new Date(Date.now() - sinceHours * 3600_000).toISOString() }, outcome: { in: ['done', 'planned'] } }, sort: '-createdAt', limit: 2000, depth: 0, overrideAccess: true })
    for (const d of r.docs) {
      const k = `${d.caseId}:${d.rule}`
      if (!m.has(k)) m.set(k, new Date(d.createdAt))
    }
  } catch (e) {
    console.error(`[sla events] cooldown read failed: ${(e as Error).message}`)
  }
  return m
}

const record = async (e: Omit<SlaEvent, 'id' | 'createdAt'>): Promise<void> => {
  try {
    const payload = await db()
    await payload.create({ collection: 'support-sla-events', data: e, overrideAccess: true })
  } catch (err) {
    console.error(`[sla events] write failed: ${(err as Error).message}`)
  }
}

/* ---------- The sweep ---------- */

export type SweepResult = { runId: string; mode: 'dry-run' | 'live'; evaluated: number; fired: number; skipped: number; done: number; failed: number; at: Date; warnings: string[] }

const caseUrl = (id: string) => `${(process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '')}/support/workspace/cases/${id}`

/** Runs every enabled rule once. `live` applies the actions when the settings allow it; otherwise the run is recorded as planned. */
export const runSweep = async (auth: DataverseAuth, o: { actor: string; live?: boolean; period?: 'today' }): Promise<SweepResult> => {
  const settings = await getSettings()
  const desk = await loadDesk(auth, settings, '7d')
  const live = Boolean(o.live) && settings.sweep.live
  const mode: 'dry-run' | 'live' = live ? 'live' : 'dry-run'
  const runId = `${desk.now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`
  const verdicts = evaluateRules(desk, settings)
  const maxCooldown = Math.max(1, ...settings.rules.map((r) => r.cooldownHours))
  const acted = await lastActed(maxCooldown)
  const agents = live ? await getAgents(auth).catch(() => []) : []
  const result: SweepResult = { runId, mode, evaluated: desk.activeCases.length, fired: verdicts.length, skipped: 0, done: 0, failed: 0, at: desk.now, warnings: [...desk.warnings] }
  for (const v of verdicts) {
    const last = acted.get(`${v.c.id}:${v.rule}`)
    if (last && desk.now.getTime() - last.getTime() < v.cooldownHours * 3600_000) {
      result.skipped++
      continue
    }
    const actions = v.actions.map((a) => ACTION_LABEL[a]).join(', ')
    if (!live) {
      await record({ caseId: v.c.id, ticket: v.c.ticket, rule: v.rule, mode, actions, outcome: 'planned', detail: v.reason, runId, actor: o.actor })
      result.done++
      continue
    }
    const notes: string[] = []
    let failed = false
    for (const a of v.actions) {
      try {
        if (a === 'note') {
          await addNote(auth, v.c.id, { subject: `SLA watch: ${v.label}`, text: `${v.reason}. Target ${fmtMinutes(v.c.resolve.target)}; ${fmtLeft(v.c.resolve)}. Posted by the support portal's prevention sweep.` })
          notes.push('note added')
        } else if (a === 'queue') {
          if (!v.queueId) throw new Error('no queue configured')
          await addCaseToQueue(auth, v.c.id, v.queueId)
          notes.push('queued')
        } else if (a === 'email-owner') {
          const email = agents.find((x) => x.id === v.c.owner.id)?.email
          if (!email) throw new Error('owner has no email')
          const r = await sendMail({ to: email, subject: `[SLA] ${v.c.ticket}: ${v.label}`, text: `${v.c.ticket} "${v.c.title}"\n${v.reason}.\nTarget ${fmtMinutes(v.c.resolve.target)}; ${fmtLeft(v.c.resolve)}.\n\n${caseUrl(v.c.id)}` })
          notes.push(r.sent ? 'owner emailed' : 'owner email logged (no SMTP)')
        } else if (a === 'email-managers') {
          if (!settings.sweep.managerEmails.length) throw new Error('no manager emails configured')
          const r = await sendMail({ to: settings.sweep.managerEmails.join(', '), subject: `[SLA] ${v.c.ticket}: ${v.label}`, text: `${v.c.ticket} "${v.c.title}" owned by ${v.c.owner.name}\n${v.reason}.\nTarget ${fmtMinutes(v.c.resolve.target)}; ${fmtLeft(v.c.resolve)}.\n\n${caseUrl(v.c.id)}` })
          notes.push(r.sent ? 'managers emailed' : 'manager email logged (no SMTP)')
        } else notes.push('flagged')
      } catch (e) {
        failed = true
        notes.push(`${a} failed: ${(e as Error).message.slice(0, 120)}`)
      }
    }
    await record({ caseId: v.c.id, ticket: v.c.ticket, rule: v.rule, mode, actions, outcome: failed ? 'failed' : 'done', detail: `${v.reason}. ${notes.join('; ')}`, runId, actor: o.actor })
    if (failed) result.failed++
    else result.done++
  }
  return result
}

export { atRiskBoard }
