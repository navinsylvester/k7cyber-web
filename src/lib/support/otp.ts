import 'server-only'
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

/* One-time codes for customer sign-in and registration, and for the partner portal's door (partner-portal/02-build-plan.md
   decision 3): stateless, signed with AUTH_SECRET, ten minutes, six digits. The cookie that carries the token is httpOnly;
   the code travels by email. Attempts are counted per token in memory (five), which is enough for one server; a shared
   store replaces the map when the portal runs on several. The purpose is part of the signed payload, so a code issued for
   one door never opens another. */

export type OtpPurpose = 'sign-in' | 'register' | 'partner-sign-in' | 'partner-join'
export type OtpPayload = { email: string; purpose: OtpPurpose; exp: number; firstName?: string; lastName?: string; mobile?: string; organisation?: string; next?: string }

export const OTP_TTL_SECONDS = 600
export const OTP_MAX_ATTEMPTS = 5
export const OTP_COOKIE = 'k7-support-otp'

const secret = (): string => {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return s
}

const b64u = (s: string | Buffer) => Buffer.from(s).toString('base64url')
const hmac = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url')

export const normaliseEmail = (e: string): string => e.trim().toLowerCase()
export const isEmail = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)

/** Issues a code and the token that can verify it. The token carries the payload, the hash of the code and a signature. */
export const issueOtp = (p: Omit<OtpPayload, 'exp'>): { code: string; token: string; payload: OtpPayload } => {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const payload: OtpPayload = { ...p, email: normaliseEmail(p.email), exp: Math.floor(Date.now() / 1000) + OTP_TTL_SECONDS }
  const body = b64u(JSON.stringify(payload))
  const codeHash = hmac(`${body}.${code}`)
  const sig = hmac(`${body}.${codeHash}`)
  return { code, token: `${body}.${codeHash}.${sig}`, payload }
}

const attempts = new Map<string, { n: number; exp: number }>()
const sweep = () => {
  const now = Date.now() / 1000
  for (const [k, v] of attempts) if (v.exp < now) attempts.delete(k)
}

export type OtpResult = { ok: true; payload: OtpPayload } | { ok: false; reason: 'expired' | 'invalid' | 'locked' }

/** Verifies a code against its token. Wrong codes count; after five the token is dead. A correct code consumes the token
   unless `consume` is false (a pre-check before Auth.js runs the consuming verification in the provider). */
export const verifyOtp = (token: string | undefined | null, code: string, opts: { consume?: boolean } = {}): OtpResult => {
  if (!token) return { ok: false, reason: 'expired' }
  const [body, codeHash, sig] = token.split('.')
  if (!body || !codeHash || !sig) return { ok: false, reason: 'expired' }
  const expectSig = hmac(`${body}.${codeHash}`)
  if (expectSig.length !== sig.length || !timingSafeEqual(Buffer.from(expectSig), Buffer.from(sig))) return { ok: false, reason: 'expired' }
  let payload: OtpPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OtpPayload
  } catch {
    return { ok: false, reason: 'expired' }
  }
  if (payload.exp < Date.now() / 1000) return { ok: false, reason: 'expired' }
  sweep()
  const a = attempts.get(sig) ?? { n: 0, exp: payload.exp }
  if (a.n >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'locked' }
  const given = hmac(`${body}.${code.replace(/\D/g, '')}`)
  const ok = given.length === codeHash.length && timingSafeEqual(Buffer.from(given), Buffer.from(codeHash))
  if (!ok) {
    attempts.set(sig, { n: a.n + 1, exp: payload.exp })
    return { ok: false, reason: a.n + 1 >= OTP_MAX_ATTEMPTS ? 'locked' : 'invalid' }
  }
  if (opts.consume !== false) attempts.set(sig, { n: OTP_MAX_ATTEMPTS, exp: payload.exp }) // single use
  return { ok: true, payload }
}

/** Sends per email address per 15 minutes. */
const sends = new Map<string, number[]>()
export const canSend = (email: string, max = 5): boolean => {
  const now = Date.now()
  const arr = (sends.get(email) ?? []).filter((t) => now - t < 15 * 60 * 1000)
  if (arr.length >= max) {
    sends.set(email, arr)
    return false
  }
  arr.push(now)
  sends.set(email, arr)
  return true
}
