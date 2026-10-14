'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { createAccount } from '@/lib/support/customers'
import { requireAgent } from '@/lib/support/session'

import { readAccountForm } from '../../forms'

export async function createAccountAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const { v, errors } = readAccountForm(form)
  if (errors.length) redirect(`${WS}/customers/accounts/new?${new URLSearchParams({ error: errors.join(' '), name: v.name, phone: v.phone, email: v.email, website: v.website }).toString()}`)
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
  if (error || !id) redirect(`${WS}/customers/accounts/new?error=${encodeURIComponent(error ?? 'Could not create the account.')}&name=${encodeURIComponent(v.name)}`)
  redirect(`${WS}/customers/accounts/${id}?ok=${encodeURIComponent('Account created.')}`)
}
