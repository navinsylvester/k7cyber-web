import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { OrgScope } from './scope'
import { orgWhere } from './scope'

/* The trail (decision 17): every status change writes one row through `audit()`. Failures are logged, never thrown, so a
   decision is not lost because its record was not written; the caller's own write has already happened. */

export type Actor = { kind: 'partner' | 'k7' | 'system'; id?: string; name?: string; email?: string }
export const SYSTEM: Actor = { kind: 'system', name: 'Portal' }

export type AuditInput = { actor: Actor; object: string; objectId: string; objectLabel?: string; action: string; from?: string; to?: string; orgId?: string; comment?: string; meta?: Record<string, unknown> }

export type AuditRow = { id: string; at: string; actor: Actor; object: string; objectId: string; objectLabel: string; action: string; from: string; to: string; orgId: string; comment: string }

type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

const toRow = (x: Doc): AuditRow => ({
  id: s(x.id),
  at: s(x.createdAt),
  actor: { kind: (x.actorKind as Actor['kind']) ?? 'system', id: s(x.actorId), name: s(x.actorName), email: s(x.actorEmail) },
  object: s(x.object),
  objectId: s(x.objectId),
  objectLabel: s(x.objectLabel),
  action: s(x.action),
  from: s(x.from),
  to: s(x.to),
  orgId: s(x.orgId),
  comment: s(x.comment),
})

export const audit = async (a: AuditInput): Promise<void> => {
  try {
    const payload = await getPayload({ config: configPromise })
    await payload.create({
      collection: 'partner-audit',
      overrideAccess: true,
      data: { actorKind: a.actor.kind, actorId: a.actor.id ?? '', actorName: a.actor.name ?? '', actorEmail: a.actor.email ?? '', object: a.object, objectId: a.objectId, objectLabel: a.objectLabel ?? '', action: a.action, from: a.from ?? '', to: a.to ?? '', orgId: a.orgId ?? '', comment: a.comment ?? '', meta: a.meta ?? null },
    })
  } catch (e) {
    console.error(`[partner audit] ${a.object} ${a.objectId} ${a.action}: ${(e as Error).message}`)
  }
}

/** An organisation's own trail, newest first. */
export const orgAudit = async (scope: OrgScope, limit = 50): Promise<AuditRow[]> => {
  const payload = await getPayload({ config: configPromise })
  const r = await payload.find({ collection: 'partner-audit', where: orgWhere(scope, undefined, 'orgId'), sort: '-createdAt', limit, depth: 0, overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toRow)
}

/** One object's trail, for K7 pages, newest first. */
export const objectAudit = async (object: string, objectId: string, limit = 100): Promise<AuditRow[]> => {
  const payload = await getPayload({ config: configPromise })
  const r = await payload.find({ collection: 'partner-audit', where: { and: [{ object: { equals: object } }, { objectId: { equals: objectId } }] }, sort: '-createdAt', limit, depth: 0, overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toRow)
}
