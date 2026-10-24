'use server'

import { AuthError } from 'next-auth'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { signIn } from '@/auth'
import { devAgentDoorEnabled } from '@/lib/dataverse/auth'
import { findContactByEmail } from '@/lib/support/customers'
import { mailAllowed, mailAllowlist, mailConfigured, otpMail, sendMail } from '@/lib/support/mail'
import { OTP_COOKIE, OTP_TTL_SECONDS, canSend, isEmail, issueOtp, normaliseEmail, verifyOtp } from '@/lib/support/otp'
import { isDeployed } from '@/lib/env'

/* Customer sign-in and registration by one-time code, and the agent door. Every step is a server action; the code's
   signed token travels in an httpOnly cookie, the code itself by email (or the console in development). With
   SUPPORT_MAIL_ALLOWLIST set, only listed addresses get a code at all, checked before any contact lookup, so a shared test
   host neither mails nor reveals the seeded real customers. */

const DEV_CODE_COOKIE = 'k7-support-devcode'
/** The registration details, without the code, so "Send a new code" can re-issue a registration. */
const REG_COOKIE = 'k7-support-reg'
const secure = () => process.env.NODE_ENV === 'production'

const safeNext = (n: unknown): string | undefined => (typeof n === 'string' && /^\/support(\/|$)/.test(n) ? n : undefined)

/** The on-screen code (SUPPORT_DEV_SHOW_CODE=1, no SMTP) is for the developer's own machine. On any other host it needs the
    allowlist, or whoever found the URL could take a seeded customer's address and read their cases. */
const showCodeHere = async (): Promise<boolean> => {
  if (process.env.SUPPORT_DEV_SHOW_CODE !== '1' || isDeployed() || mailConfigured()) return false
  if (mailAllowlist()) return true
  const h = await headers()
  // A tunnel or proxy may rewrite Host to localhost; the forwarded headers it adds give it away.
  if (h.get('x-forwarded-for') || h.get('x-forwarded-proto') || h.get('x-forwarded-host')) return false
  const host = (h.get('host') ?? '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

const sendCode = async (p: { email: string; purpose: 'sign-in' | 'register'; firstName?: string; lastName?: string; mobile?: string; organisation?: string; next?: string }) => {
  const { code, token } = issueOtp(p)
  const jar = await cookies()
  jar.set(OTP_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: secure(), path: '/support', maxAge: OTP_TTL_SECONDS })
  jar.set(REG_COOKIE, JSON.stringify({ email: p.email, purpose: p.purpose, firstName: p.firstName, lastName: p.lastName, mobile: p.mobile, organisation: p.organisation, next: p.next }), { httpOnly: true, sameSite: 'lax', secure: secure(), path: '/support', maxAge: OTP_TTL_SECONDS })
  const r = await sendMail({ to: p.email, ...otpMail(code, p.purpose) })
  if (!r.sent && (await showCodeHere())) {
    jar.set(DEV_CODE_COOKIE, code, { httpOnly: true, sameSite: 'lax', secure: secure(), path: '/support', maxAge: OTP_TTL_SECONDS })
  } else {
    jar.delete(DEV_CODE_COOKIE)
  }
}

const verifyUrl = (email: string, next?: string, extra: Record<string, string> = {}) => {
  const u = new URLSearchParams({ email, ...extra })
  if (next) u.set('next', next)
  return `/support/verify?${u.toString()}`
}

/** Step 1 of sign-in: an email we know gets a code; one we do not is sent to registration with the address filled in. */
export async function requestSignInCode(form: FormData): Promise<void> {
  const email = normaliseEmail(String(form.get('email') ?? ''))
  const next = safeNext(form.get('next'))
  if (!isEmail(email)) redirect(`/support/sign-in?error=email${next ? `&next=${encodeURIComponent(next)}` : ''}`)
  if (!mailAllowed(email)) redirect(`/support/sign-in?error=allowlist${next ? `&next=${encodeURIComponent(next)}` : ''}`)
  if (!canSend(email)) redirect(`/support/sign-in?error=rate`)
  const known = await findContactByEmail({ kind: 'service' }, email).catch(() => null)
  if (!known) redirect(`/support/register?email=${encodeURIComponent(email)}&new=1${next ? `&next=${encodeURIComponent(next)}` : ''}`)
  await sendCode({ email, purpose: 'sign-in', firstName: known.firstName, next })
  redirect(verifyUrl(email, next))
}

/** Registration: the details ride inside the signed token and become a contact once the code is verified. */
export async function requestRegistrationCode(form: FormData): Promise<void> {
  const email = normaliseEmail(String(form.get('email') ?? ''))
  const firstName = String(form.get('firstName') ?? '').trim()
  const lastName = String(form.get('lastName') ?? '').trim()
  const mobile = String(form.get('mobile') ?? '').trim()
  const kind = String(form.get('kind') ?? 'individual')
  const organisation = kind === 'organisation' ? String(form.get('organisation') ?? '').trim() : ''
  const next = safeNext(form.get('next'))
  const back = (err: string) => redirect(`/support/register?error=${err}&email=${encodeURIComponent(email)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&mobile=${encodeURIComponent(mobile)}&kind=${kind}&organisation=${encodeURIComponent(organisation)}${next ? `&next=${encodeURIComponent(next)}` : ''}`)
  if (!isEmail(email)) back('email')
  if (!mailAllowed(email)) back('allowlist')
  if (firstName.length < 2) back('name')
  if (mobile && !/^\+?[0-9 ]{10,15}$/.test(mobile)) back('mobile')
  if (kind === 'organisation' && organisation.length < 2) back('organisation')
  if (!canSend(email)) back('rate')
  const known = await findContactByEmail({ kind: 'service' }, email).catch(() => null)
  await sendCode({ email, purpose: known ? 'sign-in' : 'register', firstName, lastName, mobile, organisation, next })
  redirect(verifyUrl(email, next, known ? { known: '1' } : {}))
}

/** Step 2: the code against the cookie's token; Auth.js then creates the customer session. */
export async function verifyCode(form: FormData): Promise<void> {
  const code = String(form.get('code') ?? '').replace(/\D/g, '')
  const email = normaliseEmail(String(form.get('email') ?? ''))
  const next = safeNext(form.get('next'))
  const jar = await cookies()
  const token = jar.get(OTP_COOKIE)?.value
  // A pre-check for a precise error message; the `customer` provider's authorize() verifies again and consumes the token.
  const check = verifyOtp(token, code, { consume: false })
  if (!check.ok) redirect(verifyUrl(email, next, { error: check.reason }))
  jar.delete(OTP_COOKIE)
  jar.delete(DEV_CODE_COOKIE)
  try {
    await signIn('customer', { token, code, redirectTo: next ?? '/support/cases' })
  } catch (e) {
    if (e instanceof AuthError) redirect(verifyUrl(email, next, { error: 'account' }))
    throw e
  }
}

export async function resendCode(form: FormData): Promise<void> {
  const email = normaliseEmail(String(form.get('email') ?? ''))
  const next = safeNext(form.get('next'))
  if (!isEmail(email) || !mailAllowed(email)) redirect(verifyUrl(email, next, { error: 'allowlist' }))
  if (!canSend(email)) redirect(verifyUrl(email, next, { error: 'rate' }))
  // A registration in progress keeps its details; anything else is a plain sign-in code.
  const regRaw = (await cookies()).get(REG_COOKIE)?.value
  if (regRaw) {
    try {
      const reg = JSON.parse(regRaw) as { email: string; purpose: 'sign-in' | 'register'; firstName?: string; lastName?: string; mobile?: string; organisation?: string; next?: string }
      if (reg.email === email) {
        await sendCode({ ...reg, next: next ?? reg.next })
        redirect(verifyUrl(email, next, { resent: '1' }))
      }
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    }
  }
  const known = await findContactByEmail({ kind: 'service' }, email).catch(() => null)
  if (!known) redirect(`/support/register?email=${encodeURIComponent(email)}&new=1`)
  await sendCode({ email, purpose: 'sign-in', firstName: known.firstName, next })
  redirect(verifyUrl(email, next, { resent: '1' }))
}

/** The agent door: Entra ID, or the probe token in development. */
export async function agentSignIn(form: FormData): Promise<void> {
  const next = safeNext(form.get('next')) ?? '/support/workspace'
  const provider = String(form.get('provider') ?? 'microsoft-entra-id')
  if (provider === 'dev-agent') {
    if (!devAgentDoorEnabled()) redirect('/support/sign-in?agent=1&error=dev')
    try {
      await signIn('dev-agent', { redirectTo: next })
    } catch (e) {
      if (e instanceof AuthError) redirect('/support/sign-in?agent=1&error=probe')
      throw e
    }
  }
  await signIn('microsoft-entra-id', { redirectTo: next })
}

/** The development code, when the portal cannot send mail. */
export async function devCode(): Promise<string | null> {
  if (isDeployed()) return null
  return (await cookies()).get(DEV_CODE_COOKIE)?.value ?? null
}
