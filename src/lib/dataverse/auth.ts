import 'server-only'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { NotAuthenticated } from './errors'

/* Token sources for the Dataverse Web API (docs/support-portal/02-dataverse-integration.md §1–2).
   - Agents sign in with Entra ID; their delegated token comes from the Auth.js session (src/auth.ts) and is refreshed here.
   - Customers never reach Dataverse themselves: the server calls Dataverse as the service application user.
   - Development only, off in production builds: the python probe's device-code refresh token (scripts/.token_cache.json) stands in
     for credentials that do not exist yet. `SUPPORT_DEV_SERVICE=probe` uses it as the service identity (customer-side calls) while
     the service app registration (06-entra-setup.md §B) is missing; `SUPPORT_DEV_AGENT=probe` does that too and also opens the
     `dev-agent` sign-in door, so the workspace runs as the probe user. On a host testers can reach, set only the first. */

export const PRODUCTION_HOSTS = ['k7crm.crm8.dynamics.com', 'k7crm.api.crm8.dynamics.com'] as const

export const dataverseUrl = (): string => {
  const u = process.env.DATAVERSE_URL?.trim().replace(/\/+$/, '')
  if (!u) throw new Error('DATAVERSE_URL is not set')
  return u
}

export const dataverseHost = (url = dataverseUrl()): string => new URL(url).host.toLowerCase()

export const isProductionHost = (host: string): boolean => (PRODUCTION_HOSTS as readonly string[]).includes(host.toLowerCase())

export const tenantId = (): string => process.env.DATAVERSE_TENANT_ID?.trim() || process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.match(/microsoftonline\.com\/([^/]+)\//)?.[1] || 'organizations'

const tokenEndpoint = () => `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`

/** The delegated scope the agent sign-in asks for, on top of the OIDC scopes. */
export const agentScope = (): string => `${dataverseUrl()}/user_impersonation`

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string }

const postForm = async (url: string, fields: Record<string, string>): Promise<TokenResponse> => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) })
  return (await r.json().catch(() => ({}))) as TokenResponse
}

/* ---------- Agent (delegated) ---------- */

export type AgentTokens = { accessToken: string; refreshToken?: string; expiresAt: number }

/** Refreshes the agent's Dataverse token with the agent app registration (06-entra-setup.md §A). */
export const refreshAgentToken = async (refreshToken: string): Promise<AgentTokens> => {
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
  if (!clientId || !clientSecret) throw new NotAuthenticated('Agent sign-in is not configured.')
  const t = await postForm(tokenEndpoint(), {
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    scope: `openid profile email offline_access ${agentScope()}`,
  })
  if (!t.access_token) throw new NotAuthenticated(`Token refresh failed${t.error ? ` (${t.error})` : ''}.`)
  return { accessToken: t.access_token, refreshToken: t.refresh_token ?? refreshToken, expiresAt: Math.floor(Date.now() / 1000) + (t.expires_in ?? 3600) }
}

/* ---------- Service (application user) ---------- */

let serviceCache: { token: string; exp: number } | null = null

export const serviceConfigured = (): boolean => Boolean(process.env.DATAVERSE_CLIENT_ID && process.env.DATAVERSE_CLIENT_SECRET)

/** Client-credentials token of the application user; cached in memory until five minutes before expiry. */
export const serviceToken = async (): Promise<string> => {
  if (serviceCache && Date.now() / 1000 < serviceCache.exp - 300) return serviceCache.token
  if (serviceConfigured()) {
    const t = await postForm(tokenEndpoint(), {
      grant_type: 'client_credentials',
      client_id: process.env.DATAVERSE_CLIENT_ID!,
      client_secret: process.env.DATAVERSE_CLIENT_SECRET!,
      scope: `${dataverseUrl()}/.default`,
    })
    if (!t.access_token) throw new NotAuthenticated(`Service token failed${t.error ? ` (${t.error})` : ''}.`)
    serviceCache = { token: t.access_token, exp: Date.now() / 1000 + (t.expires_in ?? 3600) }
    return serviceCache.token
  }
  if (devProbeEnabled()) {
    const p = await probeToken()
    return p.accessToken
  }
  throw new NotAuthenticated('No service credentials: set DATAVERSE_CLIENT_ID/SECRET (06-entra-setup.md §B), or SUPPORT_DEV_SERVICE=probe in development.')
}

/* ---------- Development: the probe's token cache ---------- */

const PROBE_CLIENT = '51f81489-12ee-4a9e-aaae-a2591f45987d' // Microsoft's sample public client for Dataverse, as scripts/dataverse-probe.py uses
const probeCachePath = () => path.join(process.cwd(), 'scripts', '.token_cache.json')

const notProduction = () => process.env.NODE_ENV !== 'production'

/** The probe's token cache may be read: as the service identity (`SUPPORT_DEV_SERVICE=probe`) or for the dev-agent door (`SUPPORT_DEV_AGENT=probe`). */
export const devProbeEnabled = (): boolean => notProduction() && (process.env.SUPPORT_DEV_AGENT === 'probe' || process.env.SUPPORT_DEV_SERVICE === 'probe')

/** The `dev-agent` sign-in door is open: anyone who reaches the sign-in page can act as the probe user. Never on a shared host. */
export const devAgentDoorEnabled = (): boolean => notProduction() && process.env.SUPPORT_DEV_AGENT === 'probe'

let probeMemo: AgentTokens | null = null

/** The developer's own delegated token from the probe's cache, refreshed (and written back) when within five minutes of expiry. */
export const probeToken = async (): Promise<AgentTokens> => {
  if (!devProbeEnabled()) throw new NotAuthenticated('SUPPORT_DEV_AGENT=probe is off.')
  if (probeMemo && Date.now() / 1000 < probeMemo.expiresAt - 300) return probeMemo
  let cache: { access_token?: string; refresh_token?: string; exp?: number } = {}
  try {
    cache = JSON.parse(await readFile(probeCachePath(), 'utf8'))
  } catch {
    throw new NotAuthenticated('scripts/.token_cache.json is missing: run `python3 -I scripts/dataverse-probe.py get WhoAmI` once to sign in.')
  }
  if (cache.access_token && cache.exp && Date.now() / 1000 < cache.exp - 300) {
    probeMemo = { accessToken: cache.access_token, refreshToken: cache.refresh_token, expiresAt: cache.exp }
    return probeMemo
  }
  if (!cache.refresh_token) throw new NotAuthenticated('The probe token cache has no refresh token; sign in with the probe again.')
  const t = await postForm(tokenEndpoint(), {
    grant_type: 'refresh_token',
    client_id: PROBE_CLIENT,
    refresh_token: cache.refresh_token,
    scope: `${agentScope()} offline_access`,
  })
  if (!t.access_token) throw new NotAuthenticated(`Probe token refresh failed${t.error ? ` (${t.error})` : ''}; sign in with the probe again.`)
  const exp = Date.now() / 1000 + (t.expires_in ?? 3600)
  await writeFile(probeCachePath(), JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token ?? cache.refresh_token, exp }), { mode: 0o600 })
  probeMemo = { accessToken: t.access_token, refreshToken: t.refresh_token ?? cache.refresh_token, expiresAt: exp }
  return probeMemo
}
