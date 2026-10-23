import 'server-only'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import { sendMail } from '@/lib/support/mail'
import { forget, memo } from '@/lib/support/memo'
import { getServerSideURL } from '@/utilities/getURL'

import { deliveryFor, digestMail, mailHtml, mailText, renderTemplate, SAMPLE_VARS, toTemplate, type Delivery, type Template } from './notify-model'
import type { OrgScope } from './scope'
import { orgWhere } from './scope'
import { getPartnerSettings, staffWithRole, type PartnerRole, type PartnerSettings, type StaffRole } from './settings'
import { orgUsers, toUser, type PartnerUser } from './users'

/* The notification spine (FR-NTF-01, 02-build-plan.md §1, M8): one `notify()` that every milestone calls. It writes a bell row
   per recipient and, by the event's delivery rule, one email each through the support mail helper (SMTP_URL,
   SUPPORT_MAIL_ALLOWLIST: unlisted addresses are suppressed and the row says so). The subject and body are the code's own
   unless the Channel Manager wrote a template for the event (`partner-mail-templates`), in which case the template is
   rendered with the event's variables. Delivery: at once, in the daily digest (`digestPass`), or the bell only.
   Recipients: one partner user, an organisation (its active users, optionally only some roles), a K7 staff role, or a bare
   address (email only, no bell row: a manager told of a breach). */

export type Recipient = { kind: 'user'; user: PartnerUser } | { kind: 'org'; orgId: string; roles?: PartnerRole[] } | { kind: 'staff'; role: StaffRole } | { kind: 'email'; address: string; name?: string }

export type NotifyInput = { event: string; subject: string; body: string; href?: string; to: Recipient | Recipient[]; email?: boolean; /** The event's placeholders for the template (notify-model.ts). */ vars?: Record<string, string> }
export type NotifyResult = { bell: number; emailed: number; queued: number; suppressed: string[] }

export type Notification = { id: string; at: string; event: string; subject: string; body: string; href: string; readAt: string | null; delivery: Delivery; emailedAt: string | null }

type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const d = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const toRow = (x: Doc): Notification => ({ id: s(x.id), at: s(x.createdAt), event: s(x.event), subject: s(x.subject), body: s(x.body), href: s(x.href), readAt: d(x.readAt), delivery: x.delivery === 'digest' || x.delivery === 'bell' ? x.delivery : 'immediate', emailedAt: d(x.emailedAt) })

const portalUrl = (): string => `${getServerSideURL()}/partners/portal`
const absolute = (href?: string): string => (href ? (href.startsWith('http') ? href : `${getServerSideURL()}${href}`) : portalUrl())

const db = () => getPayload({ config: configPromise })

/* ---------- Templates ---------- */

const TPL_KEY = 'partner:templates'

/** Every template row, by event, memoised for 30 s. */
export const templateMap = (): Promise<Map<string, Template>> =>
  memo(TPL_KEY, 30_000, async () => {
    const m = new Map<string, Template>()
    try {
      const payload = await db()
      const r = await payload.find({ collection: 'partner-mail-templates', limit: 200, depth: 0, overrideAccess: true })
      for (const doc of r.docs as unknown as Doc[]) {
        const t = toTemplate(doc)
        if (t.event) m.set(t.event, t)
      }
    } catch (e) {
      console.error(`[partner notify] templates: ${(e as Error).message}`)
    }
    return m
  })

export const templateFor = async (event: string): Promise<Template | null> => (await templateMap()).get(event) ?? null

export const saveTemplate = async (event: string, t: Pick<Template, 'enabled' | 'delivery' | 'subject' | 'body'>, by: string): Promise<Template> => {
  const payload = await db()
  const data = { event, enabled: t.enabled, delivery: t.delivery, subject: t.subject, body: t.body, updatedBy: by } as never
  const cur = await payload.find({ collection: 'partner-mail-templates', where: { event: { equals: event } }, limit: 1, depth: 0, overrideAccess: true })
  const doc = cur.docs[0] ? await payload.update({ collection: 'partner-mail-templates', id: cur.docs[0].id, data, overrideAccess: true }) : await payload.create({ collection: 'partner-mail-templates', data, overrideAccess: true })
  forget(TPL_KEY)
  return toTemplate(doc as unknown as Doc)
}

/** Removes the row: the event goes back to the code's text and the catalogue's delivery. */
export const resetTemplate = async (event: string): Promise<boolean> => {
  const payload = await db()
  const r = await payload.delete({ collection: 'partner-mail-templates', where: { event: { equals: event } }, overrideAccess: true })
  forget(TPL_KEY)
  return r.docs.length > 0
}

/* ---------- Sending ---------- */

type Target = { data?: Record<string, unknown>; address: string; name: string }

const mailFor = (subject: string, body: string, link: string, settings: PartnerSettings, to: string) => ({
  to,
  from: settings.notify.mailFrom,
  subject,
  text: mailText({ body, link, signature: settings.notify.signature }),
  html: mailHtml({ body, link, signature: settings.notify.signature }),
})

export const notify = async (n: NotifyInput): Promise<NotifyResult> => {
  const payload = await db()
  const settings = await getPartnerSettings()
  const template = await templateFor(n.event)
  const delivery = deliveryFor(n.event, template)
  const email = (n.email ?? true) && settings.notify.emailEnabled && delivery === 'immediate'
  const result: NotifyResult = { bell: 0, emailed: 0, queued: 0, suppressed: [] }
  const link = absolute(n.href)
  // A target without `data` is an extra email only (the second and later holders of a staff role share the role's bell row).
  const targets: Target[] = []
  for (const r of Array.isArray(n.to) ? n.to : [n.to]) {
    if (r.kind === 'user') {
      targets.push({ data: { audience: 'user', userId: r.user.id, orgId: r.user.orgId }, address: r.user.email, name: r.user.name })
    } else if (r.kind === 'org') {
      for (const u of await orgUsers(r.orgId, r.roles)) targets.push({ data: { audience: 'user', userId: u.id, orgId: u.orgId }, address: u.email, name: u.name })
    } else if (r.kind === 'staff') {
      // One bell row per role, read by everyone who holds it; one email per holder.
      const holders = staffWithRole(r.role, settings)
      const first = holders[0]
      targets.push({ data: { audience: 'staff', staffRole: r.role }, address: first?.email ?? '', name: first?.name ?? '' })
      for (const h of holders.slice(1)) targets.push({ address: h.email, name: h.name })
    } else if (r.address.includes('@')) {
      targets.push({ address: r.address.trim().toLowerCase(), name: r.name ?? '' })
    }
  }
  for (const t of targets) {
    const rendered = renderTemplate(template, { subject: n.subject, body: n.body }, { ...(n.vars ?? {}), link, portal: portalUrl(), recipient: t.name || t.address })
    let emailedAt: string | null = null
    let emailTo = ''
    let emailError = ''
    if (email && t.address) {
      try {
        const r = await sendMail(mailFor(rendered.subject, rendered.body, link, settings, t.address))
        if (r.sent) {
          emailedAt = new Date().toISOString()
          emailTo = t.address
          result.emailed += 1
        } else if (r.suppressed?.length) {
          result.suppressed.push(...r.suppressed)
          emailError = 'suppressed by allowlist'
        } else {
          emailError = 'no SMTP_URL'
        }
      } catch (e) {
        emailError = (e as Error).message.slice(0, 200)
        console.error(`[partner notify] ${n.event} → ${t.address}: ${emailError}`)
      }
    } else if (delivery === 'digest' && t.data && settings.notify.emailEnabled && (n.email ?? true)) {
      result.queued += 1
    }
    if (!t.data) continue
    try {
      await payload.create({ collection: 'partner-notifications', overrideAccess: true, data: { ...t.data, event: n.event, subject: rendered.subject, body: rendered.body, href: n.href ?? '', delivery, emailedAt, emailTo, emailError } as never })
      result.bell += 1
    } catch (e) {
      console.error(`[partner notify] bell row for ${n.event}: ${(e as Error).message}`)
    }
  }
  return result
}

/** A test of an event's template to one address (the signed-in Channel Manager), with the sample values; no bell row. */
export const sendTestNotification = async (event: string, to: string, name: string): Promise<{ sent: boolean; suppressed: boolean; subject: string; body: string }> => {
  const settings = await getPartnerSettings()
  const template = await templateFor(event)
  const code = { subject: `[Test] ${SAMPLE_VARS.subject}`, body: `This is a test of the ${event} notification from the K7 partner portal.` }
  const rendered = renderTemplate(template, code, { ...SAMPLE_VARS, link: portalUrl(), portal: portalUrl(), recipient: name || to })
  const r = await sendMail(mailFor(rendered.subject, rendered.body, portalUrl(), settings, to))
  return { sent: r.sent, suppressed: Boolean(r.suppressed?.length), ...rendered }
}

/* ---------- The daily digest and the retention sweep ---------- */

export type DigestResult = { mails: number; rows: number; suppressed: string[]; errors: string[]; removed: number }

/** Emails every bell row whose template said "digest" and that has not gone out, one message per person, oldest first; then
    removes read rows older than the retention. Rows younger than two minutes wait for the next pass so a burst stays whole. */
export const digestPass = async (now = new Date()): Promise<DigestResult> => {
  const payload = await db()
  const settings = await getPartnerSettings()
  const result: DigestResult = { mails: 0, rows: 0, suppressed: [], errors: [], removed: 0 }
  const cutoff = new Date(now.getTime() - 2 * 60_000).toISOString()
  const r = await payload.find({ collection: 'partner-notifications', where: { and: [{ delivery: { equals: 'digest' } }, { digestAt: { exists: false } }, { emailedAt: { exists: false } }, { createdAt: { less_than: cutoff } }] }, sort: 'createdAt', limit: 500, depth: 0, overrideAccess: true })
  const rows = r.docs as unknown as Doc[]
  // Who gets what: a user's rows to their address; a staff role's rows to every holder.
  const perAddress = new Map<string, { name: string; rows: Doc[] }>()
  const userIds = [...new Set(rows.filter((x) => x.audience === 'user').map((x) => s(x.userId)))].filter(Boolean)
  const users = new Map<string, PartnerUser>()
  if (userIds.length) {
    const u = await payload.find({ collection: 'partner-users', where: { id: { in: userIds } }, limit: userIds.length, depth: 0, overrideAccess: true })
    for (const doc of u.docs as unknown as Doc[]) users.set(s(doc.id), toUser(doc))
  }
  const add = (address: string, name: string, row: Doc) => {
    const a = address.trim().toLowerCase()
    if (!a.includes('@')) return
    const e = perAddress.get(a) ?? { name, rows: [] }
    if (!e.rows.includes(row)) e.rows.push(row)
    perAddress.set(a, e)
  }
  for (const row of rows) {
    if (row.audience === 'user') {
      const u = users.get(s(row.userId))
      if (u && u.status !== 'disabled') add(u.email, u.name, row)
    } else if (typeof row.staffRole === 'string') {
      for (const h of staffWithRole(row.staffRole as StaffRole, settings)) add(h.email, h.name, row)
    }
  }
  const sentRows = new Map<string, { emailedAt: string; emailTo: string[]; errors: string[] }>()
  const note = (row: Doc, patch: Partial<{ emailedAt: string; to: string; error: string }>) => {
    const id = s(row.id)
    const e = sentRows.get(id) ?? { emailedAt: '', emailTo: [], errors: [] }
    if (patch.emailedAt) e.emailedAt = patch.emailedAt
    if (patch.to) e.emailTo.push(patch.to)
    if (patch.error) e.errors.push(patch.error)
    sentRows.set(id, e)
  }
  if (settings.notify.emailEnabled) {
    for (const [address, e] of perAddress) {
      const m = digestMail(
        e.rows.slice(0, 50).map((x) => ({ subject: s(x.subject), body: s(x.body), link: absolute(s(x.href) || undefined), at: s(x.createdAt) })),
        { signature: settings.notify.signature, portal: portalUrl() },
      )
      try {
        const sent = await sendMail({ to: address, from: settings.notify.mailFrom, subject: m.subject, text: m.text, html: m.html })
        if (sent.sent) {
          result.mails += 1
          for (const row of e.rows) note(row, { emailedAt: now.toISOString(), to: address })
        } else if (sent.suppressed?.length) {
          result.suppressed.push(address)
          for (const row of e.rows) note(row, { error: 'suppressed by allowlist' })
        } else for (const row of e.rows) note(row, { error: 'no SMTP_URL' })
      } catch (err) {
        result.errors.push(`${address}: ${(err as Error).message.slice(0, 160)}`)
        for (const row of e.rows) note(row, { error: (err as Error).message.slice(0, 200) })
      }
    }
  }
  // Every row of this pass is marked, mailed or not, so a missing SMTP never keeps the same rows in the queue for ever.
  for (const row of rows) {
    const e = sentRows.get(s(row.id))
    try {
      await payload.update({ collection: 'partner-notifications', id: s(row.id), data: { digestAt: now.toISOString(), emailedAt: e?.emailedAt || null, emailTo: e?.emailTo.join(', ') ?? '', emailError: e?.errors[0] ?? (settings.notify.emailEnabled ? 'no recipient' : 'email off') }, overrideAccess: true })
      result.rows += 1
    } catch (err) {
      result.errors.push(`row ${s(row.id)}: ${(err as Error).message.slice(0, 160)}`)
    }
  }
  // Retention: read rows older than the setting go.
  const before = new Date(now.getTime() - settings.notify.bellRetentionDays * 86_400_000).toISOString()
  try {
    const del = await payload.delete({ collection: 'partner-notifications', where: { and: [{ readAt: { exists: true } }, { readAt: { less_than: before } }] }, overrideAccess: true })
    result.removed = del.docs.length
  } catch (err) {
    result.errors.push(`retention: ${(err as Error).message.slice(0, 160)}`)
  }
  return result
}

/* ---------- Reading the bell ---------- */

export type BellScope = { kind: 'user'; userId: string; scope: OrgScope } | { kind: 'staff'; roles: StaffRole[] }

/** A staff reader with no role sees nothing; `staffRole` is an enum column, so the empty case never reaches the query. */
const nothingToRead = (b: BellScope): boolean => b.kind === 'staff' && b.roles.length === 0

const bellWhere = (b: BellScope, extra?: Where): Where => {
  const own: Where = b.kind === 'user' ? orgWhere(b.scope, { userId: { equals: b.userId } }, 'orgId') : { and: [{ audience: { equals: 'staff' } }, { staffRole: { in: b.roles } }] }
  return extra ? { and: [own, extra] } : own
}

export const unreadCount = async (b: BellScope): Promise<number> => {
  if (nothingToRead(b)) return 0
  try {
    const payload = await db()
    const r = await payload.count({ collection: 'partner-notifications', where: bellWhere(b, { readAt: { exists: false } }), overrideAccess: true })
    return r.totalDocs
  } catch {
    return 0
  }
}

export const listNotifications = async (b: BellScope, limit = 50): Promise<Notification[]> => {
  if (nothingToRead(b)) return []
  const payload = await db()
  const r = await payload.find({ collection: 'partner-notifications', where: bellWhere(b), sort: '-createdAt', limit, depth: 0, overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toRow)
}

/** Marks what the reader can see as read; a staff row is shared by the role, so one holder reading it reads it for all. */
export const markAllRead = async (b: BellScope): Promise<number> => {
  if (nothingToRead(b)) return 0
  const payload = await db()
  const r = await payload.update({ collection: 'partner-notifications', where: bellWhere(b, { readAt: { exists: false } }), data: { readAt: new Date().toISOString() }, overrideAccess: true })
  return r.docs.length
}

/** What waits for the next digest, for the templates page. */
export const digestQueueCount = async (): Promise<number> => {
  try {
    const payload = await db()
    const r = await payload.count({ collection: 'partner-notifications', where: { and: [{ delivery: { equals: 'digest' } }, { digestAt: { exists: false } }, { emailedAt: { exists: false } }] }, overrideAccess: true })
    return r.totalDocs
  } catch {
    return 0
  }
}
