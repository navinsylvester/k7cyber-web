'use server'

import { redirect } from 'next/navigation'

import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { addCaseToQueue, assignCase, getCase } from '@/lib/support/cases'
import { getSettings } from '@/lib/support/kpi-config'
import { runSweep } from '@/lib/support/prevention'
import { requireManager } from '@/lib/support/session'
import { addNote } from '@/lib/support/timeline'

/* Quick actions on the at-risk board (09-portal-guide.md §4c): reassign, remind, queue, and run the sweep by hand.
   Every write runs as the signed-in manager through the domain layer, so Dynamics rights and the production guard apply. */

const PATH = '/support/workspace/manage/at-risk'

const str = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (form: FormData, q: string): never => {
  const ret = str(form, 'return')
  redirect(`${ret.startsWith(PATH) ? ret : PATH}${ret.includes('?') ? '&' : '?'}${q}`)
}

export async function reassignAction(form: FormData): Promise<void> {
  const me = await requireManager()
  const id = str(form, 'id')
  const raw = form.get('me') === '1' ? `user:${me.userId}` : str(form, 'owner')
  const [kind, ownerId] = raw.split(':')
  if (!isGuid(id) || (kind !== 'user' && kind !== 'team') || !isGuid(ownerId ?? '')) back(form, 'error=Pick%20an%20engineer%20or%20a%20team.')
  let msg: string | null = null
  try {
    await assignCase(me.auth, id, { kind: kind as 'user' | 'team', id: ownerId! })
  } catch (e) {
    msg = (e as { status?: number }).status === 403 ? 'That agent or team cannot own cases in this environment (no security role).' : userMessage(e, 'agent')
  }
  if (msg) back(form, `error=${encodeURIComponent(msg)}`)
  back(form, 'ok=reassigned')
}

export async function nudgeAction(form: FormData): Promise<void> {
  const me = await requireManager()
  const id = str(form, 'id')
  const text = str(form, 'text') || 'Please pick this case up: it is at risk of missing its target.'
  if (!isGuid(id)) back(form, 'error=Unknown%20case.')
  let msg: string | null = null
  try {
    const c = await getCase(me.auth, id)
    if (!c) msg = 'That case no longer exists.'
    else await addNote(me.auth, id, { subject: `SLA watch: reminder from ${me.name || 'a manager'}`, text })
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) back(form, `error=${encodeURIComponent(msg)}`)
  back(form, 'ok=nudged')
}

export async function queueAction(form: FormData): Promise<void> {
  const me = await requireManager()
  const id = str(form, 'id')
  const queueId = str(form, 'queue')
  if (!isGuid(id) || !isGuid(queueId)) back(form, 'error=Pick%20a%20queue.')
  let msg: string | null = null
  try {
    await addCaseToQueue(me.auth, id, queueId)
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg) back(form, `error=${encodeURIComponent(msg)}`)
  back(form, 'ok=queued')
}

export async function sweepAction(form: FormData): Promise<void> {
  const me = await requireManager()
  const live = form.get('live') === '1'
  const settings = await getSettings()
  if (live && !settings.sweep.live) back(form, 'error=Live%20sweeps%20are%20switched%20off%20in%20KPI%20settings.')
  let q: string
  try {
    const r = await runSweep(me.auth, { actor: me.email || me.name || 'manager', live })
    q = `ok=sweep&run=${encodeURIComponent(r.runId)}&fired=${r.fired}&done=${r.done}&skipped=${r.skipped}&failed=${r.failed}&mode=${r.mode}${r.csat ? `&csatInvited=${r.csat.invited}&csatReminded=${r.csat.reminded}&csatOverdue=${r.csat.overdue}` : ''}`
  } catch (e) {
    q = `error=${encodeURIComponent(userMessage(e, 'agent'))}`
  }
  back(form, q)
}
