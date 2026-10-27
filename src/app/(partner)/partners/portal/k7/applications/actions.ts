'use server'

import { redirect } from 'next/navigation'

import { drainOutbox, loadJob, runJob } from '@/lib/partner/mirror'
import { assignApplication, decideApplication, findByNumber, K7_APPLICATIONS } from '@/lib/partner/registration'
import { requireK7Role } from '@/lib/partner/session'
import type { Decision } from '@/lib/partner/status'

/* The Channel Manager's actions on an application (FR-REG-05): take it, decide it, and run the CRM job it produced. Every one
   re-checks the role and the state on the server; the library writes the trail and the mails. */

const f = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (number: string, q: Record<string, string>): never => redirect(`${K7_APPLICATIONS}/${encodeURIComponent(number)}?${new URLSearchParams(q).toString()}`)

export async function assignAction(form: FormData): Promise<void> {
  const number = f(form, 'number')
  const me = await requireK7Role(['channelManager'], `${K7_APPLICATIONS}/${number}`)
  const app = await findByNumber(number)
  if (!app) redirect(K7_APPLICATIONS)
  try {
    await assignApplication(app, me)
  } catch (e) {
    back(number, { error: (e as Error).message })
  }
  back(number, { ok: 'Assigned to you; the applicant has been told it is under review.' })
}

export async function decideAction(form: FormData): Promise<void> {
  const number = f(form, 'number')
  const decision = f(form, 'decision') as Decision
  const me = await requireK7Role(['channelManager'], `${K7_APPLICATIONS}/${number}`)
  if (!['approve', 'reject', 'clarify'].includes(decision)) back(number, { error: 'Pick a decision.' })
  const app = await findByNumber(number)
  if (!app) redirect(K7_APPLICATIONS)
  const r = await decideApplication(app, decision, f(form, 'comment'), me)
  if (!r.ok) return back(number, { error: r.error })
  if (r.already) return back(number, { ok: r.already })
  back(number, { ok: decision === 'approve' ? `Approved. ${r.org?.partnerId} is created and the Partner Admin has been invited.` : decision === 'reject' ? 'Rejected; the applicant has the reason by email.' : 'Sent back; the applicant has your note and the link to resubmit.' })
}

/** Runs one CRM job (the Retry button on the sheet) or drains the whole outbox (the desk's button). */
export async function runOutboxAction(form: FormData): Promise<void> {
  const number = f(form, 'number')
  const jobId = f(form, 'job')
  await requireK7Role(['channelManager'], number ? `${K7_APPLICATIONS}/${number}` : K7_APPLICATIONS)
  let line = ''
  if (jobId) {
    const job = await loadJob(jobId)
    if (!job) return back(number, { error: 'That CRM job no longer exists.' })
    const r = await runJob(job)
    line = `CRM job ${r.state}${r.lastError ? `: ${r.lastError}` : ''}.`
  } else {
    const r = await drainOutbox()
    line = r.ran ? `Ran ${r.ran} CRM job${r.ran === 1 ? '' : 's'}: ${r.done} done, ${r.failed} failed, ${r.skipped} skipped.` : (r.lines[0] ?? 'Nothing to run.')
  }
  if (number) back(number, { ok: line })
  redirect(`${K7_APPLICATIONS}?ok=${encodeURIComponent(line)}`)
}
