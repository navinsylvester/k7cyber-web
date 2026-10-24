'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { updateAccount } from '@/lib/support/customers'
import { requireAgent } from '@/lib/support/session'

import { carry, checkGeo, readAccountForm } from '../../forms'

export async function updateAccountAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = String(form.get('id') ?? '')
  if (!isGuid(id)) redirect(`${WS}/customers?kind=accounts`)
  const back = (q: Record<string, string>) => redirect(`${WS}/customers/accounts/${id}?${new URLSearchParams(q).toString()}`)
  const { v, errors, bad } = readAccountForm(form)
  // On an error the panel reopens with what was submitted, not the stored record (TR-03).
  const again = (error: string, marked: string[] = []) => back(Object.fromEntries(carry({ ...v, regionId: undefined }, { error, bad: marked.join(','), edit: '1' })))
  await checkGeo(me.auth, v, errors, bad)
  if (errors.length) again(errors.join(' '), bad)
  let error: string | null = null
  try {
    await updateAccount(me.auth, id, {
      name: v.name,
      phone: v.phone,
      email: v.email,
      website: v.website,
      type: v.type,
      vertical: v.vertical,
      licenceKey: v.licenceKey,
      stateId: v.stateId,
      cityId: v.cityId,
      regionId: v.regionId,
    })
  } catch (e) {
    error = userMessage(e)
  }
  if (error) again(error)
  back({ ok: 'Account saved.' })
}
