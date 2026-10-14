'use server'

import { redirect } from 'next/navigation'

import { userMessage } from '@/lib/dataverse/errors'
import { classifyResponse } from '@/lib/support/csat'
import { requireManager } from '@/lib/support/session'

/* A manager says what a low score was about from the ledger (09-portal-guide.md §4e): the desk's classification, which wins over
   the customer's own pick on the survey. Nothing is written to Dynamics. */

const PATH = '/support/workspace/manage/unhappy'

const str = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (form: FormData, q: string): never => {
  const ret = str(form, 'return')
  redirect(`${ret.startsWith(PATH) ? ret : PATH}${ret.includes('?') ? '&' : '?'}${q}#ledger`)
}

export async function classifyAction(form: FormData): Promise<void> {
  const me = await requireManager()
  const id = str(form, 'id')
  const reason = str(form, 'reason')
  let msg: string | null = null
  try {
    const r = await classifyResponse(id, reason, { id: me.userId, name: me.name || me.email })
    if (!r) msg = 'That rating no longer exists.'
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) back(form, `error=${encodeURIComponent(msg)}`)
  back(form, reason ? 'ok=classified' : 'ok=cleared')
}
