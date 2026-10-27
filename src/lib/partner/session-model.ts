/* What the partner door does with a session it finds (B-01), pure and tested without a tenant. A partner session goes home only
   while it can still be used: a suspended organisation, a disabled user or a removed one stays on the door with the reason, since
   requirePartner sends that session back here and a bounce home would loop. An agent session goes to the partner desk. */

export type PartnerSessionState = 'ok' | 'none' | 'kind' | 'gone' | 'org' | 'user'

/** The `error` the door shows for a session that can no longer be used. */
export const sessionError = (s: PartnerSessionState): 'suspended' | 'disabled' | 'gone' | undefined =>
  s === 'org' ? 'suspended' : s === 'user' ? 'disabled' : s === 'gone' ? 'gone' : undefined

export const signInLanding = (o: { kind?: string; state: PartnerSessionState; next?: string }): { redirect: string } | { error?: string; stale: boolean } => {
  if (o.kind === 'agent') return { redirect: o.next?.startsWith('/partners/portal/k7') ? o.next : '/partners/portal/k7' }
  if (o.kind !== 'partner') return { stale: false }
  if (o.state === 'ok') return { redirect: o.next ?? '/partners/portal' }
  return { error: sessionError(o.state), stale: true }
}
