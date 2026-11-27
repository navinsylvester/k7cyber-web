import 'server-only'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import type { DataverseAuth } from '@/lib/dataverse'
import { getServerSideURL } from '@/utilities/getURL'

import { getSettings, type Settings } from './kpi-config'
import { mailConfigured, sendMail } from './mail'
import { digestMail, isEmail, notificationMail, peopleByEmail, resolveAudience, ruleFor, type Delivery, type NotifyKey, type Person } from './notify-model'
import { getAgents } from './reference'
import { shiftsOnOrNext } from './sla'

/* The workspace's notifications (09-portal-guide.md §4g), the support side of the partner portal's spine: one `notify()` that
   the case actions and the watch call. It writes one bell row per person (`support-notifications`) and, by the entry's
   delivery, emails them at once or in the shift-end digest, through SMTP_URL and SUPPORT_MAIL_ALLOWLIST (mail.ts). Without
   SMTP_URL the bell still works and the row says why no email went. Who reads it comes from the entry's audiences
   (notify-model.ts): the case owner, the engineers on shift, the managers. */

export type NotifyInput = {
  key: NotifyKey
  subject: string
  body: string
  /** A workspace path, e.g. /support/workspace/cases/<id>. */
  href: string
  caseId?: string
  ticket?: string
  /** The case owner when an engineer owns it. */
  owner?: Person | null
  /** Who did it: never told about their own action. */
  actorId?: string
  /** One notification per person per key within `dedupeHours`: the same change seen by the portal and by the watch. */
  dedupe?: string
  dedupeHours?: number
  /** Instead of the entry's audiences (the KPI report to each engineer). */
  people?: Person[]
  at?: Date
}

export type NotifyResult = { bell: number; emailed: number; skipped: string | null }

export type Notification = { id: string; at: string; event: string; subject: string; body: string; href: string; ticket: string; readAt: string | null; delivery: Delivery; emailedAt: string | null; emailError: string }

type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const d = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const toRow = (x: Doc): Notification => ({
  id: s(x.id),
  at: s(x.createdAt),
  event: s(x.event),
  subject: s(x.subject),
  body: s(x.body),
  href: s(x.href),
  ticket: s(x.ticket),
  readAt: d(x.readAt),
  delivery: x.delivery === 'digest' || x.delivery === 'bell' ? x.delivery : 'immediate',
  emailedAt: d(x.emailedAt),
  emailError: s(x.emailError),
})

const db = () => getPayload({ config: configPromise })
const absolute = (href: string): string => (href.startsWith('http') ? href : `${getServerSideURL().replace(/\/$/, '')}${href}`)
export const workspaceUrl = (): string => absolute('/support/workspace')

/* ---------- Who ---------- */

const agentPeople = async (auth: DataverseAuth): Promise<Person[]> => (await getAgents(auth).catch(() => [])).map((a) => ({ id: a.id, name: a.name, email: (a.email ?? '').toLowerCase() }))

/** The managers notifications go to: the notification list, else the manager view's list of managers. Agents among them get
    the bell; other addresses the email only. */
export const notifyManagers = async (auth: DataverseAuth, settings: Settings): Promise<{ people: Person[]; emailOnly: string[] }> => {
  const emails = (settings.notify.managers.length ? settings.notify.managers : settings.managers).map((e) => e.toLowerCase()).filter(isEmail)
  const agents = await agentPeople(auth)
  const people = peopleByEmail(emails, agents)
  const known = new Set(people.map((p) => p.email))
  return { people, emailOnly: emails.filter((e) => !known.has(e)) }
}

/** The engineers on the shifts working at `at` (or opening next): their members. */
export const onShift = async (auth: DataverseAuth, settings: Settings, at: Date = new Date()): Promise<Person[]> => {
  const emails = shiftsOnOrNext(at, settings.hours).flatMap((x) => x.members)
  return emails.length ? peopleByEmail(emails, await agentPeople(auth)) : []
}

/** A systemuserid as a person, when the agent is in the directory. */
export const personById = async (auth: DataverseAuth, id: string): Promise<Person | null> => (await agentPeople(auth)).find((p) => p.id.toLowerCase() === id.toLowerCase()) ?? null

/* ---------- Sending ---------- */

const alreadyTold = async (dedupe: string, agentIds: string[], hours: number): Promise<Set<string>> => {
  const out = new Set<string>()
  if (!agentIds.length) return out
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'support-notifications', where: { and: [{ dedupe: { equals: dedupe } }, { agentId: { in: agentIds } }, { createdAt: { greater_than: new Date(Date.now() - hours * 3600_000).toISOString() } }] }, limit: agentIds.length, depth: 0, overrideAccess: true })
    for (const x of r.docs as unknown as Doc[]) out.add(s(x.agentId).toLowerCase())
  } catch (e) {
    console.error(`[notify] dedupe read failed: ${(e as Error).message}`)
  }
  return out
}

/** Tells the people the entry's rule names. Never throws: a notification that cannot be written is logged, the action it
    reports on has already happened. */
export const notify = async (auth: DataverseAuth, n: NotifyInput): Promise<NotifyResult> => {
  try {
    const settings = await getSettings()
    const rule = ruleFor(settings.notify, n.key)
    if (!rule.on && !n.people) return { bell: 0, emailed: 0, skipped: 'off' }
    if (n.people && (!settings.notify.enabled || rule.delivery === 'off')) return { bell: 0, emailed: 0, skipped: 'off' }
    const at = n.at ?? new Date()
    // A case in the bin has no engineer: what would go to its owner goes to the engineers on shift.
    const audiences = n.caseId && !n.owner && rule.audiences.includes('owner') && !rule.audiences.includes('shift') ? [...rule.audiences, 'shift' as const] : rule.audiences
    const needs = (a: string) => audiences.includes(a as never)
    const [managers, shift] = await Promise.all([needs('managers') && !n.people ? notifyManagers(auth, settings) : Promise.resolve({ people: [], emailOnly: [] }), needs('shift') && !n.people ? onShift(auth, settings, at) : Promise.resolve([] as Person[])])
    // An owner named by id only (a CSAT row) is looked up for the address.
    const owner = n.owner && !n.owner.email ? ((await personById(auth, n.owner.id)) ?? n.owner) : n.owner
    const who = n.people ? { people: n.people.filter((p) => p.id && p.id !== n.actorId), emailOnly: [] } : resolveAudience(audiences, { owner, shift, managers: managers.people, managerEmailsOnly: managers.emailOnly, exclude: n.actorId })
    let people = who.people
    if (n.dedupe) {
      const told = await alreadyTold(n.dedupe, people.map((p) => p.id), n.dedupeHours ?? 12)
      people = people.filter((p) => !told.has(p.id.toLowerCase()))
      if (!people.length && !who.emailOnly.length) return { bell: 0, emailed: 0, skipped: 'already told' }
    }
    const delivery = rule.delivery === 'off' ? 'bell' : rule.delivery
    const link = absolute(n.href)
    const mail = notificationMail({ subject: n.subject, body: n.body, link })
    const payload = await db()
    const result: NotifyResult = { bell: 0, emailed: 0, skipped: null }
    for (const p of people) {
      let emailedAt: string | null = null
      let emailError = ''
      if (delivery === 'immediate') {
        if (!p.email) emailError = 'no email address'
        else {
          try {
            const r = await sendMail({ to: p.email, ...mail })
            if (r.sent) {
              emailedAt = new Date().toISOString()
              result.emailed++
            } else emailError = r.suppressed?.length ? 'suppressed by allowlist' : 'no SMTP_URL'
          } catch (e) {
            emailError = (e as Error).message.slice(0, 200)
          }
        }
      }
      try {
        await payload.create({
          collection: 'support-notifications',
          overrideAccess: true,
          data: { agentId: p.id.toLowerCase(), agentEmail: p.email, agentName: p.name, event: n.key, dedupe: n.dedupe ?? '', subject: n.subject.slice(0, 250), body: n.body.slice(0, 2000), href: n.href, caseId: n.caseId ?? '', ticket: n.ticket ?? '', delivery, emailedAt, emailTo: emailedAt ? p.email : '', emailError } as never,
        })
        result.bell++
      } catch (e) {
        console.error(`[notify] bell row for ${n.key}: ${(e as Error).message}`)
      }
    }
    // Manager addresses that are not agents: the email only, at once whatever the delivery (they have no bell to wait on).
    if (who.emailOnly.length && delivery !== 'bell') {
      try {
        const r = await sendMail({ to: who.emailOnly.join(', '), ...mail })
        if (r.sent) result.emailed += who.emailOnly.length
      } catch (e) {
        console.error(`[notify] ${n.key} → managers' addresses: ${(e as Error).message}`)
      }
    }
    return result
  } catch (e) {
    console.error(`[notify] ${n.key}: ${(e as Error).message}`)
    return { bell: 0, emailed: 0, skipped: 'error' }
  }
}

/* ---------- The shift-end digest and retention ---------- */

export type DigestResult = { mails: number; rows: number; errors: string[] }

/** Emails every bell row that waited for the digest and was written before `cutoff`, one message per person; every row of the
    pass is marked, so rows never wait for ever when no SMTP is set. */
export const digestPass = async (cutoff: Date, now = new Date()): Promise<DigestResult> => {
  const payload = await db()
  const result: DigestResult = { mails: 0, rows: 0, errors: [] }
  const r = await payload.find({ collection: 'support-notifications', where: { and: [{ delivery: { equals: 'digest' } }, { digestAt: { exists: false } }, { createdAt: { less_than: cutoff.toISOString() } }] }, sort: 'createdAt', limit: 2000, depth: 0, overrideAccess: true, pagination: false })
  const rows = r.docs as unknown as Doc[]
  const per = new Map<string, Doc[]>()
  for (const x of rows) {
    const a = s(x.agentEmail).toLowerCase()
    per.set(a, [...(per.get(a) ?? []), x])
  }
  const outcome = new Map<string, { emailedAt: string | null; error: string }>()
  for (const [address, list] of per) {
    if (!isEmail(address)) {
      for (const x of list) outcome.set(s(x.id), { emailedAt: null, error: 'no email address' })
      continue
    }
    const m = digestMail(
      list.slice(0, 60).map((x) => ({ subject: s(x.subject), body: s(x.body), link: absolute(s(x.href) || '/support/workspace'), at: s(x.createdAt) })),
      workspaceUrl(),
    )
    try {
      const sent = await sendMail({ to: address, ...m })
      if (sent.sent) result.mails++
      for (const x of list) outcome.set(s(x.id), { emailedAt: sent.sent ? now.toISOString() : null, error: sent.sent ? '' : sent.suppressed?.length ? 'suppressed by allowlist' : 'no SMTP_URL' })
    } catch (e) {
      result.errors.push(`${address}: ${(e as Error).message.slice(0, 160)}`)
      for (const x of list) outcome.set(s(x.id), { emailedAt: null, error: (e as Error).message.slice(0, 200) })
    }
  }
  for (const x of rows) {
    const o = outcome.get(s(x.id))
    try {
      await payload.update({ collection: 'support-notifications', id: s(x.id), data: { digestAt: now.toISOString(), emailedAt: o?.emailedAt ?? null, emailTo: o?.emailedAt ? s(x.agentEmail) : '', emailError: o?.error ?? '' } as never, overrideAccess: true })
      result.rows++
    } catch (e) {
      result.errors.push(`row ${s(x.id)}: ${(e as Error).message.slice(0, 160)}`)
    }
  }
  return result
}

/** Whether the digest for the shift that closed at `close` has gone out: a row marked at or after the close. */
export const digestDoneSince = async (close: Date): Promise<boolean> => {
  try {
    const payload = await db()
    const pending = await payload.count({ collection: 'support-notifications', where: { and: [{ delivery: { equals: 'digest' } }, { digestAt: { exists: false } }, { createdAt: { less_than: close.toISOString() } }] }, overrideAccess: true })
    return pending.totalDocs === 0
  } catch {
    return true
  }
}

/** Read rows older than the retention go; unread ones after a year. */
export const retentionPass = async (days: number, now = new Date()): Promise<number> => {
  const payload = await db()
  const before = new Date(now.getTime() - days * 86_400_000).toISOString()
  const year = new Date(now.getTime() - 365 * 86_400_000).toISOString()
  const r = await payload.delete({ collection: 'support-notifications', where: { or: [{ and: [{ readAt: { exists: true } }, { readAt: { less_than: before } }] }, { createdAt: { less_than: year } }] }, overrideAccess: true })
  return r.docs.length
}

/** Whether an entry's row was written for this key at all (the once-a-day KPI reports). */
export const toldAlready = async (dedupe: string): Promise<boolean> => {
  try {
    const payload = await db()
    const r = await payload.count({ collection: 'support-notifications', where: { dedupe: { equals: dedupe } }, overrideAccess: true })
    return r.totalDocs > 0
  } catch {
    return false
  }
}

/* ---------- Reading the bell ---------- */

const mine = (agentId: string, extra?: Where): Where => (extra ? { and: [{ agentId: { equals: agentId.toLowerCase() } }, extra] } : { agentId: { equals: agentId.toLowerCase() } })

/** The bell's count: one indexed count per page, never cached, so a row opened a moment ago is gone from it. */
export const unreadCount = async (agentId: string): Promise<number> => {
  try {
    const payload = await db()
    const r = await payload.count({ collection: 'support-notifications', where: mine(agentId, { readAt: { exists: false } }), overrideAccess: true })
    return r.totalDocs
  } catch {
    return 0
  }
}

export const listNotifications = async (agentId: string, o: { limit?: number; page?: number; unread?: boolean } = {}): Promise<{ rows: Notification[]; total: number; unread: number }> => {
  const payload = await db()
  const [r, u] = await Promise.all([
    payload.find({ collection: 'support-notifications', where: mine(agentId, o.unread ? { readAt: { exists: false } } : undefined), sort: '-createdAt', limit: o.limit ?? 30, page: o.page ?? 1, depth: 0, overrideAccess: true }),
    payload.count({ collection: 'support-notifications', where: mine(agentId, { readAt: { exists: false } }), overrideAccess: true }),
  ])
  return { rows: (r.docs as unknown as Doc[]).map(toRow), total: r.totalDocs, unread: u.totalDocs }
}

/** Marks the reader's rows as read: one, or all of them. Only ever their own. */
export const markRead = async (agentId: string, id?: string): Promise<number> => {
  const payload = await db()
  const r = await payload.update({ collection: 'support-notifications', where: mine(agentId, id ? { and: [{ id: { equals: id } }, { readAt: { exists: false } }] } : { readAt: { exists: false } }), data: { readAt: new Date().toISOString() } as never, overrideAccess: true })
  return r.docs.length
}

/** What the workspace told lately, one entry per notification however many people it went to (the at-risk board). */
export type SentGroup = { key: string; event: string; subject: string; ticket: string; caseId: string; at: string; to: string[]; emailed: number; emailError: string }

export const recentSent = async (o: { prefix?: string; limit?: number } = {}): Promise<SentGroup[]> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'support-notifications', where: o.prefix ? { event: { like: `${o.prefix}%` } } : {}, sort: '-createdAt', limit: (o.limit ?? 30) * 4, depth: 0, overrideAccess: true })
    const groups = new Map<string, SentGroup>()
    for (const x of r.docs as unknown as Doc[]) {
      const key = s(x.dedupe) || s(x.id)
      const g = groups.get(key) ?? { key, event: s(x.event), subject: s(x.subject), ticket: s(x.ticket), caseId: s(x.caseId), at: s(x.createdAt), to: [], emailed: 0, emailError: '' }
      g.to.push(s(x.agentName) || s(x.agentEmail) || 'an agent')
      if (x.emailedAt) g.emailed++
      else if (x.emailError && !g.emailError) g.emailError = s(x.emailError)
      groups.set(key, g)
    }
    return [...groups.values()].slice(0, o.limit ?? 30)
  } catch (e) {
    console.error(`[notify] recent: ${(e as Error).message}`)
    return []
  }
}

/** For the settings page: whether email can go at all. */
export const mailState = (): { configured: boolean } => ({ configured: mailConfigured() })
