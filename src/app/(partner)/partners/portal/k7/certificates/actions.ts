'use server'

import { redirect } from 'next/navigation'

import { declineOrgRequest, issueOrgCertificate, K7_CERTIFICATES, loadCertificate, revokeCertificate, sweepCertificates } from '@/lib/partner/certificates'
import { recordJobRun } from '@/lib/partner/ops'
import { requireK7Role } from '@/lib/partner/session'

/* The desk's levers on certificates (FR-CRT-02, 07): issue the partner certificate (a waiting request, or a renewal), decline
   a request with a reason, revoke either kind with a reason, run the sweep. The role is re-checked on every post: Channel
   Managers for the organisation's certificate and the sweep; a Training Admin may revoke an individual certificate. */

const f = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (path: string, q: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(q).toString()}`)

export async function issueOrgCertificateAction(form: FormData): Promise<void> {
  const id = f(form, 'id')
  const me = await requireK7Role(['channelManager'], `${K7_CERTIFICATES}/${id}`)
  const c = await loadCertificate(id)
  if (!c || c.kind !== 'org') redirect(K7_CERTIFICATES)
  const r = await issueOrgCertificate({ orgId: c.orgId, requestId: c.status === 'requested' ? c.id : undefined }, me)
  if (!r.ok) return back(`${K7_CERTIFICATES}/${id}`, { error: r.error })
  back(`${K7_CERTIFICATES}/${r.certificate.id}`, { ok: `${r.certificate.number} issued, valid to ${r.certificate.expiresAt?.slice(0, 10).split('-').reverse().join('-')}; the Partner Admins have the PDF.` })
}

export async function declineRequestAction(form: FormData): Promise<void> {
  const id = f(form, 'id')
  const me = await requireK7Role(['channelManager'], `${K7_CERTIFICATES}/${id}`)
  const c = await loadCertificate(id)
  if (!c) redirect(K7_CERTIFICATES)
  const r = await declineOrgRequest(c, f(form, 'reason'), me)
  if (!r.ok) return back(`${K7_CERTIFICATES}/${id}`, { error: r.error })
  back(`${K7_CERTIFICATES}/${id}`, { ok: 'Declined; the Partner Admins have your reason.' })
}

export async function revokeCertificateAction(form: FormData): Promise<void> {
  const id = f(form, 'id')
  const me = await requireK7Role(['channelManager', 'trainingAdmin'], `${K7_CERTIFICATES}/${id}`)
  const c = await loadCertificate(id)
  if (!c) redirect(K7_CERTIFICATES)
  if (c.kind === 'org' && !me.roles.includes('channelManager')) return back(`${K7_CERTIFICATES}/${id}`, { error: 'Only a Channel Manager revokes the partner certificate.' })
  const r = await revokeCertificate(c, f(form, 'reason'), me)
  if (!r.ok) return back(`${K7_CERTIFICATES}/${id}`, { error: r.error })
  back(`${K7_CERTIFICATES}/${id}`, { ok: `${c.number} revoked; the ${c.kind === 'org' ? 'Partner Admins are' : 'holder and the Partner Admins are'} told, and the public page reads revoked.` })
}

export async function runCertificateSweepAction(): Promise<void> {
  const me = await requireK7Role(['channelManager'], K7_CERTIFICATES)
  let r: Awaited<ReturnType<typeof sweepCertificates>>
  try {
    r = await recordJobRun('certificatesSweep', () => sweepCertificates(), { trigger: 'manual', actor: me.actor })
  } catch (e) {
    // The redirect must stay outside the try: Next's redirect is itself a thrown value.
    return back(K7_CERTIFICATES, { error: `The sweep failed: ${(e as Error).message.slice(0, 200)}` })
  }
  back(K7_CERTIFICATES, { ok: `Sweep done: ${r.checked} checked, ${r.expired} expired, ${r.reminded} reminded, ${r.backfilled} issued for earlier passes, ${r.requested} renewal request${r.requested === 1 ? '' : 's'}${r.errors.length ? `, ${r.errors.length} errors (see the job run)` : ''}.` })
}
