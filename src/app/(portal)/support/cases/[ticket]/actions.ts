'use server'

import { redirect } from 'next/navigation'

import { userMessage } from '@/lib/dataverse/errors'
import { getCustomerCase, reopenCustomerCase, setStatusReason } from '@/lib/support/cases'
import { asScore, recordResponse, snapshotOf } from '@/lib/support/csat'
import { getSettings } from '@/lib/support/kpi-config'
import { STATE, STATUS } from '@/lib/support/options'
import { requireCustomer } from '@/lib/support/session'
import { canReopen } from '@/lib/support/status'
import { NOTE_FROM_CUSTOMER, addNote } from '@/lib/support/timeline'

/* A customer's replies and reopen requests. Every action re-reads the case through the customer's scope first,
   so a guessed case number never reaches a write. */

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = /^(image\/(png|jpeg|gif|webp)|application\/(pdf|zip|x-zip-compressed)|text\/(plain|csv|log)|application\/octet-stream)$/i

const casePath = (ticket: string, q?: Record<string, string>) => `/support/cases/${encodeURIComponent(ticket)}${q ? `?${new URLSearchParams(q).toString()}` : ''}`

export async function replyToCase(form: FormData): Promise<void> {
  const ticket = String(form.get('ticket') ?? '').trim().toUpperCase()
  const text = String(form.get('text') ?? '').trim().slice(0, 8000)
  const file = form.get('file')
  const ctx = await requireCustomer(casePath(ticket))
  const c = await getCustomerCase(ctx.auth, ctx.scope, ticket)
  if (!c) redirect('/support/cases')

  const hasFile = file instanceof File && file.size > 0
  if (text.length < 2 && !hasFile) redirect(casePath(ticket, { error: 'empty' }) + '#reply')
  if (c.statecode === STATE.CANCELED) redirect(casePath(ticket, { error: 'closed' }))

  let attachment: { name: string; mime: string; base64: string } | undefined
  if (hasFile) {
    if (file.size > MAX_ATTACHMENT_BYTES) redirect(casePath(ticket, { error: 'file-size' }) + '#reply')
    const mime = file.type || 'application/octet-stream'
    if (!ALLOWED_MIME.test(mime)) redirect(casePath(ticket, { error: 'file-type' }) + '#reply')
    attachment = { name: file.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 200) || 'attachment', mime, base64: Buffer.from(await file.arrayBuffer()).toString('base64') }
  }

  try {
    await addNote(ctx.auth, c.incidentid, { subject: NOTE_FROM_CUSTOMER, text: text || `Attached: ${attachment?.name ?? 'file'}`, file: attachment })
    // A resolved case that gets a reply within the window comes back to the desk; a case waiting on the customer goes back to support.
    if (c.statecode === STATE.RESOLVED && canReopen(c.statecode, c.modifiedon)) {
      await reopenCustomerCase(ctx.auth, ctx.scope, ticket)
    } else if (c.statuscode === STATUS.IN_PROGRESS_CUSTOMER) {
      await setStatusReason(ctx.auth, c.incidentid, STATUS.IN_PROGRESS_SUPPORT)
    }
  } catch (e) {
    redirect(casePath(ticket, { error: 'failed', message: userMessage(e, 'customer') }) + '#reply')
  }
  redirect(casePath(ticket, { replied: '1' }) + '#conversation')
}

export async function reopenCase(form: FormData): Promise<void> {
  const ticket = String(form.get('ticket') ?? '').trim().toUpperCase()
  const ctx = await requireCustomer(casePath(ticket))
  const c = await getCustomerCase(ctx.auth, ctx.scope, ticket)
  if (!c) redirect('/support/cases')
  if (!canReopen(c.statecode, c.modifiedon)) redirect(casePath(ticket, { error: 'reopen-window' }))
  try {
    await reopenCustomerCase(ctx.auth, ctx.scope, ticket)
    await addNote(ctx.auth, c.incidentid, { subject: NOTE_FROM_CUSTOMER, text: 'The customer reopened this case from the support portal.' })
  } catch (e) {
    redirect(casePath(ticket, { error: 'failed', message: userMessage(e, 'customer') }))
  }
  redirect(casePath(ticket, { reopened: '1' }))
}

/** The customer rates a closed case from its page (09-portal-guide.md §4d). The row is keyed by case; rating again changes it. */
export async function rateCase(form: FormData): Promise<void> {
  const ticket = String(form.get('ticket') ?? '').trim().toUpperCase()
  const score = asScore(form.get('score'))
  const comment = String(form.get('comment') ?? '').trim().slice(0, 2000)
  const ctx = await requireCustomer(casePath(ticket))
  const c = await getCustomerCase(ctx.auth, ctx.scope, ticket)
  if (!c) redirect('/support/cases')
  if (c.statecode !== STATE.RESOLVED) redirect(casePath(ticket, { error: 'not-closed' }) + '#rate')
  if (!score) redirect(casePath(ticket, { error: 'score' }) + '#rate')
  const settings = await getSettings()
  try {
    await recordResponse(snapshotOf(c), { score, comment, source: 'portal', contactId: ctx.scope.contactId, email: ctx.scope.email }, { settings, auth: ctx.auth })
  } catch (e) {
    redirect(casePath(ticket, { error: 'failed', message: userMessage(e, 'customer') }) + '#rate')
  }
  redirect(casePath(ticket, { rated: '1' }) + '#rate')
}
