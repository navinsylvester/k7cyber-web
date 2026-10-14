import NextAuth, { type NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'

import { agentScope, devProbeEnabled, probeToken, refreshAgentToken } from '@/lib/dataverse/auth'
import { retrieve, whoAmI } from '@/lib/dataverse/client'
import { entity } from '@/lib/dataverse/odata'
import type { Row } from '@/lib/dataverse/types'
import { findContactByEmail, registerContact } from '@/lib/support/customers'
import { verifyOtp } from '@/lib/support/otp'

/* Auth.js v5 (08-implementation-plan.md §2). Providers:
   - microsoft-entra-id: agents; the scope carries Dataverse user_impersonation so the server gets a delegated token.
   - customer: a one-time code verified against its signed token (src/lib/support/otp.ts); maps to a contact.
   - dev-agent (development only, SUPPORT_DEV_AGENT=probe): the probe's device-code token stands in for an agent
     until the Entra app registration has admin consent (06-entra-setup.md §A step 6). */

type AgentToken = { kind?: 'agent' | 'customer'; accessToken?: string; refreshToken?: string; expiresAt?: number; userId?: string; contactId?: string; accountId?: string | null; dev?: boolean; error?: string }

const entraConfigured = Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET)

const providers: NextAuthConfig['providers'] = []

if (entraConfigured) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: { params: { scope: `openid profile email offline_access ${process.env.DATAVERSE_URL ? agentScope() : ''}`.trim() } },
      // No Graph call for a photo: the app asks for no Graph permission beyond OIDC.
      profile: (p) => ({ id: p.sub, name: p.name, email: p.email ?? p.preferred_username ?? null, kind: 'agent' as const }),
    }),
  )
}

providers.push(
  Credentials({
    id: 'customer',
    name: 'One-time code',
    credentials: { token: { type: 'text' }, code: { type: 'text' } },
    async authorize(c) {
      const r = verifyOtp(typeof c?.token === 'string' ? c.token : null, typeof c?.code === 'string' ? c.code : '')
      if (!r.ok) return null
      const p = r.payload
      const service = { kind: 'service' as const }
      const identity =
        p.purpose === 'register'
          ? await registerContact(service, { email: p.email, firstName: p.firstName || p.email.split('@')[0]!, lastName: p.lastName, mobile: p.mobile, organisation: p.organisation })
          : ((await findContactByEmail(service, p.email)) ?? (await registerContact(service, { email: p.email, firstName: p.firstName || p.email.split('@')[0]! })))
      return { id: identity.contactId, name: identity.name || identity.email, email: identity.email, kind: 'customer', contactId: identity.contactId, accountId: identity.accountId }
    },
  }),
)

if (devProbeEnabled()) {
  providers.push(
    Credentials({
      id: 'dev-agent',
      name: 'Probe user (development)',
      credentials: {},
      async authorize() {
        const t = await probeToken()
        const auth = { kind: 'agent' as const, token: t.accessToken }
        const me = await whoAmI(auth)
        const u = await retrieve<Row>(auth, `${entity('systemusers', me.UserId)}?$select=fullname,internalemailaddress`)
        return { id: me.UserId, name: String(u.fullname ?? 'Probe user'), email: String(u.internalemailaddress ?? ''), kind: 'agent', userId: me.UserId, dev: true }
      },
    }),
  )
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  pages: { signIn: '/support/sign-in', error: '/support/sign-in' },
  providers,
  callbacks: {
    async jwt({ token, user, account }) {
      const t = token as typeof token & AgentToken
      if (account && user) {
        t.name = user.name
        t.email = user.email
        if (account.provider === 'microsoft-entra-id') {
          t.kind = 'agent'
          t.accessToken = account.access_token
          t.refreshToken = account.refresh_token
          t.expiresAt = account.expires_at
          t.dev = false
          delete t.error
          try {
            const me = await whoAmI({ kind: 'agent', token: account.access_token ?? '' })
            t.userId = me.UserId
          } catch {
            t.error = 'NoDataverseAccess'
          }
        } else if (user.kind === 'customer') {
          t.kind = 'customer'
          t.contactId = user.contactId
          t.accountId = user.accountId ?? null
        } else if (user.kind === 'agent' && user.dev) {
          t.kind = 'agent'
          t.dev = true
          t.userId = user.userId
        }
        return t
      }
      if (t.kind === 'agent' && !t.dev && t.refreshToken && t.expiresAt && Date.now() / 1000 > t.expiresAt - 300) {
        try {
          const n = await refreshAgentToken(t.refreshToken)
          t.accessToken = n.accessToken
          t.refreshToken = n.refreshToken
          t.expiresAt = n.expiresAt
          delete t.error
        } catch {
          t.error = 'RefreshFailed'
        }
      }
      return t
    },
    async session({ session, token }) {
      const t = token as typeof token & AgentToken
      session.user.kind = t.kind ?? 'customer'
      session.user.userId = t.userId
      session.user.contactId = t.contactId
      session.user.accountId = t.accountId ?? null
      session.user.dev = t.dev
      session.user.error = t.error
      session.user.name = t.name ?? null
      session.user.email = t.email ?? ''
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
