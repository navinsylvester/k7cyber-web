import type { DefaultSession } from 'next-auth'

/* Three kinds of session share one Auth.js instance (08-implementation-plan.md §2; partner-portal/02-build-plan.md decision 3):
   agents (Entra ID, Dataverse as themselves), customers (one-time code, mapped to a contact) and partner users (one-time code,
   mapped to a `partner-users` row and its organisation). Dataverse tokens stay in the encrypted JWT and never enter `session`. */
export type PortalUserKind = 'agent' | 'customer' | 'partner'
export type PartnerRole = 'admin' | 'sales' | 'technical'

declare module 'next-auth' {
  interface Session {
    user: {
      kind: PortalUserKind
      /** Dataverse systemuserid (agents). */
      userId?: string
      /** Dataverse contactid and parent account (customers). */
      contactId?: string
      accountId?: string | null
      /** The `partner-users` row and its organisation (partner users). Roles are re-read from Payload on every request. */
      partnerUserId?: string
      orgId?: string
      roles?: PartnerRole[]
      /** Development sign-in through the probe's token cache. */
      dev?: boolean
      /** Set when the delegated token could not be refreshed. */
      error?: string
    } & DefaultSession['user']
  }
  interface User {
    kind?: PortalUserKind
    userId?: string
    contactId?: string
    accountId?: string | null
    partnerUserId?: string
    orgId?: string
    roles?: PartnerRole[]
    dev?: boolean
  }
}
