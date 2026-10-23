'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { currentDraft, JOIN_COOKIE, JOIN_DEVCODE_COOKIE, JOIN_OTP_COOKIE, JOIN_PATH } from '@/lib/partner/join'
import { OTP_TTL_SECONDS, canSend, issueOtp, normaliseEmail, verifyOtp } from '@/lib/partner/otp'
import { createDraft, editable, findByNumber, JOIN, markVerified, saveDetails, saveType, submitApplication } from '@/lib/partner/registration'
import { EMPTY_COMPANY, isMobile, isPartnerType, normaliseMobile, validateCompany, validateContact, validateRegions, type Company, type SizeBand, type TurnoverBand } from '@/lib/partner/registration-model'
import { getPartnerSettings } from '@/lib/partner/settings'
import { sendSms, smsCodeText, smsConfigured } from '@/lib/partner/sms'
import { mailAllowed, mailAllowlist, mailConfigured, sendMail } from '@/lib/support/mail'

/* The join flow (01-requirements.md §3, 02-build-plan.md M2): type → company and contact → codes → terms. The draft lives in
   `partner-applications` from the first step; an httpOnly cookie scoped to /partners/join carries its resume key, and the
   emailed status link carries the same key, so "resume after a clarification" is the same pages. The contact's email is
   verified with the support portal's signed code under the purpose `partner-join`; the mobile code goes through the SMS
   adapter and is skipped, visibly, while no gateway exists (decision 4). */

const OTP_COOKIE = JOIN_OTP_COOKIE
const DEVCODE_COOKIE = JOIN_DEVCODE_COOKIE
const PATH = JOIN_PATH
const secure = () => process.env.NODE_ENV === 'production'

const f = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()

/** The draft the cookie points at, when the applicant may still edit it; otherwise back to the start (or the status page). */
const requireEditable = async () => {
  const app = await currentDraft()
  if (!app) redirect(`${JOIN}?error=expired`)
  if (!editable(app)) redirect(`${JOIN}/status?a=${encodeURIComponent(app.number)}&k=${encodeURIComponent(app.resumeKey)}`)
  return app
}

const setJoinCookie = async (key: string) => {
  const jar = await cookies()
  jar.set(JOIN_COOKIE, key, { httpOnly: true, sameSite: 'lax', secure: secure(), path: PATH, maxAge: 60 * 60 * 24 * 30 })
}

const withErrors = (path: string, errors: Record<string, string>): never => {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(errors)) u.set(`e.${k}`, v)
  redirect(`${path}?${u.toString()}`)
}

/** Step 1: the partner type starts a draft (or changes the type of the one in the cookie). */
export async function startApplication(form: FormData): Promise<void> {
  const type = f(form, 'type')
  const settings = await getPartnerSettings()
  if (!isPartnerType(type) || !settings.partnerTypes.includes(type)) return withErrors(JOIN, { type: 'Pick one of the partner types.' })
  const existing = await currentDraft()
  if (existing && editable(existing)) {
    if (existing.type !== type) await saveType(existing, type)
  } else {
    const app = await createDraft(type)
    await setJoinCookie(app.resumeKey)
  }
  redirect(`${JOIN}/company`)
}

/** Step 2: company, contact and regions; then the code to the contact email, unless it is already verified and unchanged. */
export async function saveDetailsAction(form: FormData): Promise<void> {
  const app = await requireEditable()
  const settings = await getPartnerSettings()
  const year = Number(f(form, 'yearOfIncorporation'))
  const company: Company = {
    legalName: f(form, 'legalName'),
    tradeName: f(form, 'tradeName'),
    address: f(form, 'address'),
    city: f(form, 'city'),
    state: f(form, 'state'),
    country: f(form, 'country') || EMPTY_COMPANY.country,
    pin: f(form, 'pin'),
    website: f(form, 'website'),
    yearOfIncorporation: Number.isInteger(year) && year > 0 ? year : null,
    size: f(form, 'size') as SizeBand | '',
    turnover: f(form, 'turnover') as TurnoverBand | '',
    gstin: f(form, 'gstin').toUpperCase(),
    pan: f(form, 'pan').toUpperCase(),
  }
  const contact = { name: f(form, 'contactName'), designation: f(form, 'contactDesignation'), email: normaliseEmail(f(form, 'contactEmail')), mobile: f(form, 'contactMobile') }
  const regions = form.getAll('regions').map(String).filter((r) => settings.regions.some((x) => x.code === r))
  // Save first so nothing typed is lost, then say what is missing.
  const saved = await saveDetails(app, company, contact, regions)
  const errors = { ...validateCompany(company), ...validateContact(contact), ...validateRegions(regions, settings.regions) }
  if (Object.keys(errors).length) withErrors(`${JOIN}/company`, errors)
  if (!mailAllowed(contact.email)) withErrors(`${JOIN}/company`, { contactEmail: 'This test system only sends codes to approved email addresses. Ask the portal team to add yours.' })
  if (saved.contact.emailVerifiedAt) redirect(`${JOIN}/terms`)
  await sendCodes(saved.contact.email, saved.contact.mobile)
  redirect(`${JOIN}/verify`)
}

/** Same rule as the doors: the on-screen code is for the developer's own machine, or a host with the allowlist set. */
const showCodeHere = async (): Promise<boolean> => {
  if (process.env.SUPPORT_DEV_SHOW_CODE !== '1' || process.env.NODE_ENV === 'production' || mailConfigured()) return false
  if (mailAllowlist()) return true
  const h = await headers()
  if (h.get('x-forwarded-for') || h.get('x-forwarded-proto') || h.get('x-forwarded-host')) return false
  const host = (h.get('host') ?? '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

const sendCodes = async (email: string, mobile: string): Promise<void> => {
  if (!canSend(email)) redirect(`${JOIN}/verify?error=rate`)
  const { code, token } = issueOtp({ email, purpose: 'partner-join', mobile })
  const jar = await cookies()
  jar.set(OTP_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: secure(), path: PATH, maxAge: OTP_TTL_SECONDS })
  const settings = await getPartnerSettings()
  const r = await sendMail({
    to: email,
    from: settings.notify.mailFrom,
    subject: `${code} is your K7 Partner Programme code`,
    text: `Your one-time code is ${code}. It is valid for 10 minutes.\n\nUse it to confirm the primary contact's email on your application to the K7 Partner Programme. If you did not ask for this, ignore this email.\n\nK7 Partner Programme`,
    html: `<p style="font:16px/1.5 Arial,sans-serif">Your one-time code is</p><p style="font:600 32px/1 'Courier New',monospace;letter-spacing:.2em">${code}</p><p style="font:14px/1.5 Arial,sans-serif;color:#555">Valid for 10 minutes. Use it to confirm the primary contact&rsquo;s email on your application to the K7 Partner Programme. If you did not ask for this, ignore this email.</p>`,
  })
  // One code for both channels: the email is the proof; the SMS, when a gateway exists, is a convenience with the same code.
  if (smsConfigured() && isMobile(mobile)) await sendSms(normaliseMobile(mobile), smsCodeText(code))
  if (!r.sent && (await showCodeHere())) jar.set(DEVCODE_COOKIE, code, { httpOnly: true, sameSite: 'lax', secure: secure(), path: PATH, maxAge: OTP_TTL_SECONDS })
  else jar.delete(DEVCODE_COOKIE)
}

/** Step 3: the code. A right code verifies the email; the mobile is verified through SMS when a gateway sent it, else skipped. */
export async function verifyJoinCode(form: FormData): Promise<void> {
  const app = await requireEditable()
  const code = f(form, 'code').replace(/\D/g, '')
  const jar = await cookies()
  const check = verifyOtp(jar.get(OTP_COOKIE)?.value, code)
  if (!check.ok) redirect(`${JOIN}/verify?error=${check.reason}`)
  if (check.payload.email !== app.contact.email) redirect(`${JOIN}/verify?error=expired`)
  jar.delete(OTP_COOKIE)
  jar.delete(DEVCODE_COOKIE)
  await markVerified(app, { email: true, mobile: smsConfigured() && isMobile(app.contact.mobile) ? 'sms' : 'skipped' })
  redirect(`${JOIN}/terms`)
}

export async function resendJoinCode(): Promise<void> {
  const app = await requireEditable()
  if (!app.contact.email) redirect(`${JOIN}/company`)
  await sendCodes(app.contact.email, app.contact.mobile)
  redirect(`${JOIN}/verify?resent=1`)
}

/** Step 4: the terms, then Submitted. */
export async function submitApplicationAction(form: FormData): Promise<void> {
  const app = await requireEditable()
  const settings = await getPartnerSettings()
  if (form.get('accept') !== '1') withErrors(`${JOIN}/terms`, { accept: 'Tick the box to accept the programme terms.' })
  const r = await submitApplication(app, settings.terms.version)
  if (!r.ok) {
    const first = Object.values(r.errors)[0] ?? 'Something is missing.'
    if (r.errors.emailVerified) redirect(`${JOIN}/company?e.contactEmail=${encodeURIComponent('Verify the contact email first.')}`)
    if (r.errors.status) withErrors(`${JOIN}/terms`, { status: r.errors.status })
    redirect(`${JOIN}/company?e.form=${encodeURIComponent(first)}`)
  }
  const jar = await cookies()
  jar.delete(JOIN_COOKIE)
  redirect(`${JOIN}/submitted?a=${encodeURIComponent(r.app.number)}&k=${encodeURIComponent(r.app.resumeKey)}`)
}

/** From the status page after a clarification request: the emailed link's key becomes the join cookie and the steps reopen. */
export async function resumeApplication(form: FormData): Promise<void> {
  const number = f(form, 'a')
  const key = f(form, 'k')
  const app = await findByNumber(number)
  if (!app || !key || app.resumeKey !== key) redirect(`${JOIN}/status?error=link`)
  if (!editable(app)) redirect(`${JOIN}/status?a=${encodeURIComponent(number)}&k=${encodeURIComponent(key)}`)
  await setJoinCookie(app.resumeKey)
  redirect(`${JOIN}/company`)
}

/** Start over: forget the draft in the cookie (the row stays as a draft nobody sees). */
export async function abandonDraft(): Promise<void> {
  const jar = await cookies()
  jar.delete(JOIN_COOKIE)
  jar.delete(OTP_COOKIE)
  jar.delete(DEVCODE_COOKIE)
  redirect(JOIN)
}

/** The development code, when the portal cannot send mail. */
export async function devJoinCode(): Promise<string | null> {
  if (process.env.NODE_ENV === 'production') return null
  return (await cookies()).get(DEVCODE_COOKIE)?.value ?? null
}
