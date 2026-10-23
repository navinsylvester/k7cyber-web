import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { audit, SYSTEM } from './audit'
import { toDeal } from './deals-model'
import { notify, type Recipient } from './notify'
import { toApplication } from './registration'
import type { SlaQueueRow } from './reports-model'
import { getPartnerSettings, staffWithRole, type PartnerSettings, type StaffRole } from './settings'
import { applicationClock, dealClock, readClock, slaText, workingText, type SlaClock, type SlaReading } from './sla-model'
import { dmyHm } from '@/lib/support/format'

/* The approval SLA on the server (FR-NTF-01 "Approval SLA breached", M8): the open clocks of the two queues, their readings,
   the breach notice sent once per clock (to the queue's role, the holders' managers and the escalation addresses), the
   counters for the desk. The maths is in `sla-model.ts`. */

type Doc = Record<string, unknown>
const db = () => getPayload({ config: configPromise })
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export type OpenClock = { clock: SlaClock; reading: SlaReading; noticedFor: string }

export const readingFor = (clock: SlaClock, settings: PartnerSettings, now = new Date()): SlaReading => readClock(clock.startedAt, settings.deals.approvalSlaHours, settings.sla, now)

/** Every deal and application that waits on K7 now, with where its clock stands. */
export const openClocks = async (settings?: PartnerSettings, now = new Date()): Promise<OpenClock[]> => {
  const st = settings ?? (await getPartnerSettings())
  const payload = await db()
  const out: OpenClock[] = []
  const deals = await payload.find({ collection: 'partner-deals', where: { status: { in: ['submitted', 'extensionRequested'] } }, limit: 500, depth: 1, overrideAccess: true })
  for (const doc of deals.docs as unknown as Doc[]) {
    const clock = dealClock(toDeal(doc))
    if (clock) out.push({ clock, reading: readingFor(clock, st, now), noticedFor: s((doc.sla as Doc | undefined)?.noticedFor) })
  }
  const apps = await payload.find({ collection: 'partner-applications', where: { status: { in: ['submitted', 'underReview'] } }, limit: 500, depth: 0, overrideAccess: true })
  for (const doc of apps.docs as unknown as Doc[]) {
    const clock = applicationClock(toApplication(doc))
    if (clock) out.push({ clock, reading: readingFor(clock, st, now), noticedFor: s((doc.sla as Doc | undefined)?.noticedFor) })
  }
  return out
}

export const queueRows = (clocks: OpenClock[]): SlaQueueRow[] => clocks.map(({ clock, reading }) => ({ kind: clock.kind, number: clock.number, label: clock.label, partner: clock.orgName, startedAt: clock.startedAt, dueAt: reading.dueAt, state: reading.state, leftMinutes: reading.leftMinutes, href: clock.href }))

export type SlaCounts = { deals: { open: number; atRisk: number; breached: number }; applications: { open: number; atRisk: number; breached: number } }

export const slaCounts = async (settings?: PartnerSettings, now = new Date()): Promise<SlaCounts> => {
  const r: SlaCounts = { deals: { open: 0, atRisk: 0, breached: 0 }, applications: { open: 0, atRisk: 0, breached: 0 } }
  for (const { clock, reading } of await openClocks(settings, now)) {
    const c = clock.kind === 'deal' ? r.deals : r.applications
    c.open += 1
    if (reading.state === 'at-risk') c.atRisk += 1
    if (reading.state === 'breached') c.breached += 1
  }
  return r
}

/** The approvers of a queue, their managers and the escalation list: the role's bell row and mail, the others by mail only. */
const breachRecipients = (kind: SlaClock['kind'], settings: PartnerSettings): Recipient[] => {
  const role: StaffRole = kind === 'deal' ? 'dealDeskApprover' : 'channelManager'
  const holders = staffWithRole(role, settings)
  const own = new Set(holders.map((h) => h.email))
  const extra = new Set<string>()
  for (const h of holders) if (h.manager && !own.has(h.manager)) extra.add(h.manager)
  for (const e of settings.sla.escalateTo) if (!own.has(e)) extra.add(e)
  return [{ kind: 'staff', role }, ...[...extra].map((address) => ({ kind: 'email' as const, address }))]
}

export type SlaSweepResult = { checked: number; breached: number; noticed: string[]; errors: string[] }

/** The breach pass: every open clock past the target gets one notice per clock start (a resubmission restarts the clock). */
export const sweepSla = async (now = new Date()): Promise<SlaSweepResult> => {
  const settings = await getPartnerSettings()
  const payload = await db()
  const r: SlaSweepResult = { checked: 0, breached: 0, noticed: [], errors: [] }
  for (const { clock, reading, noticedFor } of await openClocks(settings, now)) {
    r.checked += 1
    if (reading.state !== 'breached') continue
    r.breached += 1
    if (noticedFor === clock.startedAt) continue
    const collection = clock.kind === 'deal' ? 'partner-deals' : 'partner-applications'
    const kindWord = clock.kind === 'deal' ? 'deal' : 'application'
    const overdue = workingText(-reading.leftMinutes, settings.sla)
    try {
      await payload.update({ collection, id: clock.id, data: { sla: { noticedAt: now.toISOString(), noticedFor: clock.startedAt } }, overrideAccess: true })
      await notify({
        event: 'sla.breached',
        subject: `Approval SLA breached: ${clock.label}`,
        body: `${clock.kind === 'deal' ? `The deal ${clock.number} from ${clock.orgName}` : `The application ${clock.number} from ${clock.orgName}`} has waited since ${dmyHm(clock.startedAt)} for a decision, past the ${settings.deals.approvalSlaHours} working-hour target by ${overdue} (${slaText(reading, settings.sla)}). Decide it, or tell the partner what holds it.`,
        href: clock.href,
        to: breachRecipients(clock.kind, settings),
        vars: { item: clock.number, kind: kindWord, partner: clock.orgName, waitingSince: dmyHm(clock.startedAt), hours: String(settings.deals.approvalSlaHours), overdueBy: overdue },
      })
      await audit({ actor: SYSTEM, object: collection, objectId: clock.id, objectLabel: clock.number, action: 'sla.breached', comment: `Waiting since ${dmyHm(clock.startedAt)}; target ${settings.deals.approvalSlaHours} working hours; overdue by ${overdue}.`, orgId: clock.orgId || undefined })
      r.noticed.push(clock.number)
    } catch (e) {
      r.errors.push(`${clock.number}: ${(e as Error).message.slice(0, 160)}`)
    }
  }
  return r
}

export { slaText, workingText }
