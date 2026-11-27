import 'server-only'

import { fv, type DataverseAuth } from '@/lib/dataverse'

import type { CaseRow } from './cases'
import { SHARED_OWNER } from './metrics'
import { notify, personById } from './notify'
import { caseStatusLabel } from './status'

/* The case events the portal itself causes (09-portal-guide.md §4g), told at once: an agent assigns a case, moves it to the Lab or
   principal support, escalates it to product, a customer writes on the portal. The watch sees the same change a minute later in
   Dynamics; the shared dedupe key (watch-model.ts) keeps it from being told twice. */

const href = (id: string) => `/support/workspace/cases/${id}`
const about = (c: CaseRow) => `"${c.title || 'no title'}"${fv(c, '_customerid_value') ? `, ${fv(c, '_customerid_value')}` : ''}`

/** The case's owner when an engineer (not a team, a shared account or nobody) owns it. */
const engineer = async (auth: DataverseAuth, c: CaseRow) => {
  const id = String(c._ownerid_value ?? '')
  const logical = String(c['_ownerid_value@Microsoft.Dynamics.CRM.lookuplogicalname'] ?? '')
  const name = fv(c, '_ownerid_value')
  if (!id || logical === 'team' || SHARED_OWNER.test(name)) return null
  return (await personById(auth, id)) ?? { id, name, email: '' }
}

export const tellAssigned = async (auth: DataverseAuth, c: CaseRow, ownerId: string, actor: { id: string; name: string }) => {
  const owner = (await personById(auth, ownerId)) ?? { id: ownerId, name: '', email: '' }
  await notify(auth, {
    key: 'case.assigned',
    caseId: c.incidentid,
    ticket: c.ticketnumber,
    href: href(c.incidentid),
    owner,
    actorId: actor.id,
    dedupe: `assigned:${c.incidentid}:${ownerId}`.toLowerCase(),
    subject: `${c.ticketnumber} is yours: ${c.title || 'no title'}`,
    body: `${actor.name || 'A colleague'} made you the owner of case ${c.ticketnumber} ${about(c)}. Status ${caseStatusLabel(c)}.`,
  })
}

export const tellEscalated = async (auth: DataverseAuth, c: CaseRow, to: 'lab' | 'principal' | 'product', actor: { id: string; name: string }, detail = '') => {
  const where = to === 'lab' ? 'the Lab' : to === 'principal' ? 'principal support' : 'product'
  await notify(auth, {
    key: 'case.escalated',
    caseId: c.incidentid,
    ticket: c.ticketnumber,
    href: href(c.incidentid),
    owner: await engineer(auth, c),
    actorId: actor.id,
    dedupe: `escalated:${c.incidentid}:${to}`.toLowerCase(),
    subject: `${c.ticketnumber} escalated to ${where}`,
    body: `${actor.name || 'An agent'} escalated case ${c.ticketnumber} ${about(c)} to ${where}.${detail ? ` ${detail}` : ''} Owner: ${fv(c, '_ownerid_value') || 'nobody'}.`,
  })
}

/** A customer's reply on the portal: the burst of messages within half an hour is one notification. */
export const tellCustomerWrote = async (auth: DataverseAuth, c: CaseRow) => {
  await notify(auth, {
    key: 'case.customer-replied',
    caseId: c.incidentid,
    ticket: c.ticketnumber,
    href: href(c.incidentid),
    owner: await engineer(auth, c),
    dedupe: `replied:${c.incidentid}`.toLowerCase(),
    dedupeHours: 0.5,
    subject: `${c.ticketnumber}: the customer wrote`,
    body: `A new message from the customer on case ${c.ticketnumber} ${about(c)}, through the portal. Owner: ${fv(c, '_ownerid_value') || 'nobody (in the bin)'}.`,
  })
}
