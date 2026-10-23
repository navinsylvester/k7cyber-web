'use server'

import { AuthError } from 'next-auth'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { signIn } from '@/auth'
import { devAgentDoorEnabled } from '@/lib/dataverse/auth'
import { OTP_TTL_SECONDS, PARTNER_DEVCODE_COOKIE, PARTNER_OTP_COOKIE, PARTNER_OTP_PURPOSE, canSend, canSendFrom, clientKey, isEmail, issueOtp, normaliseEmail, verifyOtp } from '@/lib/partner/otp'
import { getPartnerSettings } from '@/lib/partner/settings'
import { canSignIn, findPartnerUserByEmail } from '@/lib/partner/users'
import { mailAllowed, mailAllowlist, mailConfigured, sendMail } from '@/lib/support/mail'

/* The partner door (02-build-plan.md decision 3): a known partner user asks for a code by email, the code's signed token rides in
   an httpOnly cookie scoped to /partners, and the `partner` provider turns the verified code into a session. The same allowlist
   and rate rules as the support door: on a shared host only listed addresses get a code at all. K7 staff use the Microsoft door. */

const secure = () => process.env.NODE_ENV === 'production'
const PATH = '/partners'
const safeNext = (n: unknown): string | undefined => (typeof n === 'string' && /^\/partners\/portal(\/|$)/.test(n) ? n : undefined)

const back = (err: string, email?: string, next?: string, staff = false): never => {
  const u = new URLSearchParams({ error: err })
  if (email) u.set('email', email)
  if (next) u.set('next', next)
  if (staff) u.set('staff', '1')
  redirect(`/partners/portal/sign-in?${u.toString()}`)
}

const verifyUrl = (email: string, next?: string, extra: Record<string, string> = {}) => {
  const u = new URLSearchParams({ email, ...extra })
  if (next) u.set('next', next)
  return `/partners/portal/verify?${u.toString()}`
}

/** Same rule as the support door: the on-screen code is for the developer's own machine, or a host with the allowlist set. */
const showCodeHere = async (): Promise<boolean> => {
  if (process.env.SUPPORT_DEV_SHOW_CODE !== '1' || process.env.NODE_ENV === 'production' || mailConfigured()) return false
  if (mailAllowlist()) return true
  const h = await headers()
  if (h.get('x-forwarded-for') || h.get('x-forwarded-proto') || h.get('x-forwarded-host')) return false
  const host = (h.get('host') ?? '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

const sendCode = async (email: string, name: string, next?: string) => {
  const { code, token } = issueOtp({ email, purpose: PARTNER_OTP_PURPOSE, firstName: name, next })
  const jar = await cookies()
  jar.set(PARTNER_OTP_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: secure(), path: PATH, maxAge: OTP_TTL_SECONDS })
  const settings = await getPartnerSettings()
  const r = await sendMail({
    to: email,
    from: settings.notify.mailFrom,
    subject: `${code} is your K7 Partners code`,
    text: `Your one-time code is ${code}. It is valid for 10 minutes.\n\nUse it to sign in to the K7 Partner Portal. If you did not ask for this, ignore this email.\n\nK7 Partner Programme`,
    html: `<p style="font:16px/1.5 Arial,sans-serif">Your one-time code is</p><p style="font:600 32px/1 'Courier New',monospace;letter-spacing:.2em">${code}</p><p style="font:14px/1.5 Arial,sans-serif;color:#555">Valid for 10 minutes. Use it to sign in to the K7 Partner Portal. If you did not ask for this, ignore this email.</p>`,
  })
  if (!r.sent && (await showCodeHere())) jar.set(PARTNER_DEVCODE_COOKIE, code, { httpOnly: true, sameSite: 'lax', secure: secure(), path: PATH, maxAge: OTP_TTL_SECONDS })
  else jar.delete(PARTNER_DEVCODE_COOKIE)
}

/** Step 1: a known, active partner user gets a code. Unknown addresses are told so without revealing anything else. */
export async function requestPartnerCode(form: FormData): Promise<void> {
  const email = normaliseEmail(String(form.get('email') ?? ''))
  const next = safeNext(form.get('next'))
  if (!isEmail(email)) back('email', '', next)
  if (!mailAllowed(email)) back('allowlist', email, next)
  if (!canSend(email) || !canSendFrom(clientKey(await headers()))) back('rate', email, next)
  const found = await findPartnerUserByEmail(email).catch(() => null)
  if (!found) return back('unknown', email, next)
  const ok = canSignIn(found.user, found.org)
  if (!ok.ok) return back(ok.reason === 'org' ? 'suspended' : 'disabled', email, next)
  await sendCode(email, found.user.name, next)
  redirect(verifyUrl(email, next))
}

/** Step 2: the code against the cookie's token; the `partner` provider verifies again and creates the session. */
export async function verifyPartnerCode(form: FormData): Promise<void> {
  const code = String(form.get('code') ?? '').replace(/\D/g, '')
  const email = normaliseEmail(String(form.get('email') ?? ''))
  const next = safeNext(form.get('next'))
  const jar = await cookies()
  const token = jar.get(PARTNER_OTP_COOKIE)?.value
  const check = verifyOtp(token, code, { consume: false })
  if (!check.ok) redirect(verifyUrl(email, next, { error: check.reason }))
  jar.delete(PARTNER_OTP_COOKIE)
  jar.delete(PARTNER_DEVCODE_COOKIE)
  try {
    await signIn('partner', { token, code, redirectTo: next ?? '/partners/portal' })
  } catch (e) {
    if (e instanceof AuthError) redirect(verifyUrl(email, next, { error: 'account' }))
    throw e
  }
}

export async function resendPartnerCode(form: FormData): Promise<void> {
  const email = normaliseEmail(String(form.get('email') ?? ''))
  const next = safeNext(form.get('next'))
  if (!isEmail(email) || !mailAllowed(email)) redirect(verifyUrl(email, next, { error: 'allowlist' }))
  if (!canSend(email) || !canSendFrom(clientKey(await headers()))) redirect(verifyUrl(email, next, { error: 'rate' }))
  const found = await findPartnerUserByEmail(email).catch(() => null)
  if (!found || !canSignIn(found.user, found.org).ok) return back('unknown', email, next)
  await sendCode(email, found.user.name, next)
  redirect(verifyUrl(email, next, { resent: '1' }))
}

/** The K7 door: Entra ID, or the probe token in development, landing on the partner desk. */
export async function staffSignIn(form: FormData): Promise<void> {
  const next = safeNext(form.get('next')) ?? '/partners/portal/k7'
  const provider = String(form.get('provider') ?? 'microsoft-entra-id')
  if (provider === 'dev-agent') {
    if (!devAgentDoorEnabled()) back('dev', '', next, true)
    try {
      await signIn('dev-agent', { redirectTo: next })
    } catch (e) {
      if (e instanceof AuthError) back('probe', '', next, true)
      throw e
    }
  }
  await signIn('microsoft-entra-id', { redirectTo: next })
}

/** The development code, when the portal cannot send mail. */
export async function devPartnerCode(): Promise<string | null> {
  if (process.env.NODE_ENV === 'production') return null
  return (await cookies()).get(PARTNER_DEVCODE_COOKIE)?.value ?? null
}
