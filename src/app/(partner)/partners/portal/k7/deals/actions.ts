'use server'

import { redirect } from 'next/navigation'

import { addDealNote, amendDeal, decideDeal, decideExtension, filesFrom, findDealByNumber, K7_DEALS, sweepDeals, type DealChanges } from '@/lib/partner/deals'
import { drainOutbox, loadJob, runJob } from '@/lib/partner/mirror'
import { requireK7Role } from '@/lib/partner/session'
import { syncDeals } from '@/lib/partner/sync'
import type { DealDecision } from '@/lib/partner/status'

/* The Deal Desk Approver's actions (FR-DEAL-05, FR-DEAL-07, FR-DEAL-09): decide a submitted deal, decide an extension, amend an
   approved deal, add a note, run the CRM job, run the sweep, read the opportunities back for the dashboard (M5). The role and the state are re-checked on the server; the library
   writes the trail and tells the partner. */

const ROLES = ['dealDeskApprover'] as const
const f = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (dealId: string, q: Record<string, string>): never => redirect(`${K7_DEALS}/${encodeURIComponent(dealId)}?${new URLSearchParams(q).toString()}`)

const changesFrom = (form: FormData): DealChanges => ({
  expectedValue: f(form, 'expectedValue') ? Number(f(form, 'expectedValue')) : null,
  closeDate: f(form, 'closeDate'),
  customerName: f(form, 'customerName'),
})

const load = async (form: FormData) => {
  const dealId = f(form, 'dealId')
  const me = await requireK7Role([...ROLES], `${K7_DEALS}/${dealId}`)
  const deal = await findDealByNumber(dealId)
  if (!deal) redirect(K7_DEALS)
  return { me, deal, dealId }
}

export async function decideDealAction(form: FormData): Promise<void> {
  const { me, deal, dealId } = await load(form)
  const decision = f(form, 'decision') as DealDecision
  if (!['approve', 'approveWithChanges', 'requestInfo', 'reject'].includes(decision)) return back(dealId, { error: 'Pick a decision.' })
  const r = await decideDeal(deal, decision, f(form, 'note'), changesFrom(form), me)
  if (!r.ok) return back(dealId, { error: r.error })
  if (r.already) return back(dealId, { ok: r.already })
  back(dealId, { ok: decision === 'reject' ? 'Rejected; the partner has the reason.' : decision === 'requestInfo' ? 'Sent back; the partner has your note and can edit and resubmit.' : `Approved and protected until ${r.deal.protectionEnds?.slice(0, 10)}; the opportunity job is queued.` })
}

export async function decideExtensionAction(form: FormData): Promise<void> {
  const { me, deal, dealId } = await load(form)
  const grant = f(form, 'decision') === 'grant'
  const r = await decideExtension(deal, grant, f(form, 'note'), me)
  if (!r.ok) return back(dealId, { error: r.error })
  if (r.already) return back(dealId, { ok: r.already })
  back(dealId, { ok: grant ? `Extended to ${r.deal.protectionEnds?.slice(0, 10)}; the partner is told.` : 'Declined; the partner has your reason.' })
}

export async function amendDealAction(form: FormData): Promise<void> {
  const { me, deal, dealId } = await load(form)
  const r = await amendDeal(deal, changesFrom(form), f(form, 'note'), me)
  if (!r.ok) return back(dealId, { error: r.error })
  if (r.already) return back(dealId, { ok: r.already })
  back(dealId, { ok: 'Amended; the partner is told what changed.' })
}

export async function k7NoteAction(form: FormData): Promise<void> {
  const { me, deal, dealId } = await load(form)
  const files = await filesFrom(form, 'files')
  if (typeof files === 'string') return back(dealId, { error: files })
  const r = await addDealNote({ side: 'k7', actor: me.actor, name: me.name, email: me.email, orgId: deal.orgId }, deal, f(form, 'text'), files)
  if (!r.ok) return back(dealId, { error: r.error })
  back(dealId, { ok: 'Added to the thread; the partner is told.' })
}

/** Runs one CRM job (the sheet's Retry) or drains the outbox (the queue's button). */
export async function runDealOutboxAction(form: FormData): Promise<void> {
  const dealId = f(form, 'dealId')
  const jobId = f(form, 'job')
  await requireK7Role([...ROLES], dealId ? `${K7_DEALS}/${dealId}` : K7_DEALS)
  let line = ''
  if (jobId) {
    const job = await loadJob(jobId)
    if (!job) return back(dealId, { error: 'That CRM job no longer exists.' })
    const r = await runJob(job)
    line = `CRM job ${r.state}${r.lastError ? `: ${r.lastError}` : ''}.`
  } else {
    const r = await drainOutbox()
    line = r.ran ? `Ran ${r.ran} CRM job${r.ran === 1 ? '' : 's'}: ${r.done} done, ${r.failed} failed, ${r.skipped} skipped.` : (r.lines[0] ?? 'Nothing to run.')
  }
  if (dealId) back(dealId, { ok: line })
  redirect(`${K7_DEALS}?ok=${encodeURIComponent(line)}`)
}

/** The sweep by hand: expiry and the ending notices. */
export async function sweepDealsAction(): Promise<void> {
  await requireK7Role([...ROLES], K7_DEALS)
  const r = await sweepDeals()
  const line = `Sweep: ${r.expired.length} expired, ${r.noticed.length} ending notice${r.noticed.length === 1 ? '' : 's'}${r.errors.length ? `, ${r.errors.length} error(s)` : ''}.`
  redirect(`${K7_DEALS}?ok=${encodeURIComponent(line)}`)
}

/** The dashboard read-back by hand (FR-DASH-05), forced past the interval; back to the log, or to the sheet it was pressed on. */
export async function syncNowAction(form: FormData): Promise<void> {
  const dealId = f(form, 'dealId')
  const me = await requireK7Role([...ROLES], `${K7_DEALS}/sync`)
  const r = await syncDeals({ trigger: 'manual', actor: me.actor, force: true })
  const line = r.errors.length && !r.fetched ? `The CRM could not be read: ${r.errors[0]}` : `Read back ${r.scanned} deal${r.scanned === 1 ? '' : 's'}: ${r.changed} changed, ${r.unchanged} unchanged${r.missing ? `, ${r.missing} not found in the CRM` : ''}${r.errors.length ? `, ${r.errors.length} error(s)` : ''}.`
  if (dealId) back(dealId, r.errors.length && !r.fetched ? { error: line } : { ok: line })
  redirect(`${K7_DEALS}/sync?${r.errors.length && !r.fetched ? 'error' : 'ok'}=${encodeURIComponent(line)}`)
}
