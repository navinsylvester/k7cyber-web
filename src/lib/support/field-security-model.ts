/* Dynamics field security (column-level security), the pure half: field-security.ts asks Dataverse, this decides.
   A column under field security is read, set on create and changed on update only by users whose field security profile grants
   it. On UAT (2026-11-26) the case's Incident ID, Module and Sub-module are granted to the profile "Level 2 Users", Product version
   to it and to "Level 1 users", and the RFE's and defect's YODIZ id is writable by System Administrators only; an agent outside
   those profiles gets 0x8004f502 (create) or 0x8004f507 (update) for the whole write, and reads the columns as empty. */

export type ColumnRights = { read: boolean; create: boolean; update: boolean }
export type Rights = Record<string, ColumnRights>

/** A principal's privilege on one secured column, as RetrievePrincipalAttributePrivileges returns it (0 none, 4 granted). */
export type AttributePrivilege = { AttributeId: string; CanRead: number; CanCreate: number; CanUpdate: number }

/** The codes of a write refused on a secured column: create, update. */
export const SECURED_REFUSAL_CODES = ['0x8004f502', '0x8004f507'] as const

export const isSecuredRefusalCode = (code: string | undefined): boolean => !!code && (SECURED_REFUSAL_CODES as readonly string[]).includes(code.toLowerCase())

/** The rights on each secured column of an entity: what the principal's privileges grant, nothing where they say nothing. */
export const rightsFrom = (secured: { id: string; column: string }[], privileges: AttributePrivilege[]): Rights => {
  const byId = new Map(privileges.map((p) => [p.AttributeId.toLowerCase(), p]))
  const out: Rights = {}
  for (const s of secured) {
    const p = byId.get(s.id.toLowerCase())
    out[s.column] = { read: (p?.CanRead ?? 0) > 0, create: (p?.CanCreate ?? 0) > 0, update: (p?.CanUpdate ?? 0) > 0 }
  }
  return out
}

/** Whether the user may do `what` with the column. Unknown rights (null) and columns outside field security allow it: the form
    stays open and a refusal is caught on the write instead (`writeAroundSecured`). */
export const may = (rights: Rights | null, column: string, what: keyof ColumnRights): boolean => !rights || !(column in rights) || rights[column]![what]

/** The columns of `body` the user may not write, and the body without them. */
export const withoutLocked = <T extends Record<string, unknown>>(body: T, locked: (column: string) => boolean): { body: T; skipped: string[] } => {
  const skipped = Object.keys(body).filter(locked)
  if (!skipped.length) return { body, skipped }
  const rest = { ...body }
  for (const k of skipped) delete rest[k]
  return { body: rest, skipped }
}

/** Writes `body`; when Dataverse refuses it for a secured column, writes it again without the entity's secured columns. Returns
    what the write returned and the columns left out, so the caller can say which values did not reach Dynamics. */
export const writeAroundSecured = async <T, B extends Record<string, unknown>>(
  body: B,
  write: (b: B) => Promise<T>,
  securedColumns: () => Promise<string[]>,
  refusal: (e: unknown) => boolean,
): Promise<{ result: T; skipped: string[] }> => {
  try {
    return { result: await write(body), skipped: [] }
  } catch (e) {
    if (!refusal(e)) throw e
    const secured = new Set(await securedColumns())
    const { body: rest, skipped } = withoutLocked(body, (k) => secured.has(k))
    if (!skipped.length) throw e
    return { result: await write(rest), skipped }
  }
}

/** The portal's names for the secured columns it edits, for the messages. */
export const COLUMN_LABEL: Record<string, string> = {
  k7_incidentid: 'Incident ID',
  k7_productversion: 'Product version',
  k7_module: 'Module',
  k7_submodule: 'Sub module',
  k7_yodizid: 'YODIZ id',
}

export const columnList = (columns: string[]): string => {
  const names = columns.map((c) => COLUMN_LABEL[c] ?? c)
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** The columns of a case the portal shows and edits that field security can lock. */
export const CASE_LOCKABLE = ['k7_productversion', 'k7_incidentid', 'k7_module', 'k7_submodule'] as const

/** Under a locked field in a form. */
export const LOCKED_HINT = 'Locked: Dynamics field security does not let your user set this.'

/** After a save that left columns out. */
export const notSaved = (columns: string[]): string =>
  columns.length ? `${columnList(columns)} ${columns.length > 1 ? 'were' : 'was'} not saved: Dynamics field security does not let your user set ${columns.length > 1 ? 'them' : 'it'}.` : ''

/** The `skipped` query parameter, kept to the columns the portal names (never echoed as given). */
export const skippedFrom = (param: string | undefined): string[] => (param ?? '').split(',').filter((k) => k in COLUMN_LABEL)
