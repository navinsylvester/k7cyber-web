import 'server-only'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import { sendMail } from '@/lib/support/mail'
import { getServerSideURL } from '@/utilities/getURL'

import type { OrgScope } from './scope'
import { orgWhere } from './scope'
import { getPartnerSettings, staffWithRole, type PartnerRole, type StaffRole } from './settings'
import { orgUsers, type PartnerUser } from './users'

/* The notification spine (FR-NTF-01, 02-build-plan.md §1): one `notify()` that every milestone calls. It writes a bell row per
   recipient and, when the settings allow, one email each through the support mail helper (SMTP_URL, SUPPORT_MAIL_ALLOWLIST:
   unlisted addresses are suppressed and the row says so). M8 replaces the plain subject and body with editable templates.
   Recipients: one partner user, an organisation (its active users, optionally only some roles), or a K7 staff role. */

export type Recipient = { kind: 'user'; user: PartnerUser } | { kind: 'org'; orgId: string; roles?: PartnerRole[] } | { kind: 'staff'; role: StaffRole }

export type NotifyInput = { event: string; subject: string; body: string; href?: string; to: Recipient | Recipient[]; email?: boolean }
export type NotifyResult = { bell: number; emailed: number; suppressed: string[] }

export type Notification = { id: string; at: string; event: string; subject: string; body: string; href: string; readAt: string | null }

type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const toRow = (x: Doc): Notification => ({ id: s(x.id), at: s(x.createdAt), event: s(x.event), subject: s(x.subject), body: s(x.body), href: s(x.href), readAt: typeof x.readAt === 'string' && x.readAt ? x.readAt : null })

const absolute = (href?: string): string => (href ? (href.startsWith('http') ? href : `${getServerSideURL()}${href}`) : `${getServerSideURL()}/partners/portal`)

const mailFor = (n: NotifyInput, from: string, to: string) => ({
  to,
  from,
  subject: n.subject,
  text: `${n.body}\n\n${absolute(n.href)}\n\nK7 Partner Programme`,
})

export const notify = async (n: NotifyInput): Promise<NotifyResult> => {
  const payload = await getPayload({ config: configPromise })
  const settings = await getPartnerSettings()
  const email = (n.email ?? true) && settings.notify.emailEnabled
  const result: NotifyResult = { bell: 0, emailed: 0, suppressed: [] }
  // A target without `data` is an extra email only (the second and later holders of a staff role share the role's bell row).
  const targets: { data?: Record<string, unknown>; address: string }[] = []
  for (const r of Array.isArray(n.to) ? n.to : [n.to]) {
    if (r.kind === 'user') {
      targets.push({ data: { audience: 'user', userId: r.user.id, orgId: r.user.orgId }, address: r.user.email })
    } else if (r.kind === 'org') {
      for (const u of await orgUsers(r.orgId, r.roles)) targets.push({ data: { audience: 'user', userId: u.id, orgId: u.orgId }, address: u.email })
    } else {
      // One bell row per role, read by everyone who holds it; one email per holder.
      const holders = staffWithRole(r.role, settings)
      const first = holders[0]
      targets.push({ data: { audience: 'staff', staffRole: r.role }, address: first?.email ?? '' })
      for (const h of holders.slice(1)) targets.push({ address: h.email })
    }
  }
  for (const t of targets) {
    let emailedAt: string | null = null
    let emailTo = ''
    let emailError = ''
    if (email && t.address) {
      try {
        const r = await sendMail(mailFor(n, settings.notify.mailFrom, t.address))
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
    }
    if (!t.data) continue
    try {
      await payload.create({ collection: 'partner-notifications', overrideAccess: true, data: { ...t.data, event: n.event, subject: n.subject, body: n.body, href: n.href ?? '', emailedAt, emailTo, emailError } as never })
      result.bell += 1
    } catch (e) {
      console.error(`[partner notify] bell row for ${n.event}: ${(e as Error).message}`)
    }
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
    const payload = await getPayload({ config: configPromise })
    const r = await payload.count({ collection: 'partner-notifications', where: bellWhere(b, { readAt: { exists: false } }), overrideAccess: true })
    return r.totalDocs
  } catch {
    return 0
  }
}

export const listNotifications = async (b: BellScope, limit = 50): Promise<Notification[]> => {
  if (nothingToRead(b)) return []
  const payload = await getPayload({ config: configPromise })
  const r = await payload.find({ collection: 'partner-notifications', where: bellWhere(b), sort: '-createdAt', limit, depth: 0, overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toRow)
}

/** Marks what the reader can see as read; a staff row is shared by the role, so one holder reading it reads it for all (M8 may split). */
export const markAllRead = async (b: BellScope): Promise<number> => {
  if (nothingToRead(b)) return 0
  const payload = await getPayload({ config: configPromise })
  const r = await payload.update({ collection: 'partner-notifications', where: bellWhere(b, { readAt: { exists: false } }), data: { readAt: new Date().toISOString() }, overrideAccess: true })
  return r.docs.length
}
