'use server'

import { redirect } from 'next/navigation'

import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { addCaseToQueue, assignCase, cancelCase, getCase, reopenCase, resolveCase, setStatusReason, updateCase, type NewCase } from '@/lib/support/cases'
import { ACTIVE_STATUS_REASONS, STATE, STATUS } from '@/lib/support/options'
import { createRfe } from '@/lib/support/rfe'
import { requireAgent } from '@/lib/support/session'
import { addNote, addPhoneCall, addTask, NOTE_TO_CUSTOMER, sendEmailReply } from '@/lib/support/timeline'

/* Every case action: validate, call the domain layer as the signed-in agent, then redirect back to the case with
   `?ok=` or `?error=`. `redirect` throws, so it is called outside the try blocks. */

const WS = '/support/workspace'
const MAX_FILE = 5 * 1024 * 1024

const str = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const num = (form: FormData, k: string): number | undefined => {
  const v = str(form, k)
  return v === '' ? undefined : Number(v)
}
const optGuid = (form: FormData, k: string): string | undefined => {
  const v = str(form, k)
  return isGuid(v) ? v : undefined
}

const caseId = (form: FormData): string => {
  const id = str(form, 'id')
  if (!isGuid(id)) redirect(`${WS}/cases`)
  return id
}

const done = (id: string, ok: string, tab?: string): never => redirect(`${WS}/cases/${id}?ok=${ok}${tab ? `&tab=${tab}` : ''}`)
const fail = (id: string, message: string, tab?: string): never => redirect(`${WS}/cases/${id}?error=${encodeURIComponent(message)}${tab ? `&tab=${tab}` : ''}`)

const fileFromForm = async (form: FormData, k: string): Promise<{ name: string; mime: string; base64: string } | undefined | 'too-large'> => {
  const f = form.get(k)
  if (!(f instanceof File) || f.size === 0) return undefined
  if (f.size > MAX_FILE) return 'too-large'
  return { name: f.name, mime: f.type || 'application/octet-stream', base64: Buffer.from(await f.arrayBuffer()).toString('base64') }
}

export async function addNoteAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  const text = str(form, 'text')
  const subjectIn = str(form, 'subject')
  const visible = form.get('visible') === '1'
  const file = await fileFromForm(form, 'file')
  let msg: string | null = null
  if (!text && !file) msg = 'Write a note or attach a file.'
  else if (file === 'too-large') msg = 'Attachments are limited to 5 MB.'
  if (msg) fail(id, msg)
  const subject = visible ? `${NOTE_TO_CUSTOMER}${subjectIn ? `: ${subjectIn}` : ''}` : subjectIn || (file && file !== 'too-large' ? `Attachment: ${file.name}` : 'Note')
  try {
    await addNote(me.auth, id, { subject, text, file: file === 'too-large' ? undefined : file })
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg)
  done(id, 'note')
}

export async function replyAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  const text = str(form, 'text')
  const wait = form.get('wait') === '1'
  let msg: string | null = null
  if (text.length < 2) msg = 'Write the reply first.'
  if (msg) fail(id, msg)
  try {
    const c = await getCase(me.auth, id)
    if (!c) msg = 'That case no longer exists.'
    else {
      await addNote(me.auth, id, { subject: `${NOTE_TO_CUSTOMER}: ${text.slice(0, 60).replace(/\s+/g, ' ')}`, text })
      if (wait && c.statecode === STATE.ACTIVE && c.statuscode !== STATUS.IN_PROGRESS_CUSTOMER) await setStatusReason(me.auth, id, STATUS.IN_PROGRESS_CUSTOMER)
    }
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg)
  done(id, 'reply')
}

export async function statusAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  const code = num(form, 'statuscode')
  let msg: string | null = null
  if (!code || !ACTIVE_STATUS_REASONS.some((s) => s.value === code)) msg = 'Pick a status reason.'
  if (msg) fail(id, msg)
  try {
    const c = await getCase(me.auth, id)
    if (!c) msg = 'That case no longer exists.'
    else if (c.statecode !== STATE.ACTIVE) msg = 'Reopen the case before changing its status reason.'
    else await setStatusReason(me.auth, id, code!)
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg)
  done(id, 'status')
}

export async function assignAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  const toMe = form.get('me') === '1'
  const raw = toMe ? `user:${me.userId}` : str(form, 'owner')
  const [kind, ownerId] = raw.split(':')
  let msg: string | null = null
  if ((kind !== 'user' && kind !== 'team') || !isGuid(ownerId ?? '')) msg = 'Pick an agent or a team.'
  if (msg) fail(id, msg)
  try {
    await assignCase(me.auth, id, { kind: kind as 'user' | 'team', id: ownerId! })
  } catch (e) {
    // A 403 here is almost always the assignee: seven UAT agents have no security role and cannot own cases.
    msg = (e as { status?: number }).status === 403 ? 'That agent or team cannot own cases in this environment (no security role). Pick another.' : userMessage(e, 'agent')
  }
  if (msg) fail(id, msg)
  done(id, 'assign')
}

export async function resolveAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  const status = num(form, 'status')
  const subject = str(form, 'subject')
  const remarks = str(form, 'remarks')
  const minutes = num(form, 'minutes')
  let msg: string | null = null
  if (status !== STATUS.CLOSED_CALL && status !== STATUS.CLOSED_REMOTE) msg = 'Choose how the case was closed.'
  else if (subject.length < 3) msg = 'Say in a line what resolved it.'
  if (msg) fail(id, msg)
  try {
    const c = await getCase(me.auth, id)
    if (!c) msg = 'That case no longer exists.'
    else if (c.statecode !== STATE.ACTIVE) msg = 'Only an active case can be resolved.'
    else await resolveCase(me.auth, id, { status: status as typeof STATUS.CLOSED_CALL | typeof STATUS.CLOSED_REMOTE, subject, remarks: remarks || undefined, minutes: minutes && minutes > 0 ? Math.round(minutes) : undefined })
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg)
  done(id, 'resolve')
}

export async function cancelAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  let msg: string | null = null
  if (form.get('confirm') !== '1') msg = 'Tick the box to confirm the cancellation.'
  if (msg) fail(id, msg)
  try {
    const c = await getCase(me.auth, id)
    if (!c) msg = 'That case no longer exists.'
    else if (c.statecode !== STATE.ACTIVE) msg = 'Only an active case can be cancelled.'
    else await cancelCase(me.auth, id)
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg)
  done(id, 'cancel')
}

export async function reopenAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  let msg: string | null = null
  try {
    const c = await getCase(me.auth, id)
    if (!c) msg = 'That case no longer exists.'
    else if (c.statecode === STATE.ACTIVE) msg = 'The case is already active.'
    else await reopenCase(me.auth, id)
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg)
  done(id, 'reopen')
}

export async function queueAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  const queueId = optGuid(form, 'queueId')
  let msg: string | null = null
  if (!queueId) msg = 'Pick a queue.'
  if (msg) fail(id, msg)
  try {
    await addCaseToQueue(me.auth, id, queueId!)
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg)
  done(id, 'queue')
}

export async function callAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  const subject = str(form, 'subject')
  const description = str(form, 'description')
  const outgoing = str(form, 'direction') !== 'in'
  const minutes = num(form, 'minutes')
  let msg: string | null = null
  if (subject.length < 2) msg = 'Give the call a subject.'
  if (msg) fail(id, msg)
  try {
    await addPhoneCall(me.auth, id, { subject, description: description || undefined, outgoing, minutes: minutes && minutes > 0 ? Math.round(minutes) : undefined })
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg)
  done(id, 'call')
}

export async function taskAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  const subject = str(form, 'subject')
  const description = str(form, 'description')
  const due = str(form, 'due')
  let msg: string | null = null
  if (subject.length < 2) msg = 'Give the task a subject.'
  else if (due && Number.isNaN(Date.parse(due))) msg = 'The due date is not valid.'
  if (msg) fail(id, msg)
  try {
    await addTask(me.auth, id, { subject, description: description || undefined, due: due ? new Date(due).toISOString() : undefined })
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg)
  done(id, 'task')
}

/** Edit details: only the fields whose submitted value differs from the record are sent. */
export async function editAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  let msg: string | null = null
  const title = str(form, 'title')
  if (title.length < 3) msg = 'The title needs at least three characters.'
  if (msg) fail(id, msg, 'details')
  try {
    const c = await getCase(me.auth, id)
    if (!c) msg = 'That case no longer exists.'
    else {
      const patch: Partial<NewCase> = {}
      const cur = (k: string) => (c[k] === null || c[k] === undefined ? '' : String(c[k]))
      const text = (k: keyof NewCase, col: string) => {
        const v = str(form, k as string)
        if (v !== cur(col)) (patch as Record<string, unknown>)[k] = v
      }
      const pick = (k: keyof NewCase, col: string) => {
        const v = num(form, k as string)
        const current = c[col] === null || c[col] === undefined ? undefined : Number(c[col])
        if (v !== current) (patch as Record<string, unknown>)[k] = v ?? null
      }
      const look = (k: keyof NewCase, col: string) => {
        const v = str(form, k as string)
        const current = cur(col).toLowerCase()
        if (v.toLowerCase() !== current) (patch as Record<string, unknown>)[k] = isGuid(v) ? v : ''
      }
      text('title', 'title')
      text('description', 'description')
      text('productVersion', 'k7_productversion')
      text('serial', 'k7_2ndserialnumber')
      text('module', 'k7_module')
      text('submodule', 'k7_submodule')
      text('customerEmail', 'k7_customeremail')
      text('stepsToReproduce', 'adx_stepstoreproduce')
      pick('vertical', 'new_verticaltype')
      pick('customerType', 'new_customertype')
      pick('priority', 'prioritycode')
      pick('caseType', 'casetypecode')
      pick('consideredAs', 'k7_caseconsideredas')
      pick('category', 'new_category')
      look('productId', '_productid_value')
      look('categoryId', '_new_issue_value')
      look('subcategoryId', '_new_subcategory_value')
      // A choice cleared to nothing cannot be sent as undefined; drop those (Dataverse keeps the value), lookups cleared are dropped by caseBody.
      for (const k of Object.keys(patch)) if ((patch as Record<string, unknown>)[k] === null) delete (patch as Record<string, unknown>)[k]
      if (Object.keys(patch).length === 0) msg = 'Nothing changed.'
      else await updateCase(me.auth, id, patch)
    }
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg, 'details')
  done(id, 'edit', 'details')
}

export async function rfeAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  const title = str(form, 'title')
  const type = num(form, 'type')
  const yodizId = str(form, 'yodizId')
  const users = str(form, 'users')
  let msg: string | null = null
  if (title.length < 3) msg = 'Give the RFE a title.'
  else if (!type) msg = 'Pick the RFE type.'
  if (msg) fail(id, msg, 'related')
  try {
    const c = await getCase(me.auth, id)
    if (!c) msg = 'That case no longer exists.'
    else {
      const customerIsAccount = String(c['_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname'] ?? '') === 'account'
      await createRfe(me.auth, {
        title,
        type: type!,
        yodizId: yodizId || undefined,
        users: users || undefined,
        serial: c.k7_2ndserialnumber ? String(c.k7_2ndserialnumber) : undefined,
        caseId: id,
        productId: c._productid_value ? String(c._productid_value) : undefined,
        accountId: customerIsAccount && c._customerid_value ? String(c._customerid_value) : undefined,
        vertical: typeof c.new_verticaltype === 'number' ? c.new_verticaltype : undefined,
      })
    }
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg, 'related')
  done(id, 'rfe', 'related')
}

export async function emailAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = caseId(form)
  const to = str(form, 'to')
  const subject = str(form, 'subject')
  const text = str(form, 'text')
  let msg: string | null = null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) msg = 'Enter a valid recipient address.'
  else if (!subject) msg = 'Give the email a subject.'
  else if (text.length < 2) msg = 'Write the email first.'
  if (msg) fail(id, msg)
  let sent = false
  try {
    const r = await sendEmailReply(me.auth, id, { to, subject, text, fromUserId: me.userId })
    sent = r.sent
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) fail(id, msg)
  done(id, sent ? 'email' : 'email-draft')
}
