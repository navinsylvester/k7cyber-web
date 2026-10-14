'use server'

import { redirect } from 'next/navigation'

import { isGuid } from '@/lib/dataverse/odata'
import { clearCareFlag, setCareFlag } from '@/lib/support/csat'
import { requireManager } from '@/lib/support/session'

/* A manager flags a customer for extra care (or clears the flag) from the contact or account page (09-portal-guide.md §4d).
   Agents see the flag beside the customer everywhere; only managers set it. */

const WS = '/support/workspace'
const str = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (form: FormData, q: string): never => {
  const ret = str(form, 'return')
  const safe = ret.startsWith(`${WS}/customers/`) ? ret.split('?')[0]! : `${WS}/customers`
  redirect(`${safe}?${q}#csat`)
}

export async function setFlagAction(form: FormData): Promise<void> {
  const me = await requireManager()
  const customerId = str(form, 'customerId')
  const level = str(form, 'level') === 'watch' ? 'watch' : 'high'
  const reason = str(form, 'reason').slice(0, 500)
  const days = Number(str(form, 'days'))
  const kind = str(form, 'customerKind')
  if (!isGuid(customerId)) back(form, 'error=Unknown%20customer.')
  if (reason.length < 3) back(form, 'error=Say%20in%20a%20line%20why%20this%20customer%20needs%20extra%20care.')
  try {
    await setCareFlag({ customerId, customerName: str(form, 'customerName'), customerKind: kind === 'account' || kind === 'contact' ? kind : '', level, reason, until: Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 864e5) : null }, { id: me.userId, name: me.name || me.email })
  } catch (e) {
    back(form, `error=${encodeURIComponent(`Could not save the flag: ${(e as Error).message.slice(0, 120)}`)}`)
  }
  back(form, 'ok=Care%20flag%20saved.%20Every%20agent%20now%20sees%20it%20beside%20this%20customer.')
}

export async function clearFlagAction(form: FormData): Promise<void> {
  const me = await requireManager()
  const customerId = str(form, 'customerId')
  if (!isGuid(customerId)) back(form, 'error=Unknown%20customer.')
  try {
    await clearCareFlag(customerId, { id: me.userId, name: me.name || me.email })
  } catch (e) {
    back(form, `error=${encodeURIComponent(`Could not clear the flag: ${(e as Error).message.slice(0, 120)}`)}`)
  }
  back(form, 'ok=Care%20flag%20cleared.')
}
