/* Shared types for Dataverse rows. Formatted values arrive as `<field>@OData.Community.Display.V1.FormattedValue`
   when `odata.include-annotations="*"` is sent; `fv()` reads them. */

export const FV = '@OData.Community.Display.V1.FormattedValue'
export const LOOKUP_NAME = '@Microsoft.Dynamics.CRM.lookuplogicalname'

export type Row = Record<string, unknown>

/** The formatted (display) value of a column, falling back to the raw value as a string. */
export const fv = (row: Row, field: string): string => {
  const f = row[`${field}${FV}`]
  if (typeof f === 'string') return f
  const v = row[field]
  if (v === null || v === undefined) return ''
  return String(v)
}

/** The raw value of a column, typed. */
export const raw = <T = unknown>(row: Row, field: string): T | null => (row[field] === undefined ? null : (row[field] as T))

/** A lookup column `_x_value` as { id, name, logicalName }. */
export const lookup = (row: Row, field: string): { id: string; name: string; logicalName: string } | null => {
  const key = `_${field}_value`
  const id = row[key]
  if (typeof id !== 'string' || !id) return null
  return { id, name: fv(row, key), logicalName: String(row[`${key}${LOOKUP_NAME}`] ?? '') }
}

export type Page<T> = {
  value: T[]
  nextLink?: string
  /** Total when requested (`$count=true` is capped at 5,000; FetchXML `returntotalrecordcount` likewise). */
  total?: number
  totalLimitExceeded?: boolean
  pagingCookie?: string
  moreRecords?: boolean
}

/** Token sources: an agent acts as themselves; the service identity carries customer traffic. */
export type DataverseAuth = { kind: 'agent'; token: string; userId?: string } | { kind: 'service' }
