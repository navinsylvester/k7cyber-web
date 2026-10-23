'use server'

import { redirect } from 'next/navigation'

import { digestPass, resetTemplate, saveTemplate, sendTestNotification } from '@/lib/partner/notify'
import { isDelivery, isEventKey, validateTemplate } from '@/lib/partner/notify-model'
import { requireK7Role } from '@/lib/partner/session'

/* The Channel Manager's levers on the templates page (FR-NTF-01, M8): save an event's template, put it back to the code's
   text, send a test to their own address, and run the daily digest by hand. */

const PATH = '/partners/portal/k7/notifications/templates'
const ROLES = ['channelManager'] as const
const f = (form: FormData, k: string): string => String(form.get(k) ?? '')
const back = (event: string, q: Record<string, string>): never => redirect(`${PATH}?${new URLSearchParams({ event, ...q }).toString()}`)

export async function saveTemplateAction(form: FormData): Promise<void> {
  const me = await requireK7Role([...ROLES], PATH)
  const event = f(form, 'event')
  if (!isEventKey(event)) redirect(PATH)
  const t = { enabled: form.get('enabled') === '1', delivery: isDelivery(f(form, 'delivery')) ? (f(form, 'delivery') as 'immediate') : ('immediate' as const), subject: f(form, 'subject').trim(), body: f(form, 'body').replace(/\r\n/g, '\n').trim() }
  const errors = validateTemplate(t, event)
  if (Object.keys(errors).length) return back(event, { error: Object.values(errors).join(' ') })
  try {
    await saveTemplate(event, t, me.email || me.name)
  } catch (e) {
    return back(event, { error: `Could not save: ${(e as Error).message.slice(0, 160)}` })
  }
  back(event, { ok: 'Saved. The next notification of this event uses it.' })
}

export async function resetTemplateAction(form: FormData): Promise<void> {
  await requireK7Role([...ROLES], PATH)
  const event = f(form, 'event')
  if (!isEventKey(event)) redirect(PATH)
  const removed = await resetTemplate(event)
  back(event, { ok: removed ? 'Back to the code’s text and the catalogue’s delivery.' : 'There was no template to remove.' })
}

export async function sendTestAction(form: FormData): Promise<void> {
  const me = await requireK7Role([...ROLES], PATH)
  const event = f(form, 'event')
  if (!isEventKey(event)) redirect(PATH)
  if (!me.email) return back(event, { error: 'Your session has no email address to send to.' })
  try {
    const r = await sendTestNotification(event, me.email, me.name)
    back(event, r.sent ? { ok: `Sent to ${me.email}: “${r.subject}”.` } : r.suppressed ? { error: `${me.email} is not on SUPPORT_MAIL_ALLOWLIST, so nothing was sent. The rendered subject: “${r.subject}”.` } : { error: `No SMTP_URL is set, so nothing left the server; the rendered mail is in the server log. Subject: “${r.subject}”.` })
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    back(event, { error: `Could not send: ${(e as Error).message.slice(0, 160)}` })
  }
}

export async function runDigestAction(form: FormData): Promise<void> {
  await requireK7Role([...ROLES], PATH)
  const event = f(form, 'event')
  try {
    const r = await digestPass()
    back(event, { ok: `Digest: ${r.mails} email${r.mails === 1 ? '' : 's'} for ${r.rows} row${r.rows === 1 ? '' : 's'}${r.suppressed.length ? ` · ${r.suppressed.length} suppressed by the allowlist` : ''}${r.errors.length ? ` · ${r.errors.length} failed` : ''} · ${r.removed} old read row${r.removed === 1 ? '' : 's'} removed.` })
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    back(event, { error: `The digest failed: ${(e as Error).message.slice(0, 160)}` })
  }
}
