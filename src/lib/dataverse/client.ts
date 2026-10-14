import 'server-only'
import dns from 'node:dns'

import { dataverseHost, dataverseUrl, isProductionHost, serviceToken } from './auth'
import { DataverseError, ProductionWriteRefused, WritesDisabled } from './errors'
import type { DataverseAuth, Page, Row } from './types'

/* The one place that talks to Dataverse (docs/support-portal/08-implementation-plan.md §3).
   First line of business: production is read-only for this portal, whatever the environment says. */

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export type CallOptions = {
  body?: unknown
  /** Extra `Prefer` directives; `odata.include-annotations="*"` is always sent. */
  prefer?: string[]
  headers?: Record<string, string>
  /** For PATCH: the record's etag, or `*` to require that the record exists. */
  ifMatch?: string
  /** Page size hint for collection GETs. */
  maxPageSize?: number
  /** Return the raw Response (file downloads). */
  raw?: boolean
}

const API = '/api/data/v9.2/'

// The development network drops IPv6 to Microsoft (dataverse-uat-environment memory); the probe scripts prefer IPv4 too.
try {
  dns.setDefaultResultOrder('ipv4first')
} catch {
  /* older runtimes */
}

/** Guard applied before any network call. Exported so a unit test can pin it. */
export const assertWriteAllowed = (method: Method, url: string, env: NodeJS.ProcessEnv = process.env): void => {
  if (method === 'GET') return
  const host = new URL(url).host.toLowerCase()
  if (isProductionHost(host)) throw new ProductionWriteRefused(method, host)
  if (env.DATAVERSE_WRITES_ENABLED !== '1') throw new WritesDisabled(method)
}

/** Actions and `$batch` are POSTs; they fall under the same guard. */
const isWrite = (method: Method) => method !== 'GET'

const bearer = async (auth: DataverseAuth): Promise<string> => (auth.kind === 'agent' ? auth.token : serviceToken())

const correlation = (r: Response): string | undefined => r.headers.get('x-ms-service-request-id') ?? r.headers.get('REQ_ID') ?? undefined

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

/** One call. Collections come back as `{ value, @odata.nextLink }`; single records as the record; actions as their response. */
export async function callDataverse<T = unknown>(auth: DataverseAuth, method: Method, pathOrUrl: string, opts: CallOptions = {}): Promise<T> {
  const base = dataverseUrl()
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : base + API + pathOrUrl
  assertWriteAllowed(method, url)
  if (pathOrUrl.startsWith('http') && new URL(url).host.toLowerCase() !== dataverseHost(base)) throw new Error('Refusing to follow a link to another host')

  const prefer = ['odata.include-annotations="*"', ...(opts.prefer ?? [])]
  if (opts.maxPageSize) prefer.push(`odata.maxpagesize=${opts.maxPageSize}`)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await bearer(auth)}`,
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
    Accept: 'application/json',
    Prefer: prefer.join(','),
    ...opts.headers,
  }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8'
  if (opts.ifMatch) headers['If-Match'] = opts.ifMatch

  const attempts = isWrite(method) ? 2 : 3
  for (let attempt = 1; ; attempt++) {
    let r: Response
    try {
      r = await fetch(url, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), cache: 'no-store', signal: AbortSignal.timeout(45_000) })
    } catch (e) {
      const cause = (e as { cause?: { code?: string; message?: string } }).cause
      console.error(`[dataverse] ${method} ${pathOrUrl.split('?')[0]?.replace(/\(.*$/, '')} → network: ${(e as Error).name} ${cause?.code ?? ''} ${cause?.message ?? (e as Error).message}`.trim())
      // Reads are safe to retry; a write may already have landed, so it surfaces as an error.
      if (method === 'GET' && attempt < attempts) {
        await sleep(500 * attempt)
        continue
      }
      throw new DataverseError('The support system could not be reached.', { status: 0, code: cause?.code ?? (e as Error).name })
    }
    if (r.status === 429 && attempt < attempts) {
      const after = Number(r.headers.get('Retry-After') ?? 2)
      await sleep(Math.min(after, 20) * 1000 + Math.random() * 250)
      continue
    }
    if (!r.ok) {
      let code: string | undefined
      let message = `${r.status} ${r.statusText}`
      try {
        const j = (await r.json()) as { error?: { code?: string; message?: string } }
        code = j.error?.code
        if (j.error?.message) message = j.error.message
      } catch {
        /* no body */
      }
      // Operational log without bodies (07-production-safety.md §1b): method, entity set, status, OData code and correlation id.
      console.error(`[dataverse] ${method} ${pathOrUrl.split('?')[0]?.replace(/\(.*$/, '')} → ${r.status}${code ? ` ${code}` : ''}: ${message.slice(0, 300)}${correlation(r) ? ` [${correlation(r)}]` : ''}`)
      throw new DataverseError(message, { status: r.status, code, correlationId: correlation(r), retryAfter: r.status === 429 ? Number(r.headers.get('Retry-After') ?? 0) : undefined })
    }
    if (opts.raw) return r as unknown as T
    if (r.status === 204) {
      // Create/update without return=representation: expose the id from OData-EntityId.
      const entityId = r.headers.get('OData-EntityId')
      return (entityId ? { id: entityId.match(/\(([0-9a-f-]{36})\)/i)?.[1] } : {}) as T
    }
    return (await r.json()) as T
  }
}

type Collection = { value: Row[]; '@odata.nextLink'?: string; '@odata.count'?: number; '@Microsoft.Dynamics.CRM.totalrecordcount'?: number; '@Microsoft.Dynamics.CRM.totalrecordcountlimitexceeded'?: boolean; '@Microsoft.Dynamics.CRM.fetchxmlpagingcookie'?: string; '@Microsoft.Dynamics.CRM.morerecords'?: boolean }

const toPage = <T extends Row>(c: Collection): Page<T> => ({
  value: c.value as T[],
  nextLink: c['@odata.nextLink'],
  total: c['@odata.count'] ?? (c['@Microsoft.Dynamics.CRM.totalrecordcount'] !== undefined && c['@Microsoft.Dynamics.CRM.totalrecordcount'] >= 0 ? c['@Microsoft.Dynamics.CRM.totalrecordcount'] : undefined),
  totalLimitExceeded: c['@Microsoft.Dynamics.CRM.totalrecordcountlimitexceeded'],
  pagingCookie: decodePagingCookie(c['@Microsoft.Dynamics.CRM.fetchxmlpagingcookie']),
  moreRecords: c['@Microsoft.Dynamics.CRM.morerecords'],
})

/** The paging cookie comes back wrapped: `<cookie pagenumber="2" pagingcookie="%253ccookie…" …/>`; FetchXML wants the inner value decoded once. */
const decodePagingCookie = (wrapped?: string): string | undefined => {
  if (!wrapped) return undefined
  const m = wrapped.match(/pagingcookie="([^"]*)"/)
  if (!m) return undefined
  try {
    return decodeURIComponent(decodeURIComponent(m[1]!))
  } catch {
    return undefined
  }
}

/** A page of a collection query (`entitySet?$select=…`). */
export const list = async <T extends Row = Row>(auth: DataverseAuth, query: string, maxPageSize = 25): Promise<Page<T>> =>
  toPage<T>(await callDataverse<Collection>(auth, 'GET', query, { maxPageSize }))

/** The next page of a previous `list`, following `@odata.nextLink` verbatim. */
export const nextPage = async <T extends Row = Row>(auth: DataverseAuth, nextLink: string, maxPageSize = 25): Promise<Page<T>> =>
  toPage<T>(await callDataverse<Collection>(auth, 'GET', nextLink, { maxPageSize }))

/** One record by key. */
export const retrieve = async <T extends Row = Row>(auth: DataverseAuth, path: string): Promise<T> => callDataverse<T>(auth, 'GET', path)

/** A FetchXML query against an entity set (`incidents?fetchXml=…`). Aggregates and saved-view fetches go through here. */
export const fetchXml = async <T extends Row = Row>(auth: DataverseAuth, entitySet: string, xml: string): Promise<Page<T>> =>
  toPage<T>(await callDataverse<Collection>(auth, 'GET', `${entitySet}?fetchXml=${encodeURIComponent(xml)}`))

/** Create; returns the new id. */
export const create = async (auth: DataverseAuth, entitySet: string, body: Row, headers?: Record<string, string>): Promise<string> => {
  const r = await callDataverse<{ id?: string }>(auth, 'POST', entitySet, { body, headers })
  if (!r.id) throw new DataverseError('Create returned no id', { status: 500 })
  return r.id
}

/** Update only the given fields; `If-Match: *` by default so a wrong id never creates a record. */
export const update = async (auth: DataverseAuth, path: string, body: Row, etag = '*'): Promise<void> => {
  await callDataverse(auth, 'PATCH', path, { body, ifMatch: etag })
}

/** A bound or unbound action (`CloseIncident`, `AddToQueue`, …). */
export const action = async <T = unknown>(auth: DataverseAuth, name: string, body: Row): Promise<T> => callDataverse<T>(auth, 'POST', name, { body })

export const whoAmI = async (auth: DataverseAuth): Promise<{ UserId: string; BusinessUnitId: string; OrganizationId: string }> => callDataverse(auth, 'GET', 'WhoAmI')
