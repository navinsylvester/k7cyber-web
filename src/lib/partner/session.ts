import 'server-only'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'

import type { Actor } from './audit'
import type { OrgScope } from './scope'
import { getPartnerSettings, staffRolesFor, type PartnerRole, type StaffRole } from './settings'
import { sessionError, type PartnerSessionState } from './session-model'
import { loadPartnerUser, canSignIn, type PartnerOrg, type PartnerUser } from './users'
import { isDeployed } from '@/lib/env'

/* Who is calling the partner portal (02-build-plan.md §4). Partner users: the session names the `partner-users` row; the row
   and its organisation are re-read on every request, so a suspension or a role change bites at once, and the context carries
   the scope every query must take. K7 staff: an agent session (Microsoft door, or the probe door in development) whose email
   is in `partner-settings.staff`; no Dataverse token is needed on this side, the CRM is written through the outbox. */

export type PartnerContext = { kind: 'partner'; user: PartnerUser; org: PartnerOrg; scope: OrgScope; roles: PartnerRole[]; actor: Actor }
export type K7Context = { kind: 'k7'; email: string; name: string; userId: string; dev: boolean; roles: StaffRole[]; actor: Actor }

const SIGN_IN = '/partners/portal/sign-in'
const safeNext = (n?: string): string => (n && /^\/partners\/portal(\/|$)/.test(n) ? n : '')
const signInUrl = (o: { staff?: boolean; next?: string; error?: string }) => {
  const u = new URLSearchParams()
  if (o.staff) u.set('staff', '1')
  if (safeNext(o.next)) u.set('next', safeNext(o.next))
  if (o.error) u.set('error', o.error)
  const q = u.toString()
  return q ? `${SIGN_IN}?${q}` : SIGN_IN
}

const partnerFromSession = async (): Promise<PartnerContext | { error: Exclude<PartnerSessionState, 'ok'> }> => {
  const s = await auth()
  if (!s?.user) return { error: 'none' }
  if (s.user.kind !== 'partner' || !s.user.partnerUserId) return { error: 'kind' }
  const found = await loadPartnerUser(s.user.partnerUserId)
  if (!found) return { error: 'gone' }
  const ok = canSignIn(found.user, found.org)
  if (!ok.ok) return { error: ok.reason }
  return {
    kind: 'partner',
    user: found.user,
    org: found.org,
    scope: { orgId: found.org.id },
    roles: found.user.roles,
    actor: { kind: 'partner', id: found.user.id, name: found.user.name, email: found.user.email },
  }
}

/** The signed-in partner user, or a redirect to the door. An agent session is sent to the K7 side. */
export const requirePartner = async (next?: string): Promise<PartnerContext> => {
  const r = await partnerFromSession()
  if ('error' in r) {
    if (r.error === 'kind') {
      const s = await auth()
      if (s?.user?.kind === 'agent') redirect('/partners/portal/k7')
    }
    redirect(signInUrl({ next, error: sessionError(r.error) }))
  }
  return r
}

/** A partner user holding one of the roles, or the no-access page. */
export const requirePartnerRole = async (roles: PartnerRole[], next?: string): Promise<PartnerContext> => {
  const me = await requirePartner(next)
  if (!roles.some((r) => me.roles.includes(r))) redirect('/partners/portal/no-access')
  return me
}

/** The partner user or null, for route handlers and the header (never redirects). */
export const tryPartner = async (): Promise<PartnerContext | null> => {
  try {
    const r = await partnerFromSession()
    return 'error' in r ? null : r
  } catch {
    return null
  }
}

/** Whether the session is a partner session that can still be used, for the door (never redirects). */
export const partnerSessionState = async (): Promise<PartnerSessionState> => {
  try {
    const r = await partnerFromSession()
    return 'error' in r ? r.error : 'ok'
  } catch {
    return 'none'
  }
}

const k7FromSession = async (): Promise<K7Context | null> => {
  const s = await auth()
  if (s?.user?.kind !== 'agent') return null
  const email = (s.user.email ?? '').toLowerCase()
  const dev = Boolean(s.user.dev)
  const settings = await getPartnerSettings()
  const roles = staffRolesFor(email, settings, { dev, production: isDeployed() })
  return { kind: 'k7', email, name: s.user.name ?? '', userId: s.user.userId ?? '', dev, roles, actor: { kind: 'k7', id: s.user.userId ?? email, name: s.user.name ?? '', email } }
}

/** A signed-in K7 person (any agent session), or the staff door. Pages then check `roles`; `requireK7Role` does both. */
export const requireK7 = async (next?: string): Promise<K7Context> => {
  const me = await k7FromSession()
  if (!me) redirect(signInUrl({ staff: true, next }))
  return me
}

/** A K7 person holding one of the roles, or the explanation page. */
export const requireK7Role = async (roles: StaffRole[], next?: string): Promise<K7Context> => {
  const me = await requireK7(next)
  if (!roles.some((r) => me.roles.includes(r))) redirect('/partners/portal/k7/no-access')
  return me
}

/** The K7 person or null (never redirects). */
export const tryK7 = async (): Promise<K7Context | null> => {
  try {
    return await k7FromSession()
  } catch {
    return null
  }
}

/** For the header: whoever is signed in on this side, partner or K7, or null. */
export const partnerSideSession = async (): Promise<PartnerContext | K7Context | null> => (await tryPartner()) ?? (await tryK7())
