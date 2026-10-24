'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { updateContact } from '@/lib/support/customers'
import { requireAgent } from '@/lib/support/session'

import { carry, checkGeo, readContactForm } from '../../forms'

export async function updateContactAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = String(form.get('id') ?? '')
  if (!isGuid(id)) redirect(`${WS}/customers`)
  const back = (q: Record<string, string>) => redirect(`${WS}/customers/contacts/${id}?${new URLSearchParams(q).toString()}`)
  const { v, errors, bad } = readContactForm(form)
  // On an error the panel reopens with what was submitted, not the stored record (TR-03).
  const again = (error: string, marked: string[] = []) => back(Object.fromEntries(carry({ ...v, regionId: undefined }, { error, bad: marked.join(','), edit: '1' })))
  await checkGeo(me.auth, v, errors, bad)
  if (errors.length) again(errors.join(' '), bad)
  let error: string | null = null
  try {
    await updateContact(me.auth, id, {
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      mobile: v.mobile,
      phone: v.phone,
      jobTitle: v.jobTitle,
      vertical: v.vertical,
      stateId: v.stateId,
      cityId: v.cityId,
      regionId: v.regionId,
    })
  } catch (e) {
    error = userMessage(e)
  }
  if (error) again(error)
  back({ ok: 'Contact saved.' })
}
