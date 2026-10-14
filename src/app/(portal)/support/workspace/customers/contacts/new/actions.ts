'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { createContact } from '@/lib/support/customers'
import { requireAgent } from '@/lib/support/session'

import { readContactForm } from '../../forms'

export async function createContactAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const { v, errors } = readContactForm(form)
  const accountRaw = String(form.get('accountId') ?? '')
  const accountId = isGuid(accountRaw) ? accountRaw : null
  const ret = String(form.get('return') ?? '')
  if (!v.email) errors.push('An email address is required for a new contact.')
  if (errors.length) {
    const q = new URLSearchParams({ error: errors.join(' '), firstName: v.firstName, lastName: v.lastName, email: v.email, mobile: v.mobile, phone: v.phone, jobTitle: v.jobTitle })
    if (ret) q.set('return', ret)
    redirect(`${WS}/customers/contacts/new?${q.toString()}`)
  }
  let id = ''
  let error: string | null = null
  try {
    id = await createContact(me.auth, {
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      mobile: v.mobile || undefined,
      phone: v.phone || undefined,
      jobTitle: v.jobTitle || undefined,
      vertical: v.vertical,
      accountId,
      stateId: v.stateId,
      cityId: v.cityId,
      regionId: v.regionId,
    })
  } catch (e) {
    error = userMessage(e)
  }
  if (error || !id) redirect(`${WS}/customers/contacts/new?error=${encodeURIComponent(error ?? 'Could not create the contact.')}`)
  if (ret === 'cases/new') redirect(`${WS}/cases/new?customer=${encodeURIComponent(v.email)}&contact=${id}`)
  redirect(`${WS}/customers/contacts/${id}?ok=${encodeURIComponent('Contact created.')}`)
}
