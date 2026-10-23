'use server'

import { redirect } from 'next/navigation'

import { adjustResult, decideRegistration, K7_SCHEMES, loadRegistration, loadResultK7, loadScheme, publishResults, resolveDispute, runDueSchemes, runEligibility, setPayout } from '@/lib/partner/schemes'
import { PAYOUT_STATUSES, type PayoutStatus } from '@/lib/partner/schemes-model'
import { requireK7Role } from '@/lib/partner/session'

/* The Scheme Admin's actions (01-requirements.md §9): decide a registration (FR-SCH-04), compute a closed scheme's results
   (FR-ELG-01), adjust one with a reason and publish them (FR-ELG-02), answer a dispute (FR-ELG-05), record a payout
   (FR-ELG-06). The role and the state are re-checked on the server; the library writes the trail and tells the partner. */

const ROLES = ['schemeAdmin'] as const
const f = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (path: string, q: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(q).toString()}`)

const load = async (form: FormData) => {
  const id = f(form, 'schemeId')
  const path = `${K7_SCHEMES}/${encodeURIComponent(id)}`
  const me = await requireK7Role([...ROLES], path)
  const scheme = await loadScheme(id)
  if (!scheme) redirect(K7_SCHEMES)
  return { me, scheme, path }
}

export async function decideRegistrationAction(form: FormData): Promise<void> {
  const { me, scheme, path } = await load(form)
  const reg = await loadRegistration(f(form, 'registrationId'))
  if (!reg || reg.schemeId !== scheme.id) return back(path, { error: 'That registration is not on this scheme.' })
  const approve = f(form, 'decision') === 'approve'
  const r = await decideRegistration(scheme, reg, approve, f(form, 'note'), me)
  if (!r.ok) return back(path, { error: r.error })
  back(path, { ok: approve ? `${reg.orgName} is registered; its admins are told.` : `${reg.orgName}'s registration declined; its admins have your note.` })
}

export async function computeAction(form: FormData): Promise<void> {
  const { me, scheme, path } = await load(form)
  const r = await runEligibility(scheme, me.actor)
  if (!r.ok) return back(path, { error: r.error })
  back(path, { ok: `Computed for ${r.computed} organisation${r.computed === 1 ? '' : 's'}: ${r.eligible} eligible${r.skipped ? `, ${r.skipped} registration${r.skipped === 1 ? '' : 's'} not approved and not counted` : ''}. Review, adjust where needed, then publish.` })
}

export async function publishAction(form: FormData): Promise<void> {
  const { me, scheme, path } = await load(form)
  if (form.get('confirm') !== '1') return back(path, { error: 'Tick the box to confirm the publication.' })
  const r = await publishResults(scheme, me)
  if (!r.ok) return back(path, { error: r.error })
  back(path, { ok: 'Published; every registered organisation can read its result and is told by email.' })
}

export async function runDueAction(): Promise<void> {
  const me = await requireK7Role([...ROLES], K7_SCHEMES)
  const r = await runDueSchemes(me.actor)
  back(K7_SCHEMES, r.schemes.length || r.errors.length ? { ok: `${r.schemes.length ? `Computed: ${r.schemes.join(', ')}.` : ''}${r.errors.length ? ` Not computed: ${r.errors.join('; ')}.` : ''}`.trim() } : { ok: 'Nothing due: every closed scheme has its results.' })
}

const loadResult = async (form: FormData) => {
  const { me, scheme } = await load(form)
  const partnerId = f(form, 'partnerId')
  const path = `${K7_SCHEMES}/${scheme.id}/results/${encodeURIComponent(partnerId)}`
  const result = await loadResultK7(scheme.id, partnerId)
  if (!result) redirect(`${K7_SCHEMES}/${scheme.id}`)
  return { me, scheme, result, path }
}

export async function adjustAction(form: FormData): Promise<void> {
  const { me, scheme, result, path } = await loadResult(form)
  const raw = f(form, 'amount').replace(/[,\s₹]/g, '')
  const amount = raw === '' ? 0 : Number(raw)
  const r = await adjustResult(scheme, result, amount, f(form, 'reason'), me)
  if (!r.ok) return back(path, { error: r.error })
  back(path, { ok: `Adjusted; the counted value is now ₹${r.value.final.toLocaleString('en-IN')} (${r.value.eligible ? `eligible, slab ${r.value.slabIndex + 1}` : 'not eligible'}).` })
}

export async function resolveDisputeAction(form: FormData): Promise<void> {
  const { me, scheme, result, path } = await loadResult(form)
  const r = await resolveDispute(scheme, result, f(form, 'resolution'), me)
  if (!r.ok) return back(path, { error: r.error })
  back(path, { ok: 'Resolved; the partner has your answer.' })
}

export async function payoutAction(form: FormData): Promise<void> {
  const { me, scheme, result, path } = await loadResult(form)
  const status = f(form, 'status') as PayoutStatus
  if (!PAYOUT_STATUSES.includes(status)) return back(path, { error: 'Pick a payout state.' })
  const r = await setPayout(scheme, result, status, f(form, 'reference'), f(form, 'note'), me)
  if (!r.ok) return back(path, { error: r.error })
  back(path, { ok: `Payout recorded as ${status}${r.value.payout.reference ? ` · ${r.value.payout.reference}` : ''}; the partner is told.` })
}
