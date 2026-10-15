import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getToken } from 'next-auth/jwt'

import { auth } from '@/auth'
import { probeToken, refreshAgentToken } from '@/lib/dataverse/auth'
import { list, NotAuthenticated, type DataverseAuth, type Row } from '@/lib/dataverse'

import type { CustomerScope } from './cases'
import { getSettings } from './kpi-config'
import { getProductSettings } from './product-config'
import { memo } from './memo'

/* Who is calling, and which Dataverse credential serves them. Agents: their delegated token from the encrypted JWT
   (read with getToken so it never passes through `session`). Customers: the service identity plus their scope. */

export type AgentContext = { kind: 'agent'; userId: string; name: string; email: string; dev: boolean; auth: DataverseAuth }
export type CustomerContext = { kind: 'customer'; scope: CustomerScope; name: string; auth: DataverseAuth }

const secureCookie = (): boolean => /^https:/i.test(process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? '')

const agentToken = async (dev: boolean): Promise<string> => {
  if (dev) return (await probeToken()).accessToken
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new NotAuthenticated('AUTH_SECRET is not set.')
  const t = (await getToken({ req: { headers: await headers() }, secret, secureCookie: secureCookie() })) as (Record<string, unknown> & { accessToken?: string; refreshToken?: string; expiresAt?: number }) | null
  if (!t?.accessToken) throw new NotAuthenticated()
  if (t.expiresAt && Date.now() / 1000 > t.expiresAt - 60 && t.refreshToken) {
    // The proxy persists refreshed tokens on the next request; here we only need a usable one now.
    return (await refreshAgentToken(t.refreshToken)).accessToken
  }
  return t.accessToken
}

export const getPortalSession = async () => auth()

/** The signed-in agent, or a redirect to the sign-in page. */
export const requireAgent = async (): Promise<AgentContext> => {
  const s = await auth()
  if (s?.user?.kind !== 'agent') redirect('/support/sign-in?agent=1')
  if (!s.user.userId) redirect('/support/sign-in?agent=1&error=NoDataverseAccess')
  let token: string
  try {
    token = await agentToken(Boolean(s.user.dev))
  } catch {
    redirect('/support/sign-in?agent=1&error=SessionExpired')
  }
  return { kind: 'agent', userId: s.user.userId, name: s.user.name ?? '', email: s.user.email ?? '', dev: Boolean(s.user.dev), auth: { kind: 'agent', token, userId: s.user.userId } }
}

/** The signed-in customer, or a redirect to the sign-in page. Every Dataverse call for them carries `scope`. */
export const requireCustomer = async (next?: string): Promise<CustomerContext> => {
  const s = await auth()
  if (!s?.user) redirect(`/support/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}`)
  if (s.user.kind !== 'customer' || !s.user.contactId) redirect('/support/workspace')
  return { kind: 'customer', scope: { contactId: s.user.contactId, accountId: s.user.accountId ?? null, email: s.user.email ?? '' }, name: s.user.name ?? '', auth: { kind: 'service' } }
}

/** For public pages that adapt when someone is signed in. */
export const optionalSession = async () => {
  const s = await auth()
  return s?.user ? s.user : null
}

/** The signed-in agent or null, for route handlers that answer 401 instead of redirecting. */
export const tryAgent = async (): Promise<AgentContext | null> => {
  const s = await auth()
  if (s?.user?.kind !== 'agent' || !s.user.userId) return null
  try {
    const token = await agentToken(Boolean(s.user.dev))
    return { kind: 'agent', userId: s.user.userId, name: s.user.name ?? '', email: s.user.email ?? '', dev: Boolean(s.user.dev), auth: { kind: 'agent', token, userId: s.user.userId } }
  } catch {
    return null
  }
}

/* ---------- Managers (09-portal-guide.md §4c) ---------- */

/** The agent's Dataverse security roles. Authorisation data, memoised ten minutes per user: the one deliberate exception to
    "per-user lists are never cached", because every workspace page asks for it to decide whether to show the Manage tab. */
export const agentRoles = (auth: DataverseAuth, userId: string): Promise<string[]> =>
  memo(`roles:${userId}`, 10 * 60_000, async () => {
    const p = await list<Row>(auth, `systemusers(${userId})/systemuserroles_association?$select=name`, 100)
    return p.value.map((r) => String(r.name ?? ''))
  })

/** A manager is an agent with one of the configured security roles, or one whose email is on the managers list. Development sign-ins pass. */
export const isManager = async (me: AgentContext): Promise<boolean> => {
  if (me.dev) return true
  const s = await getSettings()
  if (me.email && s.managers.includes(me.email.toLowerCase())) return true
  try {
    const roles = await agentRoles(me.auth, me.userId)
    const wanted = new Set(s.managerRoles.map((r) => r.toLowerCase()))
    return roles.some((r) => wanted.has(r.toLowerCase()))
  } catch {
    return false
  }
}

/** The signed-in manager, or a redirect: agents who are not managers land on the explanation page. */
export const requireManager = async (): Promise<AgentContext> => {
  const me = await requireAgent()
  if (!(await isManager(me))) redirect('/support/workspace/manage/no-access')
  return me
}

/** For the workspace bar: whether the current session may see the Manage tab (never throws). */
export const sessionIsManager = async (): Promise<boolean> => {
  try {
    const me = await tryAgent()
    return me ? await isManager(me) : false
  } catch {
    return false
  }
}

/* ---------- Principal support and team leads (10-product-desk.md §2) ---------- */

/** Principal support triages the product desk: agents with one of the configured roles or a listed email; managers when the setting
    says so; development sign-ins pass. */
export const isPrincipal = async (me: AgentContext): Promise<boolean> => {
  if (me.dev) return true
  const ps = await getProductSettings()
  const email = me.email.toLowerCase()
  if (email && (ps.principals.emails.includes(email) || ps.teams.some((t) => t.leads.includes(email)))) return true
  if (ps.principals.managersAreprincipals && (await isManager(me))) return true
  if (!ps.principals.roles.length) return false
  try {
    const roles = await agentRoles(me.auth, me.userId)
    const wanted = new Set(ps.principals.roles.map((r) => r.toLowerCase()))
    return roles.some((r) => wanted.has(r.toLowerCase()))
  } catch {
    return false
  }
}

/** A lead edits the product desk's settings: a team lead by email, a manager, or a development sign-in. */
export const isLead = async (me: AgentContext): Promise<boolean> => {
  if (me.dev) return true
  const ps = await getProductSettings()
  const email = me.email.toLowerCase()
  if (email && ps.teams.some((t) => t.leads.includes(email))) return true
  return isManager(me)
}

export const requirePrincipal = async (): Promise<AgentContext> => {
  const me = await requireAgent()
  if (!(await isPrincipal(me))) redirect('/support/product/no-access')
  return me
}

export const requireLead = async (): Promise<AgentContext> => {
  const me = await requireAgent()
  if (!(await isLead(me))) redirect('/support/product/no-access')
  return me
}

/** For the workspace bar: whether the session may open the product desk (never throws). */
export const sessionIsPrincipal = async (): Promise<boolean> => {
  try {
    const me = await tryAgent()
    return me ? await isPrincipal(me) : false
  } catch {
    return false
  }
}
