'use server'

import { redirect } from 'next/navigation'

import { userMessage } from '@/lib/dataverse/errors'
import { closeFollowUp, csatById, reopenFollowUp, takeFollowUp } from '@/lib/support/csat'
import { requireManager } from '@/lib/support/session'
import { addNote } from '@/lib/support/timeline'

/* The follow-up queue (09-portal-guide.md §4d): a manager takes an unhappy customer, closes the follow-up with what was agreed,
   or reopens one. The internal note on the case runs as the signed-in manager through the guarded client. */

const PATH = '/support/workspace/manage/csat'

const str = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (form: FormData, q: string): never => {
  const ret = str(form, 'return')
  redirect(`${ret.startsWith(PATH) ? ret : PATH}${ret.includes('?') ? '&' : '?'}${q}#follow-ups`)
}

export async function takeFollowUpAction(form: FormData): Promise<void> {
  const me = await requireManager()
  const id = str(form, 'id')
  let msg: string | null = null
  try {
    const r = await takeFollowUp(id, { id: me.userId, name: me.name || me.email })
    if (!r) msg = 'That follow-up no longer exists.'
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) back(form, `error=${encodeURIComponent(msg)}`)
  back(form, 'ok=taken')
}

export async function closeFollowUpAction(form: FormData): Promise<void> {
  const me = await requireManager()
  const id = str(form, 'id')
  const note = str(form, 'note')
  const caseNote = form.get('caseNote') === '1'
  if (note.length < 3) back(form, 'error=Say%20in%20a%20line%20what%20you%20agreed%20with%20the%20customer.')
  let msg: string | null = null
  try {
    const row = await csatById(id)
    if (!row) msg = 'That follow-up no longer exists.'
    else {
      await closeFollowUp(id, { id: me.userId, name: me.name || me.email }, note)
      if (caseNote) await addNote(me.auth, row.caseId, { subject: `CSAT follow-up closed by ${me.name || 'a manager'}`, text: note }).catch(() => undefined)
    }
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) back(form, `error=${encodeURIComponent(msg)}`)
  back(form, 'ok=closed')
}

export async function reopenFollowUpAction(form: FormData): Promise<void> {
  await requireManager()
  const id = str(form, 'id')
  let msg: string | null = null
  try {
    const r = await reopenFollowUp(id)
    if (!r) msg = 'That rating no longer exists.'
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) back(form, `error=${encodeURIComponent(msg)}`)
  back(form, 'ok=reopened')
}
