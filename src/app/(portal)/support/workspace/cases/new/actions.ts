'use server'

import { redirect } from 'next/navigation'

import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { agentNewCase, createCase } from '@/lib/support/cases'
import { requireAgent } from '@/lib/support/session'

/* Creating a case as an agent: the customer must be chosen, the title must say something; everything else is optional. */

const WS = '/support/workspace'

const str = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const num = (form: FormData, k: string): number | undefined => {
  const v = str(form, k)
  return v === '' ? undefined : Number(v)
}
const optGuid = (form: FormData, k: string): string | undefined => {
  const v = str(form, k)
  return isGuid(v) ? v : undefined
}

export async function createCaseAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const title = str(form, 'title')
  const description = str(form, 'description')
  const customerQ = str(form, 'customerQ')
  const sel = str(form, 'customer')
  const [kind, custId] = sel.split(':')
  const back = (error: string): never =>
    redirect(`${WS}/cases/new?error=${encodeURIComponent(error)}&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}${customerQ ? `&customer=${encodeURIComponent(customerQ)}` : ''}${sel ? `&sel=${encodeURIComponent(sel)}` : ''}`)
  if ((kind !== 'contact' && kind !== 'account') || !isGuid(custId ?? '')) back('Choose the customer first: search above and pick a contact or an account.')
  if (title.length < 3) back('The title needs at least three characters.')
  let msg: string | null = null
  let created: { id: string; ticket: string } | null = null
  try {
    created = await createCase(
      me.auth,
      agentNewCase({
        title,
        description: description || undefined,
        customer: { kind: kind as 'contact' | 'account', id: custId! },
        primaryContactId: kind === 'contact' ? custId! : optGuid(form, 'primaryContactId'),
        origin: num(form, 'origin'),
        productId: optGuid(form, 'productId'),
        categoryId: optGuid(form, 'categoryId'),
        subcategoryId: optGuid(form, 'subcategoryId'),
        vertical: num(form, 'vertical'),
        customerType: num(form, 'customerType'),
        priority: num(form, 'priority'),
        caseType: num(form, 'caseType'),
        consideredAs: num(form, 'consideredAs'),
        productVersion: str(form, 'productVersion') || undefined,
        serial: str(form, 'serial') || undefined,
        module: str(form, 'module') || undefined,
        submodule: str(form, 'submodule') || undefined,
        customerEmail: str(form, 'customerEmail') || undefined,
        ownerId: optGuid(form, 'ownerId'),
        createdBy: me.email || undefined,
      }),
    )
  } catch (e) {
    msg = userMessage(e, 'agent')
  }
  if (msg || !created) back(msg ?? 'The case was not created.')
  redirect(`${WS}/cases/${created!.id}?ok=created`)
}
