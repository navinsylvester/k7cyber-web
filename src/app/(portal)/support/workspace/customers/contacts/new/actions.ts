'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { createContact } from '@/lib/support/customers'
import { requireAgent } from '@/lib/support/session'

import { carry, checkGeo, readContactForm } from '../../forms'

export async function createContactAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const { v, errors, bad } = readContactForm(form)
  const accountRaw = String(form.get('accountId') ?? '')
  const accountId = isGuid(accountRaw) ? accountRaw : null
  const ret = String(form.get('return') ?? '')
  // Everything submitted goes back on an error, the organisation search and choice included (13-tester-round-1.md, TR-03).
  const again = (error: string, marked: string[] = []) => redirect(`${WS}/customers/contacts/new?${carry({ ...v, regionId: undefined }, { error, bad: marked.join(','), return: ret, account: String(form.get('account') ?? ''), accountId }).toString()}`)
  if (!v.email) {
    errors.push('An email address is required for a new contact.')
    bad.push('email')
  }
  await checkGeo(me.auth, v, errors, bad)
  if (errors.length) again(errors.join(' '), bad)
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
  if (error || !id) again(error ?? 'Could not create the contact.')
  // Back on the case form with this contact chosen: `sel` is what the case form reads (TR-06).
  if (ret === 'cases/new') redirect(`${WS}/cases/new?customer=${encodeURIComponent(v.email)}&sel=${encodeURIComponent(`contact:${id}`)}`)
  redirect(`${WS}/customers/contacts/${id}?ok=${encodeURIComponent('Contact created.')}`)
}
