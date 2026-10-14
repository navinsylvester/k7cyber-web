import type { DefaultSession } from 'next-auth'

/* Two kinds of session share one Auth.js instance (08-implementation-plan.md §2): agents (Entra ID, Dataverse as themselves)
   and customers (one-time code, mapped to a contact). Dataverse tokens stay in the encrypted JWT and never enter `session`. */
export type PortalUserKind = 'agent' | 'customer'

declare module 'next-auth' {
  interface Session {
    user: {
      kind: PortalUserKind
      /** Dataverse systemuserid (agents). */
      userId?: string
      /** Dataverse contactid and parent account (customers). */
      contactId?: string
      accountId?: string | null
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
    dev?: boolean
  }
}
