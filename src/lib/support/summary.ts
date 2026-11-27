import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { action, type DataverseAuth } from '@/lib/dataverse'

import { parseCopilotSummary } from './summary-model'

/* The case summary on the timeline (TR-24, 09-portal-guide.md §3). Dynamics' Copilot is switched on for case summaries in this CRM
   (msdyn_copilotsummarizationsetting: case summary enabled, consent given 2024-01-16) and writes the same summary the Hub's case form
   shows, from the title, description, product, notes and emails. The portal asks for it as the agent, on request (it takes about ten
   seconds), and keeps the latest per case in `support-case-summaries` for every agent who opens the case. */

export type CaseSummary = { caseId: string; ticket: string; summary: string; madeAt: string; partial: boolean; byName: string }

type Doc = Record<string, unknown>
const db = () => getPayload({ config: configPromise })
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** The latest summary kept for a case, or null. */
export const getSummary = async (caseId: string): Promise<CaseSummary | null> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'support-case-summaries', where: { caseId: { equals: caseId.toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true })
    const d = r.docs[0] as unknown as Doc | undefined
    return d ? { caseId: s(d.caseId), ticket: s(d.ticket), summary: s(d.summary), madeAt: s(d.madeAt), partial: d.partial === true, byName: s(d.byName) } : null
  } catch (e) {
    console.error(`[case summary] read failed: ${(e as Error).message}`)
    return null
  }
}

export class SummaryUnavailable extends Error {}

/** Asks Copilot for the case's summary as the agent and keeps it. Throws SummaryUnavailable with the reason when there is none. */
export const summarise = async (auth: DataverseAuth, c: { incidentid: string; ticketnumber: string }, by: { id: string; name: string }): Promise<CaseSummary> => {
  const r = await action<{ msdyn_CaseSummary?: string | null }>(auth, 'msdyn_CustomApiCustomerServiceCaseSummary', { msdyn_CaseNumber: c.ticketnumber })
  const parsed = parseCopilotSummary(r.msdyn_CaseSummary)
  if (!parsed.ok) throw new SummaryUnavailable(parsed.reason)
  const row: CaseSummary = { caseId: c.incidentid.toLowerCase(), ticket: c.ticketnumber, summary: parsed.summary, madeAt: new Date().toISOString(), partial: parsed.partial, byName: by.name }
  const payload = await db()
  const data = { ...row, byId: by.id } as never
  const cur = await payload.find({ collection: 'support-case-summaries', where: { caseId: { equals: row.caseId } }, limit: 1, depth: 0, overrideAccess: true })
  if (cur.docs[0]) await payload.update({ collection: 'support-case-summaries', id: cur.docs[0].id, data, overrideAccess: true })
  else await payload.create({ collection: 'support-case-summaries', data, overrideAccess: true })
  return row
}
