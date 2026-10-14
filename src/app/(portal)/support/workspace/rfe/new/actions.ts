'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { bind, entity, update } from '@/lib/dataverse'
import { getCase } from '@/lib/support/cases'
import { createRfe } from '@/lib/support/rfe'
import { requireAgent } from '@/lib/support/session'

/** Creates the RFE and, when a case is given, links it from both sides so the case page lists it. */
export async function createRfeAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const title = String(form.get('title') ?? '').trim()
  const type = Number(form.get('type') ?? '')
  const status = Number(form.get('status') ?? '')
  const yodizId = String(form.get('yodizId') ?? '').trim()
  const users = String(form.get('users') ?? '').trim()
  const serial = String(form.get('serial') ?? '').trim()
  const caseRaw = String(form.get('caseId') ?? '').trim()
  const back = (error: string) => redirect(`${WS}/rfe/new?${new URLSearchParams({ error, title, yodizId, users, serial, case: caseRaw }).toString()}`)
  if (title.length < 3) back('The title needs at least three characters.')
  if (!Number.isFinite(type) || type <= 0) back('Choose the type of request.')
  if (caseRaw && !isGuid(caseRaw)) back('The case reference must be the case id from its page.')
  let caseId: string | undefined
  let productId: string | undefined
  let accountId: string | undefined
  let vertical: number | undefined
  if (caseRaw) {
    const c = await getCase(me.auth, caseRaw).catch(() => null)
    if (!c) back('That case does not exist.')
    caseId = c!.incidentid
    productId = c!._productid_value ? String(c!._productid_value) : undefined
    accountId = String(c!['_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname'] ?? '') === 'account' && c!._customerid_value ? String(c!._customerid_value) : undefined
    vertical = typeof c!.new_verticaltype === 'number' ? c!.new_verticaltype : undefined
  }
  let id = ''
  let error: string | null = null
  try {
    id = await createRfe(me.auth, { title, type, status: Number.isFinite(status) && status > 0 ? status : undefined, yodizId: yodizId || undefined, users: users || undefined, serial: serial || undefined, caseId, productId, accountId, vertical })
    // The case's own RFE lookup (incident.k7_rfe, navigation k7_RFE) points back so the case page lists it.
    if (caseId) await update(me.auth, entity('incidents', caseId), { 'k7_RFE@odata.bind': bind('k7_rfes', id) }).catch(() => undefined)
  } catch (e) {
    error = userMessage(e)
  }
  if (error || !id) back(error ?? 'Could not create the RFE.')
  redirect(`${WS}/rfe/${id}?ok=${encodeURIComponent('RFE created.')}`)
}
