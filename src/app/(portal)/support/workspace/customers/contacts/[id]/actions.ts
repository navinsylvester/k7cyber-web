'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { updateContact } from '@/lib/support/customers'
import { requireAgent } from '@/lib/support/session'

import { readContactForm } from '../../forms'

export async function updateContactAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = String(form.get('id') ?? '')
  if (!isGuid(id)) redirect(`${WS}/customers`)
  const back = (q: Record<string, string>) => redirect(`${WS}/customers/contacts/${id}?${new URLSearchParams(q).toString()}`)
  const { v, errors } = readContactForm(form)
  if (errors.length) back({ error: errors.join(' '), edit: '1' })
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
  if (error) back({ error, edit: '1' })
  back({ ok: 'Contact saved.' })
}
