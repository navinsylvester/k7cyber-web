import type { Where } from 'payload'

/* FR-ROLE-01 and FR-DASH-03: a partner user never reads another organisation's rows. Every query a partner page makes goes
   through `orgWhere`, which puts the organisation into the filter before anything else is considered, the way
   `customerScopeFilter` does for support customers. A review checklist item, pinned by tests/int/partner-session.int.spec.ts. */

export type OrgScope = { orgId: string }

export class ScopeError extends Error {
  constructor(msg = 'A partner query needs an organisation scope.') {
    super(msg)
    this.name = 'ScopeError'
  }
}

/** The field that carries the organisation: `org` on rows related to `partner-orgs`, `orgId` on the text-keyed logs. */
export type OrgField = 'org' | 'orgId'

export const orgWhere = (scope: OrgScope, extra?: Where, field: OrgField = 'org'): Where => {
  if (!scope || typeof scope.orgId !== 'string' || !scope.orgId.trim()) throw new ScopeError()
  const own: Where = { [field]: { equals: scope.orgId } }
  return extra ? { and: [own, extra] } : own
}

/** Whether a row (already read) belongs to the scope; the last line of defence on a detail page reached by id. */
export const inScope = (scope: OrgScope, row: { org?: unknown; orgId?: unknown } | null | undefined): boolean => {
  if (!row) return false
  const org = row.org
  const id = typeof org === 'object' && org !== null ? (org as { id?: unknown }).id : org
  return String(id ?? row.orgId ?? '') === scope.orgId && scope.orgId !== ''
}

/** The scope's organisation as a relationship value: Postgres ids are numbers, and Payload validates the type on a create. */
export const orgRel = (scope: OrgScope): number | string => (/^\d+$/.test(scope.orgId) ? Number(scope.orgId) : scope.orgId)
