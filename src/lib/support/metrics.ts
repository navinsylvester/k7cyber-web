import 'server-only'

import { and, buildQuery, fetchXml, list, nextPage, type DataverseAuth, type Page, type Row, fv } from '@/lib/dataverse'

import { csatInPeriod, openFollowUps } from './csat'
import { causeOf, facetLines, isUnhappy, summarise, type CsatRow, type CsatSummary } from './csat-model'
import type { ChartSeries } from './dashboards'
import { KPI_DEFS, kpiDef, periodBounds, resolveTarget, type KpiKey, type KpiSetting, type Period, type Settings, type TargetRule } from './kpi-model'
import { forget, memo } from './memo'
import { label as optLabel, ORIGIN, PRIORITY, PRIORITY_CRITICAL, STATE, STATUS, VERTICAL } from './options'
import { crmKpiState, median, NO_READING, pct, readSla, workingDaysBetween, workingMinutesBetween, type SlaReading, type SlaState } from './sla'
import { caseStatusLabel } from './status'
import { followUps, inBin, isAutomated, openFollowUp, type Msg } from './clocks'
import { activeWatchRows, clockRunsEnded, type ClockRun, type WatchRow } from './watch-store'

/* The manager's numbers (09-portal-guide.md §4c). Raw rows are fetched once per period and memoised for 90 seconds across managers
   (the desk is one desk); every reading is recomputed per request from the current settings, so a changed target applies at once.
   Sizes: UAT holds ~214 active and ~1,000 resolved a month; production ~500 and ~2,300. Five pages of 500 at most per query. */

export type Owner = { id: string; name: string; kind: 'user' | 'team' | 'shared' | 'none' }

export type CaseLite = {
  id: string
  ticket: string
  title: string
  createdon: Date
  modifiedon: Date
  statecode: number
  statuscode: number
  status: string
  priority: number | null
  origin: number | null
  vertical: number | null
  fcr: boolean | null
  onHold: number
  escalated: boolean
  owner: Owner
  /** Who last changed the case (the watch: an owner who took the case themselves needs no telling). */
  modifiedById: string
  product: string
  issue: string
  customer: string
  /** The account or contact the case names as its customer, for CSAT and the care band. */
  customerId: string
  customerKind: 'account' | 'contact' | ''
  customerEmail: string
  contactId: string
  /** Raised through the portal (origin Web or the portal's attribution field). */
  portal: boolean
  /** From incidentresolution when one exists in the window, else modifiedon of a resolved case. */
  resolvedAt: Date | null
  resolutions: number
  reopened: boolean
  firstResponseAt: Date | null
  crm: { name: string; state: SlaState; failure: Date | null } | null
  target: TargetRule
  waiting: boolean
  resolve: SlaReading
  response: SlaReading
  /** The customer's last message and the last answer (active cases; automatic mail left out). */
  lastInAt: Date | null
  lastOutAt: Date | null
  /** The follow-up waiting for an answer, from the customer's message (clocks.ts). */
  followUpSince: Date | null
  followUp: SlaReading
  /** In a bin (not owned by an engineer) since. */
  binSince: Date | null
  pickup: SlaReading
  /** Sample with the Lab since (first seen In Progress-Lab), until the case is resolved. */
  labSince: Date | null
  lab: SlaReading
}

type RawDesk = {
  fetchedAt: Date
  from: Date
  to: Date
  active: Row[]
  resolved: Row[]
  resolutions: Map<string, { latest: Date; count: number }>
  reopenedActive: Set<string>
  firstTouch: Map<string, Date>
  touchesByOwner: Map<string, { emails: number; notes: number }>
  crm: Map<string, { name: string; status: number; failure: Date | null }>
  crmBreachesInPeriod: number
  /** Active cases: the customer's last message and the last answer, automatic mail left out. */
  lastIn: Map<string, Date>
  lastOut: Map<string, Date>
  /** Active cases: when the case entered its current queue (the owner's queue on assignment). */
  queueSince: Map<string, Date>
  /** Messages each way from a week before the period to its end, per case: the follow-ups the period answered. */
  messages: Map<string, Msg[]>
  warnings: string[]
  truncated: boolean
}

export type Desk = RawDesk & {
  period: Period
  now: Date
  settings: Settings
  cases: CaseLite[]
  activeCases: CaseLite[]
  resolvedCases: CaseLite[]
  createdCases: CaseLite[]
  workingDays: number
  /** Survey rows answered (or sent and unanswered) in the period, from Payload; never memoised. */
  csat: CsatRow[]
  /** Low scores whose follow-up is still open, whatever the period. */
  followUps: CsatRow[]
  csatSummary: CsatSummary
  /** Pick-up and Lab runs the watch saw finish in the period (watch-store.ts). */
  clockRuns: ClockRun[]
}

const SELECT = [
  'incidentid', 'ticketnumber', 'title', 'createdon', 'modifiedon', 'statecode', 'statuscode', 'prioritycode', 'caseorigincode', 'new_verticaltype', 'k7_caseconsideredas',
  'onholdtime', 'isescalated', '_ownerid_value', '_modifiedby_value', '_productid_value', '_new_issue_value', '_customerid_value', '_primarycontactid_value', 'k7_customeremail', 'adx_createdbyusername',
] as const

const PAGE = 500
const MAX_PAGES = 10

const walk = async (auth: DataverseAuth, query: string, warnings: string[], what: string): Promise<{ rows: Row[]; truncated: boolean }> => {
  const rows: Row[] = []
  let page: Page<Row> = await list<Row>(auth, query, PAGE)
  rows.push(...page.value)
  let n = 1
  while (page.nextLink && n < MAX_PAGES) {
    page = await nextPage<Row>(auth, page.nextLink, PAGE)
    rows.push(...page.value)
    n++
  }
  const truncated = Boolean(page.nextLink)
  if (truncated) warnings.push(`${what}: only the first ${(MAX_PAGES * PAGE).toLocaleString('en-IN')} rows were read; shorten the period.`)
  return { rows, truncated }
}

const iso = (d: Date) => d.toISOString()
const dateOf = (v: unknown): Date | null => {
  if (typeof v !== 'string' || !v) return null
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

/** Shared mailboxes and system accounts own cases in Dynamics; they are not engineers. */
export const SHARED_OWNER = /^(system|integration|k7 computing|k7 level ?\d+|support ?#?|.*#\s*)$/i

const ownerOf = (r: Row): Owner => {
  const id = String(r._ownerid_value ?? '')
  if (!id) return { id: '', name: 'Unassigned', kind: 'none' }
  const name = fv(r, '_ownerid_value') || 'Unknown'
  const logical = String(r['_ownerid_value@Microsoft.Dynamics.CRM.lookuplogicalname'] ?? '')
  if (logical === 'team') return { id, name, kind: 'team' }
  return { id, name, kind: SHARED_OWNER.test(name) ? 'shared' : 'user' }
}

/* ---------- Raw fetch (memoised) ---------- */

const xmlEsc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** A subject prefix as a LIKE pattern: the wildcards in it are literal. */
const likePrefix = (p: string) => `${xmlEsc(p.replace(/[[\]%_]/g, (c) => `[${c}]`))}%`
/** FetchXML: the email is not the CRM's automatic mail (an empty subject is not automatic). */
const notAutomated = (prefixes: string[]) =>
  prefixes.length ? `<filter type="or"><condition attribute="subject" operator="null" /><filter type="and">${prefixes.map((p) => `<condition attribute="subject" operator="not-like" value="${likePrefix(p)}" />`).join('')}</filter></filter>` : ''
const ACTIVE_CASE = (to: string) => `<link-entity name="incident" from="incidentid" to="${to}" link-type="inner"><filter><condition attribute="statecode" operator="eq" value="0" /></filter></link-entity>`
const maxBy = (rows: Row[], into: Map<string, Date>) => {
  for (const r of rows) {
    const id = String(r.c ?? '')
    const d = dateOf(r.last)
    if (!id || !d) continue
    const cur = into.get(id)
    if (!cur || d > cur) into.set(id, d)
  }
}

const fetchRaw = async (auth: DataverseAuth, from: Date, to: Date, automated: string[]): Promise<RawDesk> => {
  const warnings: string[] = []
  const fromIso = iso(from)
  const toIso = iso(to)
  const resolvedFilter = and(`statecode eq ${STATE.RESOLVED}`, `modifiedon ge ${fromIso}`, `modifiedon lt ${toIso}`)
  const windowIso = iso(new Date(from.getTime() - 7 * 864e5))
  const auto = notAutomated(automated)
  const none = { value: [] as Row[] }
  const soft = (what: string) => (e: unknown) => {
    warnings.push(`${what} unavailable: ${(e as Error).message}`)
    return none
  }
  const [lastInEmails, lastOutEmails, lastInNotes, lastOutNotes, queueItems, windowEmails, windowNotes] = await Promise.all([
    // The clocks added on 2026-11-27: the last message each way on active cases, the queue each case sits in, and the
    // messages of the period (with a week before it) for the follow-up card.
    fetchXml<Row>(auth, 'emails', `<fetch aggregate="true"><entity name="email"><attribute name="createdon" aggregate="max" alias="last" /><attribute name="regardingobjectid" groupby="true" alias="c" /><filter><condition attribute="directioncode" operator="eq" value="0" /><condition attribute="regardingobjecttypecode" operator="eq" value="112" /></filter>${ACTIVE_CASE('regardingobjectid')}</entity></fetch>`).catch(soft('Customer emails')),
    fetchXml<Row>(auth, 'emails', `<fetch aggregate="true"><entity name="email"><attribute name="createdon" aggregate="max" alias="last" /><attribute name="regardingobjectid" groupby="true" alias="c" /><filter><condition attribute="directioncode" operator="eq" value="1" /><condition attribute="statecode" operator="eq" value="1" /><condition attribute="regardingobjecttypecode" operator="eq" value="112" />${auto}</filter>${ACTIVE_CASE('regardingobjectid')}</entity></fetch>`).catch(soft('Answers (emails)')),
    fetchXml<Row>(auth, 'annotations', `<fetch aggregate="true"><entity name="annotation"><attribute name="createdon" aggregate="max" alias="last" /><attribute name="objectid" groupby="true" alias="c" /><filter><condition attribute="objecttypecode" operator="eq" value="112" /><condition attribute="subject" operator="like" value="Portal:%" /></filter>${ACTIVE_CASE('objectid')}</entity></fetch>`).catch(soft('Portal replies')),
    fetchXml<Row>(auth, 'annotations', `<fetch aggregate="true"><entity name="annotation"><attribute name="createdon" aggregate="max" alias="last" /><attribute name="objectid" groupby="true" alias="c" /><filter><condition attribute="objecttypecode" operator="eq" value="112" /><condition attribute="subject" operator="like" value="Reply to customer%" /></filter>${ACTIVE_CASE('objectid')}</entity></fetch>`).catch(soft('Answers (portal)')),
    walk(auth, buildQuery('queueitems', { select: ['enteredon', '_objectid_value'], filter: 'objecttypecode eq 112 and statecode eq 0' }), warnings, 'Queue items').catch((e) => {
      warnings.push(`Queue items unavailable: ${(e as Error).message}`)
      return { rows: [] as Row[], truncated: false }
    }),
    fetchXml<Row>(auth, 'emails', `<fetch count="5000"><entity name="email"><attribute name="createdon" /><attribute name="directioncode" /><attribute name="statecode" /><attribute name="subject" /><attribute name="regardingobjectid" /><filter><condition attribute="regardingobjecttypecode" operator="eq" value="112" /><condition attribute="createdon" operator="ge" value="${windowIso}" /><condition attribute="createdon" operator="lt" value="${toIso}" /></filter></entity></fetch>`).catch(soft('Emails of the period')),
    fetchXml<Row>(auth, 'annotations', `<fetch count="5000"><entity name="annotation"><attribute name="createdon" /><attribute name="subject" /><attribute name="objectid" /><filter><condition attribute="objecttypecode" operator="eq" value="112" /><condition attribute="createdon" operator="ge" value="${windowIso}" /><condition attribute="createdon" operator="lt" value="${toIso}" /><filter type="or"><condition attribute="subject" operator="like" value="Portal:%" /><condition attribute="subject" operator="like" value="Reply to customer%" /></filter></filter></entity></fetch>`).catch(soft('Portal messages of the period')),
  ])
  const [active, resolved, res, reopened, touchEmails, touchNotes, perOwnerEmails, perOwnerNotes, crm] = await Promise.all([
    walk(auth, buildQuery('incidents', { select: [...SELECT], filter: `statecode eq ${STATE.ACTIVE}`, orderby: 'createdon asc' }), warnings, 'Active cases'),
    walk(auth, buildQuery('incidents', { select: [...SELECT], filter: resolvedFilter, orderby: 'modifiedon desc' }), warnings, 'Resolved cases'),
    walk(auth, buildQuery('incidentresolutions', { select: ['activityid', 'createdon', '_incidentid_value'], filter: and(`createdon ge ${fromIso}`, `createdon lt ${toIso}`), orderby: 'createdon desc' }), warnings, 'Resolutions').catch((e) => {
      warnings.push(`Resolutions unavailable: ${(e as Error).message}`)
      return { rows: [] as Row[], truncated: false }
    }),
    fetchXml<Row>(auth, 'incidents', `<fetch distinct="true"><entity name="incident"><attribute name="incidentid" /><filter><condition attribute="statecode" operator="eq" value="0" /></filter><link-entity name="incidentresolution" from="incidentid" to="incidentid" link-type="inner" /></entity></fetch>`).catch(() => ({ value: [] as Row[] })),
    // First touch: the earliest outgoing email per case, for active cases and cases touched in the period.
    fetchXml<Row>(
      auth,
      'emails',
      `<fetch aggregate="true"><entity name="email"><attribute name="createdon" aggregate="min" alias="first" /><attribute name="regardingobjectid" groupby="true" alias="c" /><filter><condition attribute="directioncode" operator="eq" value="1" /><condition attribute="statecode" operator="ne" value="2" /><condition attribute="regardingobjecttypecode" operator="eq" value="112" />${auto}</filter><link-entity name="incident" from="incidentid" to="regardingobjectid" link-type="inner"><filter type="or"><condition attribute="statecode" operator="eq" value="0" /><condition attribute="modifiedon" operator="on-or-after" value="${fromIso}" /></filter></link-entity></entity></fetch>`,
    ).catch((e) => {
      warnings.push(`First response (emails) unavailable: ${(e as Error).message}`)
      return { value: [] as Row[] }
    }),
    // …and the earliest desk note (notes from the portal's customers start with "Portal:" and do not count).
    fetchXml<Row>(
      auth,
      'annotations',
      `<fetch aggregate="true"><entity name="annotation"><attribute name="createdon" aggregate="min" alias="first" /><attribute name="objectid" groupby="true" alias="c" /><filter><condition attribute="objecttypecode" operator="eq" value="112" /><filter type="or"><condition attribute="subject" operator="null" /><condition attribute="subject" operator="not-like" value="Portal:%" /></filter></filter><link-entity name="incident" from="incidentid" to="objectid" link-type="inner"><filter type="or"><condition attribute="statecode" operator="eq" value="0" /><condition attribute="modifiedon" operator="on-or-after" value="${fromIso}" /></filter></link-entity></entity></fetch>`,
    ).catch((e) => {
      warnings.push(`First response (notes) unavailable: ${(e as Error).message}`)
      return { value: [] as Row[] }
    }),
    fetchXml<Row>(
      auth,
      'emails',
      `<fetch aggregate="true"><entity name="email"><attribute name="activityid" aggregate="count" alias="n" /><attribute name="ownerid" groupby="true" alias="o" /><filter><condition attribute="directioncode" operator="eq" value="1" /><condition attribute="regardingobjecttypecode" operator="eq" value="112" /><condition attribute="createdon" operator="on-or-after" value="${fromIso}" /><condition attribute="createdon" operator="on-or-before" value="${toIso}" /></filter></entity></fetch>`,
    ).catch(() => ({ value: [] as Row[] })),
    fetchXml<Row>(
      auth,
      'annotations',
      `<fetch aggregate="true"><entity name="annotation"><attribute name="annotationid" aggregate="count" alias="n" /><attribute name="createdby" groupby="true" alias="o" /><filter><condition attribute="objecttypecode" operator="eq" value="112" /><condition attribute="subject" operator="not-like" value="Portal:%" /><condition attribute="createdon" operator="on-or-after" value="${fromIso}" /><condition attribute="createdon" operator="on-or-before" value="${toIso}" /></filter></entity></fetch>`,
    ).catch(() => ({ value: [] as Row[] })),
    // The CRM's own KPI instances: running, nearing, paused and the breaches of the period, as evidence beside the portal's reading.
    fetchXml<Row>(
      auth,
      'slakpiinstances',
      `<fetch count="2000"><entity name="slakpiinstance"><attribute name="slakpiinstanceid" /><attribute name="name" /><attribute name="status" /><attribute name="failuretime" /><attribute name="warningtime" /><attribute name="regarding" /><attribute name="modifiedon" /><filter><condition attribute="regardingobjecttypecode" operator="eq" value="112" /><condition attribute="status" operator="ne" value="4" /><filter type="or"><condition attribute="status" operator="ne" value="1" /><condition attribute="modifiedon" operator="on-or-after" value="${fromIso}" /></filter></filter></entity></fetch>`,
    ).catch((e) => {
      warnings.push(`CRM KPI instances unavailable: ${(e as Error).message}`)
      return { value: [] as Row[] }
    }),
  ])

  const resolutions = new Map<string, { latest: Date; count: number }>()
  for (const r of res.rows) {
    const id = String(r._incidentid_value ?? '')
    const d = dateOf(r.createdon)
    if (!id || !d) continue
    const cur = resolutions.get(id)
    if (!cur) resolutions.set(id, { latest: d, count: 1 })
    else resolutions.set(id, { latest: d > cur.latest ? d : cur.latest, count: cur.count + 1 })
  }
  const firstTouch = new Map<string, Date>()
  for (const r of [...touchEmails.value, ...touchNotes.value]) {
    const id = String(r.c ?? '')
    const d = dateOf(r.first)
    if (!id || !d) continue
    const cur = firstTouch.get(id)
    if (!cur || d < cur) firstTouch.set(id, d)
  }
  const touchesByOwner = new Map<string, { emails: number; notes: number }>()
  for (const r of perOwnerEmails.value) {
    const id = String(r.o ?? '')
    const cur = touchesByOwner.get(id) ?? { emails: 0, notes: 0 }
    cur.emails += Number(r.n ?? 0)
    touchesByOwner.set(id, cur)
  }
  for (const r of perOwnerNotes.value) {
    const id = String(r.o ?? '')
    const cur = touchesByOwner.get(id) ?? { emails: 0, notes: 0 }
    cur.notes += Number(r.n ?? 0)
    touchesByOwner.set(id, cur)
  }
  const crmMap = new Map<string, { name: string; status: number; failure: Date | null }>()
  let crmBreachesInPeriod = 0
  for (const r of crm.value) {
    const id = String(r._regarding_value ?? '')
    const status = Number(r.status ?? -1)
    if (status === 1) crmBreachesInPeriod++
    const cur = crmMap.get(id)
    // Keep the worst reading per case: breached over nearing over running over paused.
    const rank = (s: number) => (s === 1 ? 3 : s === 2 ? 2 : s === 0 ? 1 : 0)
    if (!cur || rank(status) > rank(cur.status)) crmMap.set(id, { name: String(r.name ?? 'KPI'), status, failure: dateOf(r.failuretime) })
  }
  const lastIn = new Map<string, Date>()
  const lastOut = new Map<string, Date>()
  maxBy(lastInEmails.value, lastIn)
  maxBy(lastInNotes.value, lastIn)
  maxBy(lastOutEmails.value, lastOut)
  maxBy(lastOutNotes.value, lastOut)
  const queueSince = new Map<string, Date>()
  for (const q of queueItems.rows) {
    const id = String(q._objectid_value ?? '')
    const d = dateOf(q.enteredon)
    if (id && d && (!queueSince.has(id) || d > queueSince.get(id)!)) queueSince.set(id, d)
  }
  const messages = new Map<string, Msg[]>()
  const push = (id: string, m: Msg) => {
    if (!id) return
    const list = messages.get(id) ?? []
    list.push(m)
    messages.set(id, list)
  }
  for (const e of windowEmails.value) {
    const at = dateOf(e.createdon)
    if (!at) continue
    const incoming = e.directioncode === false
    // An answer is an email that went (completed) and is not the CRM's own mail; a customer's email always counts.
    if (!incoming && (Number(e.statecode) !== 1 || isAutomated(String(e.subject ?? ''), automated))) continue
    push(String(e._regardingobjectid_value ?? ''), { at, dir: incoming ? 'in' : 'out' })
  }
  for (const n of windowNotes.value) {
    const at = dateOf(n.createdon)
    if (at) push(String(n._objectid_value ?? ''), { at, dir: String(n.subject ?? '').startsWith('Portal:') ? 'in' : 'out' })
  }
  if (windowEmails.value.length >= 5000) warnings.push('Follow-ups: only the first 5,000 emails of the period were read; shorten the period.')
  return {
    fetchedAt: new Date(),
    from,
    to,
    lastIn,
    lastOut,
    queueSince,
    messages,
    active: active.rows,
    resolved: resolved.rows,
    resolutions,
    reopenedActive: new Set(reopened.value.map((r) => String(r.incidentid ?? ''))),
    firstTouch,
    touchesByOwner,
    crm: crmMap,
    crmBreachesInPeriod,
    warnings,
    truncated: active.truncated || resolved.truncated,
  }
}

const rawDesk = (auth: DataverseAuth, period: Period, from: Date, to: Date, shifted: boolean, automated: string[], fresh = false): Promise<RawDesk> => {
  const key = `desk:${period}:${shifted ? 'prev' : 'now'}:${automated.join('|')}`
  if (fresh) forget(key)
  return memo(key, 90_000, () => fetchRaw(auth, from, to, automated))
}

/* ---------- Readings ---------- */

const toLite = (r: Row, raw: RawDesk, s: Settings, now: Date, watch: Map<string, WatchRow>): CaseLite => {
  const id = String(r.incidentid)
  const createdon = dateOf(r.createdon) ?? now
  const modifiedon = dateOf(r.modifiedon) ?? createdon
  const statecode = Number(r.statecode ?? 0)
  const statuscode = Number(r.statuscode ?? 0)
  const priority = r.prioritycode === null || r.prioritycode === undefined ? null : Number(r.prioritycode)
  const origin = r.caseorigincode === null || r.caseorigincode === undefined ? null : Number(r.caseorigincode)
  const vertical = r.new_verticaltype === null || r.new_verticaltype === undefined ? null : Number(r.new_verticaltype)
  const fcr = r.k7_caseconsideredas === 696720000 ? true : r.k7_caseconsideredas === 696720001 ? false : null
  const onHold = s.subtractOnHold ? Number(r.onholdtime ?? 0) : 0
  const target = resolveTarget(s.targets, { vertical, priority, origin })
  const resolution = raw.resolutions.get(id)
  const resolvedAt = statecode === STATE.RESOLVED ? (resolution?.latest ?? modifiedon) : null
  const waiting = statecode === STATE.ACTIVE && statuscode === STATUS.IN_PROGRESS_CUSTOMER
  const paused = s.pauseWhileWaiting && waiting
  const firstResponseAt = s.phoneCountsAsResponded && origin === 1 ? createdon : (raw.firstTouch.get(id) ?? null)
  const resolve = readSla({ start: createdon, end: resolvedAt, now, targetMinutes: target.resolveMinutes, warnAtPercent: s.warnAtPercent, hours: s.hours, holdMinutes: onHold, paused })
  const response = statecode === STATE.ACTIVE || firstResponseAt
    ? readSla({ start: createdon, end: firstResponseAt ?? (statecode !== STATE.ACTIVE ? resolvedAt : null), now, targetMinutes: target.responseMinutes, warnAtPercent: s.warnAtPercent, hours: s.hours, paused })
    : NO_READING
  const owner = ownerOf(r)
  const active = statecode === STATE.ACTIVE
  const w = watch.get(id.toLowerCase())
  const lastInAt = active ? (raw.lastIn.get(id) ?? null) : null
  const lastOutAt = active ? (raw.lastOut.get(id) ?? null) : null
  const followUpSince = active ? openFollowUp({ lastIn: lastInAt, lastOut: lastOutAt, firstAnswer: firstResponseAt }) : null
  const followUp = followUpSince ? readSla({ start: followUpSince, now, targetMinutes: target.followUpMinutes, warnAtPercent: s.warnAtPercent, hours: s.hours }) : NO_READING
  // In a bin since: the watch saw it land; else the queue it entered on assignment; else its creation (a case created into the bin).
  const binSince = active && inBin(owner.kind) ? (w?.binSince ?? raw.queueSince.get(id) ?? createdon) : null
  const pickup = binSince ? readSla({ start: binSince, now, targetMinutes: target.pickupMinutes, warnAtPercent: s.warnAtPercent, hours: s.hours }) : NO_READING
  // With the Lab since: the watch saw the status change; a case already there when the watch first saw it counts from its last change.
  const labSince = active ? (w?.labSince ?? (statuscode === STATUS.IN_PROGRESS_LAB ? modifiedon : null)) : null
  const lab = labSince ? readSla({ start: labSince, now, targetMinutes: target.labMinutes, warnAtPercent: s.warnAtPercent, hours: s.hours }) : NO_READING
  const c = raw.crm.get(id)
  return {
    id,
    ticket: String(r.ticketnumber ?? ''),
    title: String(r.title ?? ''),
    createdon,
    modifiedon,
    statecode,
    statuscode,
    status: caseStatusLabel(r),
    priority,
    origin,
    vertical,
    fcr,
    onHold,
    escalated: r.isescalated === true,
    owner,
    modifiedById: String(r._modifiedby_value ?? ''),
    product: fv(r, '_productid_value'),
    issue: fv(r, '_new_issue_value'),
    customer: fv(r, '_customerid_value'),
    customerId: String(r._customerid_value ?? ''),
    customerKind: String(r['_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname'] ?? '') === 'account' ? 'account' : String(r['_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname'] ?? '') === 'contact' ? 'contact' : '',
    customerEmail: String(r.k7_customeremail ?? '').trim().toLowerCase(),
    contactId: String(r._primarycontactid_value ?? '') || (String(r['_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname'] ?? '') === 'contact' ? String(r._customerid_value ?? '') : ''),
    portal: origin === 3 || Boolean(r.adx_createdbyusername),
    resolvedAt,
    resolutions: resolution?.count ?? (statecode === STATE.RESOLVED ? 1 : 0),
    reopened: raw.reopenedActive.has(id) || (resolution?.count ?? 0) > 1,
    firstResponseAt,
    crm: c ? { name: c.name, state: crmKpiState(c.status), failure: c.failure } : null,
    target,
    waiting,
    resolve,
    response,
    lastInAt,
    lastOutAt,
    followUpSince,
    followUp,
    binSince,
    pickup,
    labSince,
    lab,
  }
}

export const loadDesk = async (auth: DataverseAuth, settings: Settings, period: Period, o: { previous?: boolean; now?: Date; /** Skip the 90-second memo (the notification watch). */ fresh?: boolean } = {}): Promise<Desk> => {
  const now = o.now ?? new Date()
  const b = periodBounds(period, now, settings.hours.timeZone)
  const from = o.previous ? new Date(b.from.getTime() - (b.to.getTime() - b.from.getTime())) : b.from
  const to = o.previous ? b.from : b.to
  const [raw, csat, csatFollowUps, watch, clockRuns] = await Promise.all([
    rawDesk(auth, period, from, to, Boolean(o.previous), settings.automatedSubjects, o.fresh),
    settings.csat.enabled ? csatInPeriod(from, to) : Promise.resolve([] as CsatRow[]),
    settings.csat.enabled && !o.previous ? openFollowUps() : Promise.resolve([] as CsatRow[]),
    o.previous ? Promise.resolve(new Map<string, WatchRow>()) : activeWatchRows(),
    clockRunsEnded(from, to),
  ])
  const activeCases = o.previous ? [] : raw.active.map((r) => toLite(r, raw, settings, now, watch))
  const resolvedCases = raw.resolved.map((r) => toLite(r, raw, settings, now, watch))
  const cases = [...activeCases, ...resolvedCases]
  const createdCases = cases.filter((c) => c.createdon >= from && c.createdon < to)
  return { ...raw, from, to, period, now, settings, cases, activeCases, resolvedCases, createdCases, workingDays: workingDaysBetween(from, to, settings.hours), csat, followUps: csatFollowUps, csatSummary: summarise(csat, settings.csat, settings.hours, now), clockRuns }
}

/* ---------- Summaries ---------- */

export type SlaNow = { ok: number; atRisk: number; breached: number; paused: number; responsePending: number; responseBreached: number; followUps: number; followUpsLate: number; inBin: number; inBinLate: number; withLab: number; withLabLate: number }

export const slaNow = (d: Desk): SlaNow => {
  const n: SlaNow = { ok: 0, atRisk: 0, breached: 0, paused: 0, responsePending: 0, responseBreached: 0, followUps: 0, followUpsLate: 0, inBin: 0, inBinLate: 0, withLab: 0, withLabLate: 0 }
  for (const c of d.activeCases) {
    if (c.resolve.state === 'ok') n.ok++
    else if (c.resolve.state === 'at-risk') n.atRisk++
    else if (c.resolve.state === 'breached') n.breached++
    else if (c.resolve.state === 'paused') n.paused++
    if (!c.firstResponseAt && c.response.state !== 'paused') {
      n.responsePending++
      if (c.response.state === 'breached') n.responseBreached++
    }
    if (c.followUpSince) {
      n.followUps++
      if (c.followUp.state === 'breached') n.followUpsLate++
    }
    if (c.binSince) {
      n.inBin++
      if (c.pickup.state === 'breached') n.inBinLate++
    }
    if (c.labSince) {
      n.withLab++
      if (c.lab.state === 'breached') n.withLabLate++
    }
  }
  return n
}

export type KpiValue = { def: ReturnType<typeof kpiDef>; setting: KpiSetting; value: number | null; target: number | null; met: boolean | null; previous: number | null; delta: number | null; n: number }

const kpiRaw = (d: Desk, key: KpiKey): { value: number | null; n: number } => {
  const resolved = d.resolvedCases
  const responded = d.createdCases.filter((c) => c.firstResponseAt)
  const unpausedActive = d.activeCases.filter((c) => c.resolve.state !== 'paused')
  switch (key) {
    case 'resolution-sla':
      return { value: pct(resolved.filter((c) => c.resolve.state === 'met').length, resolved.length), n: resolved.length }
    case 'response-sla': {
      // Cases created in the period: answered within target counts; still unanswered past target counts against.
      const pool = d.createdCases.filter((c) => c.firstResponseAt || c.response.state === 'breached')
      return { value: pct(pool.filter((c) => c.response.state === 'met').length, pool.length), n: pool.length }
    }
    case 'followup-sla': {
      const f = followUpsAnswered(d)
      return { value: pct(f.filter((x) => x.met).length, f.length), n: f.length }
    }
    case 'pickup-sla':
    case 'lab-sla': {
      const runs = d.clockRuns.filter((r) => r.clock === (key === 'pickup-sla' ? 'pickup' : 'lab'))
      return { value: pct(runs.filter((r) => r.met).length, runs.length), n: runs.length }
    }
    case 'median-resolution': {
      const m = median(resolved.map((c) => c.resolve.elapsed))
      return { value: m === null ? null : Math.round((m / 60) * 10) / 10, n: resolved.length }
    }
    case 'median-response': {
      const real = responded.filter((c) => !(d.settings.phoneCountsAsResponded && c.origin === 1))
      const m = median(real.map((c) => c.response.elapsed))
      return { value: m === null ? null : Math.round(m), n: real.length }
    }
    case 'fcr': {
      const known = resolved.filter((c) => c.fcr !== null)
      return { value: pct(known.filter((c) => c.fcr).length, known.length), n: known.length }
    }
    case 'throughput': {
      const engineers = new Set(resolved.filter((c) => c.owner.kind === 'user').map((c) => c.owner.id))
      return { value: engineers.size ? Math.round((resolved.length / engineers.size / d.workingDays) * 10) / 10 : null, n: resolved.length }
    }
    case 'backlog':
      return { value: unpausedActive.length, n: d.activeCases.length }
    case 'breached-open':
      return { value: d.activeCases.filter((c) => c.resolve.state === 'breached').length, n: d.activeCases.length }
    case 'at-risk':
      return { value: d.activeCases.filter((c) => c.resolve.state === 'at-risk').length, n: d.activeCases.length }
    case 'reopen-rate':
      return { value: pct(resolved.filter((c) => c.reopened).length + d.activeCases.filter((c) => c.reopened).length, resolved.length), n: resolved.length }
    case 'oldest-open': {
      const oldest = unpausedActive.reduce<CaseLite | null>((a, c) => (!a || c.createdon < a.createdon ? c : a), null)
      return { value: oldest ? Math.round((workingMinutesBetween(oldest.createdon, d.now, d.settings.hours) / 60) * 10) / 10 : null, n: unpausedActive.length }
    }
    case 'csat':
      return { value: d.csatSummary.csat, n: d.csatSummary.responses }
    case 'csat-average':
      return { value: d.csatSummary.average, n: d.csatSummary.responses }
    case 'csat-response-rate':
      return { value: d.csatSummary.responseRate, n: d.csatSummary.invited }
    case 'csat-unhappy':
      return { value: d.followUps.length, n: d.followUps.filter((r) => d.csat.some((x) => x.id === r.id)).length }
    case 'csat-followup':
      return { value: d.csatSummary.followUpPct, n: d.csatSummary.followUpsClosed }
  }
}

/** The customer's follow-ups answered in the period, each against its case's follow-up target in working minutes. Cases the
    period does not know (resolved before it) are left out. */
export const followUpsAnswered = (d: Desk, ownerId?: string): { caseId: string; minutes: number; target: number; met: boolean }[] => {
  const byId = new Map(d.cases.map((c) => [c.id.toLowerCase(), c]))
  const out: { caseId: string; minutes: number; target: number; met: boolean }[] = []
  for (const [id, msgs] of d.messages) {
    const c = byId.get(id.toLowerCase())
    if (!c || (ownerId && c.owner.id !== ownerId)) continue
    for (const f of followUps(msgs, c.firstResponseAt)) {
      if (!f.end || f.end < d.from || f.end >= d.to) continue
      const minutes = workingMinutesBetween(f.start, f.end, d.settings.hours)
      out.push({ caseId: c.id, minutes, target: c.target.followUpMinutes, met: minutes <= c.target.followUpMinutes })
    }
  }
  return out
}

/** Only period-based KPIs have a previous value; the point-in-time ones (backlog, at risk, oldest) do not. */
const PERIOD_KPIS = new Set<KpiKey>(['resolution-sla', 'response-sla', 'followup-sla', 'pickup-sla', 'lab-sla', 'median-resolution', 'median-response', 'fcr', 'throughput', 'reopen-rate', 'csat', 'csat-average', 'csat-response-rate', 'csat-followup'])

/** Cards that need the CSAT feature on; hidden when it is off. */
const CSAT_KPIS = new Set<KpiKey>(['csat', 'csat-average', 'csat-response-rate', 'csat-unhappy', 'csat-followup'])

export const kpiValues = (d: Desk, prev?: Desk | null): KpiValue[] =>
  d.settings.kpis
    .filter((k) => k.enabled && KPI_DEFS.some((x) => x.key === k.key) && (d.settings.csat.enabled || !CSAT_KPIS.has(k.key)))
    .map((setting) => {
      const def = kpiDef(setting.key)
      const { value, n } = kpiRaw(d, setting.key)
      const previous = prev && PERIOD_KPIS.has(setting.key) ? kpiRaw(prev, setting.key).value : null
      const target = setting.target
      const met = value === null || target === null ? null : def.direction === 'up' ? value >= target : value <= target
      const delta = value !== null && previous !== null ? Math.round((value - previous) * 10) / 10 : null
      return { def, setting, value, target, met, previous, delta, n }
    })

export { fmtKpi } from './kpi-model'

/* ---------- Engineers ---------- */

export type EngineerStats = {
  owner: Owner
  active: number
  atRisk: number
  breached: number
  waiting: number
  critical: number
  oldestHours: number | null
  resolved: number
  resolvedWithin: number
  resolvePct: number | null
  medianResolveHours: number | null
  responded: number
  respondedWithin: number
  responsePct: number | null
  medianResponseMin: number | null
  fcr: number
  fcrKnown: number
  fcrPct: number | null
  reopened: number
  emails: number
  notes: number
  touchesPerResolved: number | null
  perDay: number | null
  /** Survey responses on the engineer's cases in the period, the mean score, the satisfied share and the low scores. */
  csatResponses: number
  csatAverage: number | null
  csatPct: number | null
  csatUnhappy: number
  /** Low scores the customer or a manager laid at support's door (as against the product or licensing), so an engineer is not
     marked down for a defect. */
  csatUnhappySupport: number
  /** 0..100: a composite of SLA, FCR, CSAT (when the engineer has responses), load and freshness for sorting cards, never shown as a grade. */
  score: number
}

export const engineerStats = (d: Desk, o: { includeShared?: boolean } = {}): EngineerStats[] => {
  const by = new Map<string, EngineerStats>()
  const get = (owner: Owner): EngineerStats => {
    const key = owner.kind === 'user' ? owner.id : `${owner.kind}:${owner.id}`
    let e = by.get(key)
    if (!e) {
      e = { owner, active: 0, atRisk: 0, breached: 0, waiting: 0, critical: 0, oldestHours: null, resolved: 0, resolvedWithin: 0, resolvePct: null, medianResolveHours: null, responded: 0, respondedWithin: 0, responsePct: null, medianResponseMin: null, fcr: 0, fcrKnown: 0, fcrPct: null, reopened: 0, emails: 0, notes: 0, touchesPerResolved: null, perDay: null, csatResponses: 0, csatAverage: null, csatPct: null, csatUnhappy: 0, csatUnhappySupport: 0, score: 0 }
      by.set(key, e)
    }
    return e
  }
  const resolveTimes = new Map<string, number[]>()
  const responseTimes = new Map<string, number[]>()
  for (const c of d.activeCases) {
    const e = get(c.owner)
    e.active++
    if (c.resolve.state === 'at-risk') e.atRisk++
    if (c.resolve.state === 'breached') e.breached++
    if (c.waiting) e.waiting++
    if (c.priority === PRIORITY_CRITICAL || c.priority === 1) e.critical++
    if (c.resolve.state !== 'paused') {
      const h = workingMinutesBetween(c.createdon, d.now, d.settings.hours) / 60
      if (e.oldestHours === null || h > e.oldestHours) e.oldestHours = Math.round(h * 10) / 10
    }
  }
  for (const c of d.resolvedCases) {
    const e = get(c.owner)
    e.resolved++
    if (c.resolve.state === 'met') e.resolvedWithin++
    if (c.fcr !== null) {
      e.fcrKnown++
      if (c.fcr) e.fcr++
    }
    if (c.reopened) e.reopened++
    const k = e.owner.kind === 'user' ? e.owner.id : `${e.owner.kind}:${e.owner.id}`
    resolveTimes.set(k, [...(resolveTimes.get(k) ?? []), c.resolve.elapsed])
  }
  for (const c of d.createdCases) {
    if (!c.firstResponseAt && c.response.state !== 'breached') continue
    const e = get(c.owner)
    e.responded++
    if (c.response.state === 'met') e.respondedWithin++
    if (c.firstResponseAt && !(d.settings.phoneCountsAsResponded && c.origin === 1)) {
      const k = e.owner.kind === 'user' ? e.owner.id : `${e.owner.kind}:${e.owner.id}`
      responseTimes.set(k, [...(responseTimes.get(k) ?? []), c.response.elapsed])
    }
  }
  // Survey responses credit the engineer who held the case when it was rated (the row's owner), including engineers with no case in the period.
  const csatBy = new Map<string, { sum: number; n: number; satisfied: number; unhappy: number; support: number }>()
  for (const r of d.csat) {
    if (r.status !== 'responded' || r.score === null || !r.ownerId) continue
    const cur = csatBy.get(r.ownerId) ?? { sum: 0, n: 0, satisfied: 0, unhappy: 0, support: 0 }
    cur.sum += r.score
    cur.n++
    if (r.score >= d.settings.csat.satisfiedFrom) cur.satisfied++
    if (isUnhappy(r.score, d.settings.csat)) {
      cur.unhappy++
      if (causeOf(r).area === 'support') cur.support++
    }
    csatBy.set(r.ownerId, cur)
    if (!by.has(r.ownerId)) get({ id: r.ownerId, name: r.ownerName || 'Unknown', kind: SHARED_OWNER.test(r.ownerName) ? 'shared' : 'user' })
  }
  for (const [k, e] of by) {
    const cs = csatBy.get(e.owner.id)
    if (cs) {
      e.csatResponses = cs.n
      e.csatAverage = Math.round((cs.sum / cs.n) * 10) / 10
      e.csatPct = pct(cs.satisfied, cs.n)
      e.csatUnhappy = cs.unhappy
      e.csatUnhappySupport = cs.support
    }
    const t = d.touchesByOwner.get(e.owner.id)
    e.emails = t?.emails ?? 0
    e.notes = t?.notes ?? 0
    e.resolvePct = pct(e.resolvedWithin, e.resolved)
    e.responsePct = pct(e.respondedWithin, e.responded)
    e.fcrPct = pct(e.fcr, e.fcrKnown)
    const mr = median(resolveTimes.get(k) ?? [])
    e.medianResolveHours = mr === null ? null : Math.round((mr / 60) * 10) / 10
    const mp = median(responseTimes.get(k) ?? [])
    e.medianResponseMin = mp === null ? null : Math.round(mp)
    e.touchesPerResolved = e.resolved ? Math.round(((e.emails + e.notes) / e.resolved) * 10) / 10 : null
    e.perDay = e.resolved ? Math.round((e.resolved / d.workingDays) * 10) / 10 : null
    const load = Math.max(0, 100 - (e.breached * 25 + e.atRisk * 10))
    e.score =
      e.csatPct !== null
        ? Math.round(0.3 * (e.resolvePct ?? 50) + 0.15 * (e.responsePct ?? 50) + 0.15 * (e.fcrPct ?? 50) + 0.2 * e.csatPct + 0.2 * load)
        : Math.round(0.4 * (e.resolvePct ?? 50) + 0.2 * (e.responsePct ?? 50) + 0.2 * (e.fcrPct ?? 50) + 0.2 * load)
  }
  return [...by.values()].filter((e) => e.owner.kind === 'user' || (o.includeShared && e.owner.kind !== 'none') || e.active > 0 || e.resolved > 0).sort((a, b) => b.active - a.active || b.resolved - a.resolved || a.owner.name.localeCompare(b.owner.name))
}

export const engineerById = (stats: EngineerStats[], id: string): EngineerStats | undefined => stats.find((e) => e.owner.id === id)

/* ---------- Breakdowns, trends, violations ---------- */

export type BreakBy = 'owner' | 'priority' | 'vertical' | 'origin' | 'product' | 'issue' | 'status'

const facet = (c: CaseLite, by: BreakBy): string => {
  switch (by) {
    case 'owner':
      return c.owner.name
    case 'priority':
      return optLabel(PRIORITY, c.priority) || '(none)'
    case 'vertical':
      return optLabel(VERTICAL, c.vertical) || '(none)'
    case 'origin':
      return optLabel(ORIGIN, c.origin) || '(none)'
    case 'product':
      return c.product || '(none)'
    case 'issue':
      return c.issue || '(none)'
    case 'status':
      return c.status || '(none)'
  }
}

/** Counts by a facet, biggest first, twelve plus "Other". Critical rows carry the signal. */
export const breakdown = (cases: CaseLite[], by: BreakBy, limit = 12): ChartSeries[] => {
  const m = new Map<string, number>()
  for (const c of cases) m.set(facet(c, by), (m.get(facet(c, by)) ?? 0) + 1)
  const all: ChartSeries[] = [...m.entries()].map(([label, value]) => ({ label, value, critical: by === 'priority' && label === 'Critical' ? true : undefined })).sort((a, b) => b.value - a.value)
  const top = all.slice(0, limit)
  const rest = all.slice(limit).reduce((s, x) => s + x.value, 0)
  if (rest > 0) top.push({ label: `Other (${all.length - limit})`, value: rest })
  return top
}

export type DayPoint = { day: string; created: number; resolved: number; late: number }

const dayKey = (d: Date, tz: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: '2-digit' }).format(d)

/** Per-day created, resolved and resolved-late counts over the period (up to 90 points). */
export const trend = (d: Desk): DayPoint[] => {
  const tz = d.settings.hours.timeZone
  const days: DayPoint[] = []
  const index = new Map<string, DayPoint>()
  const total = Math.min(90, Math.max(1, Math.ceil((d.to.getTime() - d.from.getTime()) / 864e5)))
  for (let i = total - 1; i >= 0; i--) {
    const day = dayKey(new Date(d.to.getTime() - i * 864e5), tz)
    const p = { day, created: 0, resolved: 0, late: 0 }
    days.push(p)
    index.set(day, p)
  }
  for (const c of d.createdCases) {
    const p = index.get(dayKey(c.createdon, tz))
    if (p) p.created++
  }
  for (const c of d.resolvedCases) {
    const p = c.resolvedAt && index.get(dayKey(c.resolvedAt, tz))
    if (!p) continue
    p.resolved++
    if (c.resolve.state === 'breached') p.late++
  }
  return days
}

export type CsatDayPoint = { day: string; responses: number; unhappy: number }

/** Per-day survey responses and low scores over the period (up to 90 points). */
export const csatTrend = (d: Desk): CsatDayPoint[] => {
  const tz = d.settings.hours.timeZone
  const days: CsatDayPoint[] = []
  const index = new Map<string, CsatDayPoint>()
  const total = Math.min(90, Math.max(1, Math.ceil((d.to.getTime() - d.from.getTime()) / 864e5)))
  for (let i = total - 1; i >= 0; i--) {
    const day = dayKey(new Date(d.to.getTime() - i * 864e5), tz)
    const p = { day, responses: 0, unhappy: 0 }
    days.push(p)
    index.set(day, p)
  }
  for (const r of d.csat) {
    if (r.status !== 'responded' || !r.respondedAt || r.score === null) continue
    const p = index.get(dayKey(new Date(r.respondedAt), tz))
    if (!p) continue
    p.responses++
    if (isUnhappy(r.score, d.settings.csat)) p.unhappy++
  }
  return days
}

export type CsatBreakBy = 'owner' | 'product' | 'issue' | 'vertical' | 'priority' | 'origin'

/** CSAT per facet: responses, mean, satisfied share and low scores. */
export const csatBreakdown = (d: Desk, by: CsatBreakBy) =>
  facetLines(d.csat, d.settings.csat, (r) => {
    switch (by) {
      case 'owner':
        return { key: r.ownerId || 'none', label: r.ownerName || 'Unassigned' }
      case 'product':
        return { key: r.product || '(none)', label: r.product || '(none)' }
      case 'issue':
        return { key: r.issue || '(none)', label: r.issue || '(none)' }
      case 'vertical':
        return { key: String(r.vertical ?? ''), label: optLabel(VERTICAL, r.vertical) || '(none)' }
      case 'priority':
        return { key: String(r.priority ?? ''), label: optLabel(PRIORITY, r.priority) || '(none)' }
      case 'origin':
        return { key: String(r.origin ?? ''), label: optLabel(ORIGIN, r.origin) || '(none)' }
    }
  })

export type ViolationKind = 'resolution' | 'response'
export type Violation = { c: CaseLite; kind: ViolationKind; reading: SlaReading; open: boolean }

/** Every breach in view: resolved late in the period, still open past target, or first response late or overdue. */
export const violations = (d: Desk): Violation[] => {
  const out: Violation[] = []
  for (const c of d.cases) {
    if (c.resolve.state === 'breached') out.push({ c, kind: 'resolution', reading: c.resolve, open: c.statecode === STATE.ACTIVE })
    if (c.response.state === 'breached') out.push({ c, kind: 'response', reading: c.response, open: c.statecode === STATE.ACTIVE && !c.firstResponseAt })
  }
  return out.sort((a, b) => b.reading.ratio - a.reading.ratio)
}

/** Active cases that need attention, most urgent first: breached, then at risk by time left, then unanswered responses. */
/** Every clock running on a case now, with its reading: what the board and the watch look at. */
export const runningClocks = (c: CaseLite): { clock: 'response' | 'follow-up' | 'pickup' | 'lab' | 'resolution'; reading: SlaReading }[] => [
  ...(c.binSince ? [{ clock: 'pickup' as const, reading: c.pickup }] : []),
  ...(!c.firstResponseAt && c.response.state !== 'none' ? [{ clock: 'response' as const, reading: c.response }] : []),
  ...(c.followUpSince ? [{ clock: 'follow-up' as const, reading: c.followUp }] : []),
  ...(c.labSince ? [{ clock: 'lab' as const, reading: c.lab }] : []),
  { clock: 'resolution' as const, reading: c.resolve },
]

/** The case's worst clock: past target before at risk, then the least time left. */
export const worstClock = (c: CaseLite): { rank: number; left: number } => {
  let best = { rank: 3, left: Number.POSITIVE_INFINITY }
  for (const { reading } of runningClocks(c)) {
    const rank = reading.state === 'breached' ? 0 : reading.state === 'at-risk' ? 1 : 3
    if (rank < best.rank || (rank === best.rank && reading.left < best.left)) best = { rank, left: reading.left }
  }
  return best
}

/** Cases with any clock at risk or past target, the most urgent first. */
export const atRiskBoard = (d: Desk): CaseLite[] =>
  d.activeCases
    .map((c) => ({ c, w: worstClock(c) }))
    .filter((x) => x.w.rank < 3)
    .sort((a, b) => a.w.rank - b.w.rank || a.w.left - b.w.left)
    .map((x) => x.c)

export const csvEscape = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
