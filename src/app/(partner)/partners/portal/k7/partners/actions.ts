'use server'

import { redirect } from 'next/navigation'

import { decideLegalEdit, findOrgByPartnerId, K7_PARTNERS, setOrgStatus, setWaiver } from '@/lib/partner/organisation'
import { requireK7Role } from '@/lib/partner/session'

/* The Channel Manager's levers on an organisation (M3, FR-REG-07, decision 8): decide a legal-identity edit, suspend or
   reinstate with a reason, set or clear the certificate waiver. The role is re-checked on every post; the library writes the
   trail and tells the organisation. */

const f = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (pid: string, q: Record<string, string>): never => redirect(`${K7_PARTNERS}/${encodeURIComponent(pid)}?${new URLSearchParams(q).toString()}`)

export async function decideLegalEditAction(form: FormData): Promise<void> {
  const pid = f(form, 'partnerId')
  const me = await requireK7Role(['channelManager'], `${K7_PARTNERS}/${pid}`)
  const org = await findOrgByPartnerId(pid)
  if (!org) redirect(K7_PARTNERS)
  const decision = f(form, 'decision') === 'approve' ? 'approve' : 'decline'
  const r = await decideLegalEdit(org, decision, f(form, 'note'), me)
  if (!r.ok) return back(pid, { error: r.error })
  back(pid, { ok: decision === 'approve' ? 'Approved; the organisation carries the new identity and its admins are told. The CRM account keeps its name until the CRM admin carries the change over.' : 'Declined; the admins have your reason.' })
}

export async function setOrgStatusAction(form: FormData): Promise<void> {
  const pid = f(form, 'partnerId')
  const me = await requireK7Role(['channelManager'], `${K7_PARTNERS}/${pid}`)
  const org = await findOrgByPartnerId(pid)
  if (!org) redirect(K7_PARTNERS)
  const to = f(form, 'to') === 'suspended' ? 'suspended' : 'approved'
  const r = await setOrgStatus(org, to, f(form, 'reason'), me)
  if (!r.ok) return back(pid, { error: r.error })
  back(pid, { ok: to === 'suspended' ? 'Suspended. Every user is refused at the door and told by email; open sessions end on their next request.' : 'Reinstated; the users can sign in again.' })
}

export async function setWaiverAction(form: FormData): Promise<void> {
  const pid = f(form, 'partnerId')
  const me = await requireK7Role(['channelManager'], `${K7_PARTNERS}/${pid}`)
  const org = await findOrgByPartnerId(pid)
  if (!org) redirect(K7_PARTNERS)
  const until = form.get('clear') === '1' ? null : f(form, 'until') || null
  const r = await setWaiver(org, until, me)
  if (!r.ok) return back(pid, { error: r.error })
  back(pid, { ok: until ? `Waiver set to ${until}.` : 'Waiver cleared.' })
}
