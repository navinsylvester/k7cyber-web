'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { createAccount } from '@/lib/support/customers'
import { requireAgent } from '@/lib/support/session'

import { carry, checkGeo, readAccountForm } from '../../forms'

export async function createAccountAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const { v, errors, bad } = readAccountForm(form)
  // Everything submitted goes back on an error (13-tester-round-1.md, TR-03).
  const again = (error: string, marked: string[] = []) => redirect(`${WS}/customers/accounts/new?${carry({ ...v, regionId: undefined }, { error, bad: marked.join(',') }).toString()}`)
  await checkGeo(me.auth, v, errors, bad)
  if (errors.length) again(errors.join(' '), bad)
  let id = ''
  let error: string | null = null
  try {
    id = await createAccount(me.auth, {
      name: v.name,
      phone: v.phone || undefined,
      email: v.email || undefined,
      website: v.website || undefined,
      type: v.type,
      vertical: v.vertical,
      licenceKey: v.licenceKey || undefined,
      stateId: v.stateId,
      cityId: v.cityId,
      regionId: v.regionId,
    })
  } catch (e) {
    error = userMessage(e)
  }
  if (error || !id) again(error ?? 'Could not create the account.')
  redirect(`${WS}/customers/accounts/${id}?ok=${encodeURIComponent('Account created.')}`)
}
