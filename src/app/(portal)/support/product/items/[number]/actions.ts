'use server'

import { redirect } from 'next/navigation'

import { isGuid } from '@/lib/dataverse/odata'
import { EVIDENCE_MAX, EVIDENCE_MIME } from '@/collections/support/ProductEvidence'
import { getProductSettings } from '@/lib/support/product-config'
import { acceptItem, answerQuestion, askSupport, asDeclineReason, asPriority, asTeam, backToTracked, closeItem, commentOn, declineItem, getItem, itemPath, markFixed, markReleased, markTold, reopenItem, rerouteItem, setPriority, setTrackerKey, unlinkCase, type Actor, type EvidenceFile, type ItemRow, type Side } from '@/lib/support/product'
import { retryMirror } from '@/lib/support/product-mirror'
import { isPrincipal, requireAgent, type AgentContext } from '@/lib/support/session'
import { addNote, NOTE_TO_CUSTOMER } from '@/lib/support/timeline'

/* Every action on a product item: find the item by number, decide which side the signed-in agent acts as (principal support or the
   desk), call the domain layer, then redirect back with `?ok=` or `?error=`. A `return` field sends the reader back to where they
   acted from (the case page, the workspace tab) when it is a portal path. `redirect` throws, so it is called outside try blocks. */

const str = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()

const back = (form: FormData, number: string, q: string): never => {
  const ret = str(form, 'return')
  const target = ret.startsWith('/support/') && !ret.includes('//') ? ret.split('?')[0]! : itemPath(number)
  redirect(`${target}?${q}`)
}
const ok = (form: FormData, number: string, msg: string): never => back(form, number, `ok=${encodeURIComponent(msg)}`)
const fail = (form: FormData, number: string, msg: string): never => back(form, number, `error=${encodeURIComponent(msg)}`)

const actor = (me: AgentContext): Actor => ({ id: me.userId, name: me.name || me.email, email: me.email, auth: me.auth })

const load = async (form: FormData): Promise<{ me: AgentContext; item: ItemRow; side: Side; principal: boolean; number: string }> => {
  const me = await requireAgent()
  const number = str(form, 'number')
  const item = await getItem(number)
  if (!item) redirect('/support/product/items?error=That%20item%20does%20not%20exist.')
  const principal = await isPrincipal(me)
  return { me, item, side: principal ? 'principal' : 'support', principal, number: item.number }
}

const filesFrom = async (form: FormData, k: string): Promise<EvidenceFile[] | string> => {
  const out: EvidenceFile[] = []
  for (const f of form.getAll(k)) {
    if (!(f instanceof File) || f.size === 0) continue
    if (f.size > EVIDENCE_MAX) return `${f.name} is over 10 MB.`
    const mime = f.type || 'application/octet-stream'
    if (!EVIDENCE_MIME.includes(mime) && !/\.(log|txt|json|csv)$/i.test(f.name)) return `${f.name}: only screenshots, logs, text, PDF and zip files are accepted. Samples go to the Lab store by script.`
    out.push({ name: f.name, mime, bytes: Buffer.from(await f.arrayBuffer()) })
  }
  return out
}

const result = (form: FormData, number: string, r: { item: ItemRow; mirror: { done: number; pending: number; skipped: number; failed: number } } | { error: string }, msg: string): never => {
  if ('error' in r) return fail(form, number, r.error)
  const m = r.mirror
  const tail = m.pending || m.failed || m.skipped ? ` CRM mirror: ${[m.done && `${m.done} written`, m.pending && `${m.pending} queued`, m.skipped && `${m.skipped} skipped`, m.failed && `${m.failed} failed`].filter(Boolean).join(', ')}.` : ''
  return ok(form, number, msg + tail)
}

export async function acceptAction(form: FormData): Promise<void> {
  const { me, item, principal, number } = await load(form)
  if (!principal) fail(form, number, 'Only principal support accepts items.')
  const team = asTeam(str(form, 'team'))
  const priority = asPriority(str(form, 'priority'))
  if (!team) fail(form, number, 'Pick the team.')
  if (!priority) fail(form, number, 'Pick a priority.')
  const r = await acceptItem(actor(me), item, { team: team!, priority: priority!, trackerKey: str(form, 'trackerKey'), productOwner: str(form, 'productOwner'), text: str(form, 'text') })
  result(form, number, r, `Accepted for ${team} at ${priority}.`)
}

export async function askAction(form: FormData): Promise<void> {
  const { me, item, principal, number } = await load(form)
  if (!principal) fail(form, number, 'Only principal support asks the desk from here.')
  const q = str(form, 'text')
  if (q.length < 5) fail(form, number, 'Write the question first.')
  result(form, number, await askSupport(actor(me), 'principal', item, q), 'Question sent to the desk; the support owner has a task on the case.')
}

export async function answerAction(form: FormData): Promise<void> {
  const { me, item, side, number } = await load(form)
  const a = str(form, 'text')
  if (a.length < 2) fail(form, number, 'Write the answer first.')
  result(form, number, await answerQuestion(actor(me), side, item, a), 'Answer recorded; the item is back with product.')
}

export async function commentAction(form: FormData): Promise<void> {
  const { me, item, side, number } = await load(form)
  const text = str(form, 'text')
  const files = await filesFrom(form, 'evidence')
  if (typeof files === 'string') fail(form, number, files)
  if (text.length < 2 && !(files as EvidenceFile[]).length) fail(form, number, 'Write a comment or attach a file.')
  await commentOn(actor(me), side, item, text, files as EvidenceFile[])
  ok(form, number, 'Comment added.')
}

export async function priorityAction(form: FormData): Promise<void> {
  const { me, item, principal, number } = await load(form)
  if (!principal) fail(form, number, 'Only principal support sets the priority.')
  const p = asPriority(str(form, 'priority'))
  if (!p) fail(form, number, 'Pick a priority.')
  await setPriority(actor(me), item, p!)
  ok(form, number, `Priority set to ${p}.`)
}

export async function rerouteAction(form: FormData): Promise<void> {
  const { me, item, principal, number } = await load(form)
  if (!principal) fail(form, number, 'Only principal support re-routes items.')
  const t = asTeam(str(form, 'team'))
  if (!t) fail(form, number, 'Pick the team.')
  await rerouteItem(actor(me), item, t!)
  ok(form, number, 'Item re-routed.')
}

export async function trackerAction(form: FormData): Promise<void> {
  const { me, item, principal, number } = await load(form)
  if (!principal) fail(form, number, 'Only principal support links the tracker.')
  const r = await setTrackerKey(actor(me), item, str(form, 'trackerKey'))
  if ('error' in r) fail(form, number, r.error)
  ok(form, number, 'Tracker reference saved.')
}

export async function fixedAction(form: FormData): Promise<void> {
  const { me, item, principal, number } = await load(form)
  if (!principal) fail(form, number, 'Only principal support records a fix here.')
  result(form, number, await markFixed(actor(me), 'principal', item, str(form, 'version'), str(form, 'text')), 'Marked fixed; the desk is told.')
}

export async function releasedAction(form: FormData): Promise<void> {
  const { me, item, principal, number } = await load(form)
  if (!principal) fail(form, number, 'Only principal support records a release here.')
  const version = str(form, 'version')
  if (!version) fail(form, number, 'Give the version (or VDB version) it shipped in.')
  result(form, number, await markReleased(actor(me), 'principal', item, version, str(form, 'text'), form.get('show') === '1'), `Released in ${version}. The desk can tell the customers now.`)
}

export async function backAction(form: FormData): Promise<void> {
  const { me, item, principal, number } = await load(form)
  if (!principal) fail(form, number, 'Only principal support moves an item back.')
  result(form, number, await backToTracked(actor(me), 'principal', item, str(form, 'text')), 'Back in progress.')
}

export async function declineAction(form: FormData): Promise<void> {
  const { me, item, principal, number } = await load(form)
  if (!principal) fail(form, number, 'Only principal support declines items.')
  const reason = asDeclineReason(str(form, 'reason'))
  const note = str(form, 'text')
  if (!reason) fail(form, number, 'Pick a reason.')
  if (note.length < 5) fail(form, number, 'Say in a sentence why, for the agent and the customer.')
  result(form, number, await declineItem(actor(me), 'principal', item, reason!, note), 'Declined; the desk is told.')
}

export async function closeAction(form: FormData): Promise<void> {
  const { me, item, side, number } = await load(form)
  result(form, number, await closeItem(actor(me), side, item, str(form, 'text')), 'Item closed.')
}

export async function reopenAction(form: FormData): Promise<void> {
  const { me, item, side, number } = await load(form)
  const text = str(form, 'text')
  if (text.length < 5) fail(form, number, 'Say why it is back.')
  result(form, number, await reopenItem(actor(me), side, item, text), 'Reopened; it is with principal support again.')
}

export async function retryMirrorAction(form: FormData): Promise<void> {
  const { me, item, number } = await load(form)
  const settings = await getProductSettings()
  const r = await retryMirror(item.id, me.auth, me.name || me.email, settings)
  ok(form, number, r.lines.length ? `Mirror retried: ${r.done} written, ${r.skipped} skipped, ${r.failed} failed, ${r.pending} still queued.` : 'Nothing was waiting.')
}

export async function unlinkAction(form: FormData): Promise<void> {
  const { me, item, principal, number } = await load(form)
  const caseId = str(form, 'caseId')
  if (!isGuid(caseId)) fail(form, number, 'Unknown case.')
  if (!principal && item.raisedBy.id !== me.userId) fail(form, number, 'Only principal support or the agent who raised it can unlink a case.')
  await unlinkCase(actor(me), item, caseId)
  ok(form, number, 'Case unlinked.')
}

/** The agent told the customer about the release; optionally posts the release line as a reply on the case. */
export async function toldAction(form: FormData): Promise<void> {
  const { me, item, number } = await load(form)
  const caseId = str(form, 'caseId')
  if (!isGuid(caseId)) fail(form, number, 'Unknown case.')
  const post = form.get('post') === '1'
  let msg = 'Recorded: the customer was told.'
  if (post) {
    const text = str(form, 'text') || `Good news: the issue behind this case is fixed${item.releasedVersion ? ` in version ${item.releasedVersion}` : ''}. ${item.releaseNote || 'Please update K7 and tell us if it persists.'}`
    try {
      await addNote(me.auth, caseId, { subject: `${NOTE_TO_CUSTOMER}: ${text.slice(0, 60).replace(/\s+/g, ' ')}`, text })
      msg = 'Reply posted on the case and the customer marked as told.'
    } catch {
      msg = 'Recorded as told, but the reply could not be written on the case.'
    }
  }
  await markTold(actor(me), item, caseId)
  ok(form, number, msg)
}
