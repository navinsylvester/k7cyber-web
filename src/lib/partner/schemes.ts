import 'server-only'
import configPromise from '@payload-config'
import { createReadStream, existsSync, statSync } from 'fs'
import path from 'path'
import { getPayload, type Where } from 'payload'
import { Readable } from 'stream'

import { audit, SYSTEM, type Actor } from './audit'
import { toDeal, type Deal } from './deals-model'
import { notify } from './notify'
import { loadOrg } from './organisation'
import { orgRel, orgWhere, type OrgScope } from './scope'
import {
  canCompute,
  canDispute,
  canPublish,
  canDecideRegistration,
  countDeals,
  finalValue,
  initialRegistrationStatus,
  isClosed,
  progressFor,
  registerBlocked,
  resultStatus,
  schemeGroup,
  schemePhase,
  standing,
  sumValue,
  toRegistration,
  toResult,
  toScheme,
  visibleScheme,
  type EligibilityResult,
  type FinanceRow,
  type PayoutStatus,
  type Progress,
  type Registration,
  type Scheme,
  type SchemeFile,
  type SchemeRow,
  type SchemeStatus,
} from './schemes-model'
import type { K7Context, PartnerContext } from './session'
import { getPartnerSettings } from './settings'
import { orgUsers, type PartnerOrg } from './users'

/* Schemes and eligibility (01-requirements.md §9, M7): the Scheme Admin writes the catalogue in the Payload admin; this file
   reads it for the two audiences and writes the rows the portal owns: registrations (FR-SCH-03, 04), the progress a running
   scheme shows from the deals' CRM snapshots (FR-SCH-05), the eligibility run after the close (FR-ELG-01), the review with
   adjustments and the publication (FR-ELG-02), disputes (FR-ELG-05), payouts (FR-ELG-06) and the Finance export (FR-ELG-07).
   The partner side reads through `me`: a scheme is theirs to see when it is published and applies to their organisation, their
   registration and result through the scope, the result only once the scheme's results are published. Every move writes an
   audit row on the organisation and tells the people concerned. Nothing here touches Dynamics: the deals' snapshots are what
   the dashboard's sync wrote (decision 16). */

export const PARTNER_SCHEMES = '/partners/portal/schemes'
export const K7_SCHEMES = '/partners/portal/k7/schemes'
export const SCHEME_FILE_DIR = path.resolve(process.cwd(), 'uploads/partner-schemes')

const db = () => getPayload({ config: configPromise })
type Doc = Record<string, unknown>
const rel = (id: string): number | string => (/^\d+$/.test(id) ? Number(id) : id)
const now = () => new Date().toISOString()
const who = (a: Actor): string => a.name || a.email || a.kind

export const readerOf = (org: PartnerOrg) => ({ type: org.type, regions: org.regions })

/* ---------- Reading schemes ---------- */

/** Every scheme in the given state (K7), the newest window first. */
export const listSchemes = async (status: SchemeStatus | 'all' = 'all'): Promise<Scheme[]> => {
  const payload = await db()
  const where: Where = status === 'all' ? {} : { status: { equals: status } }
  const r = await payload.find({ collection: 'partner-schemes', where, limit: 500, depth: 1, sort: '-startDate', overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toScheme)
}

export const loadScheme = async (id: string): Promise<Scheme | null> => {
  if (!/^\d+$/.test(id)) return null
  try {
    const payload = await db()
    const doc = (await payload.findByID({ collection: 'partner-schemes', id: Number(id), depth: 1, overrideAccess: true })) as unknown as Doc
    return toScheme(doc)
  } catch {
    return null
  }
}

const registrationsOf = async (where: Where): Promise<Registration[]> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-scheme-registrations', where, limit: 2000, depth: 0, sort: 'createdAt', overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toRegistration)
}

const resultsOf = async (where: Where): Promise<EligibilityResult[]> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-eligibility', where, limit: 2000, depth: 0, sort: '-final', overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toResult)
}

/** The organisation's registration for a scheme, through the scope. */
export const registrationFor = async (scope: OrgScope, schemeId: string): Promise<Registration | null> => (await registrationsOf(orgWhere(scope, { scheme: { equals: schemeId } })))[0] ?? null

/** The organisation's result for a scheme, through the scope; null until the scheme's results are published (FR-ELG-02). */
export const resultFor = async (scope: OrgScope, sc: Scheme): Promise<EligibilityResult | null> => {
  if (!sc.results.publishedAt) return null
  return (await resultsOf(orgWhere(scope, { scheme: { equals: sc.id } })))[0] ?? null
}

/** The partner's listing (FR-SCH-02): the published schemes that apply to the organisation, each with its registration and,
    once published, its result. */
export const schemesFor = async (me: PartnerContext): Promise<SchemeRow[]> => {
  const reader = readerOf(me.org)
  const visible = (await listSchemes('published')).filter((sc) => visibleScheme(sc, reader))
  if (!visible.length) return []
  const ids = visible.map((sc) => sc.id)
  const [regs, results] = await Promise.all([registrationsOf(orgWhere(me.scope, { scheme: { in: ids.map(rel) } })), resultsOf(orgWhere(me.scope, { scheme: { in: ids.map(rel) } }))])
  const at = new Date()
  return visible.map((scheme) => ({
    scheme,
    phase: schemePhase(scheme, at),
    group: schemeGroup(scheme, at),
    registration: regs.find((r) => r.schemeId === scheme.id) ?? null,
    result: scheme.results.publishedAt ? (results.find((r) => r.schemeId === scheme.id) ?? null) : null,
  }))
}

export type SchemeView = { scheme: Scheme; registration: Registration | null; result: EligibilityResult | null }

/** One scheme for the partner: null unless their organisation may see it (the same rule as the list). */
export const loadSchemeFor = async (me: PartnerContext, id: string): Promise<SchemeView | null> => {
  const scheme = await loadScheme(id)
  if (!scheme || !visibleScheme(scheme, readerOf(me.org))) return null
  const [registration, result] = await Promise.all([registrationFor(me.scope, scheme.id), resultFor(me.scope, scheme)])
  return { scheme, registration, result }
}

export type SchemeCountFor = { open: number; registered: number; results: number }

/** For the partner's home: schemes to register for, schemes the organisation is in, results waiting to be read. */
export const schemeCountFor = async (me: PartnerContext): Promise<SchemeCountFor> => {
  const rows = await schemesFor(me)
  return {
    open: rows.filter((r) => r.group === 'open' && (!r.registration || r.registration.status === 'declined')).length,
    registered: rows.filter((r) => r.registration?.status === 'approved' && r.group !== 'closed').length,
    results: rows.filter((r) => r.result !== null).length,
  }
}

/* ---------- Registration (FR-SCH-03, 04) ---------- */

export type SchemeMove<T> = { ok: true; value: T } | { ok: false; error: string }

export const registerForScheme = async (me: PartnerContext, sc: Scheme, accepted: boolean): Promise<SchemeMove<Registration>> => {
  const existing = await registrationFor(me.scope, sc.id)
  const blocked = registerBlocked(sc, me.org, me.user, existing, accepted)
  if (blocked) return { ok: false, error: blocked }
  const status = initialRegistrationStatus(sc)
  const payload = await db()
  const doc = (await payload.create({
    collection: 'partner-scheme-registrations',
    overrideAccess: true,
    depth: 0,
    data: { scheme: Number(sc.id), org: orgRel(me.scope) as number, orgPartnerId: me.org.partnerId, orgName: me.org.tradeName || me.org.name, orgType: me.org.type, status, acceptedBy: { userId: me.user.id, name: me.user.name, email: me.user.email }, acceptedAt: now() },
  })) as unknown as Doc
  const reg = toRegistration(doc)
  await audit({ actor: me.actor, object: 'partner-scheme-registrations', objectId: reg.id, objectLabel: sc.name, action: 'scheme.register', to: status, orgId: me.scope.orgId, comment: `Terms accepted by ${me.user.name || me.user.email}` })
  if (status === 'pending') {
    await notify({ event: 'scheme.registration.pending', subject: `${me.org.tradeName || me.org.name} asks to join ${sc.name}`, body: `${me.user.name || me.user.email} accepted the scheme terms. The scheme needs K7's approval of each registration.`, href: `${K7_SCHEMES}/${sc.id}`, to: { kind: 'staff', role: 'schemeAdmin' } })
    await notify({ event: 'scheme.registration.sent', subject: `Registration for ${sc.name} sent to K7`, body: `K7 approves each registration for this scheme; you are told when it is decided.`, href: `${PARTNER_SCHEMES}/${sc.id}`, to: { kind: 'org', orgId: me.scope.orgId, roles: ['admin'] } })
  } else {
    await notify({ event: 'scheme.registered', subject: `Registered for ${sc.name}`, body: `Your organisation is in. The scheme runs ${sc.startDate} to ${sc.endDate}; your progress shows on the scheme page as deals are won.`, href: `${PARTNER_SCHEMES}/${sc.id}`, to: { kind: 'org', orgId: me.scope.orgId, roles: ['admin'] } })
  }
  return { ok: true, value: reg }
}

/** Every registration for a scheme (K7), pending first. */
export const listRegistrations = async (schemeId: string): Promise<Registration[]> => {
  const rows = await registrationsOf({ scheme: { equals: schemeId } })
  const rank = (r: Registration) => (r.status === 'pending' ? 0 : r.status === 'approved' ? 1 : 2)
  return rows.sort((a, b) => rank(a) - rank(b) || a.orgName.localeCompare(b.orgName))
}

export const loadRegistration = async (id: string): Promise<Registration | null> => {
  if (!/^\d+$/.test(id)) return null
  try {
    const payload = await db()
    return toRegistration((await payload.findByID({ collection: 'partner-scheme-registrations', id: Number(id), depth: 0, overrideAccess: true })) as unknown as Doc)
  } catch {
    return null
  }
}

/** The Scheme Admin's decision on a pending registration (FR-SCH-04); a decline needs a note. */
export const decideRegistration = async (sc: Scheme, reg: Registration, approve: boolean, note: string, me: K7Context): Promise<SchemeMove<Registration>> => {
  if (!canDecideRegistration(reg)) return { ok: false, error: 'This registration is already decided.' }
  if (!approve && !note.trim()) return { ok: false, error: 'A decline needs a note to the partner.' }
  const payload = await db()
  const status = approve ? 'approved' : 'declined'
  const doc = (await payload.update({ collection: 'partner-scheme-registrations', id: Number(reg.id), overrideAccess: true, depth: 0, data: { status, decision: { by: who(me.actor), at: now(), note: note.trim() } } })) as unknown as Doc
  const next = toRegistration(doc)
  await audit({ actor: me.actor, object: 'partner-scheme-registrations', objectId: reg.id, objectLabel: sc.name, action: 'scheme.registration.decide', from: reg.status, to: status, orgId: reg.orgId, comment: note.trim() })
  await notify({
    event: `scheme.registration.${status}`,
    subject: approve ? `Registered for ${sc.name}` : `Registration for ${sc.name} declined`,
    body: approve ? `K7 approved your registration.${note.trim() ? ` ${note.trim()}` : ''} The scheme runs ${sc.startDate} to ${sc.endDate}.` : `K7 declined it: ${note.trim()}`,
    href: `${PARTNER_SCHEMES}/${sc.id}`,
    to: { kind: 'org', orgId: reg.orgId, roles: ['admin'] },
  })
  return { ok: true, value: next }
}

/* ---------- Progress (FR-SCH-05) and the run (FR-ELG-01) ---------- */

/** The organisation's deals the CRM says are won, through the scope; the model decides which fall inside the scheme. */
export const wonDealsFor = async (scope: OrgScope): Promise<Deal[]> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-deals', where: orgWhere(scope, { 'crm.snapshot.statecode': { equals: 1 } }), limit: 2000, depth: 1, sort: '-crm.snapshot.actualCloseDate', overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toDeal)
}

/** Where a registered organisation stands today; provisional until the scheme closes. */
export const progressOf = async (scope: OrgScope, sc: Scheme): Promise<Progress> => progressFor(sc, await wonDealsFor(scope))

export type RunResult = { ok: true; computed: number; eligible: number; skipped: number } | { ok: false; error: string }

const upsertResult = async (sc: Scheme, reg: Registration, deals: Deal[], existing: EligibilityResult | null, actor: Actor): Promise<EligibilityResult> => {
  const payload = await db()
  const counted = countDeals(sc, deals)
  const achieved = sumValue(counted)
  const adjustment = existing?.adjustment ?? { amount: 0, reason: '', by: '', at: null }
  const st = standing(sc.slabs, finalValue(achieved, adjustment.amount))
  const data = { achieved, dealsCounted: counted, final: st.final, eligible: st.eligible, slabIndex: st.slabIndex, target: st.target, gap: st.gap, computedAt: now() }
  const doc = existing
    ? ((await payload.update({ collection: 'partner-eligibility', id: Number(existing.id), overrideAccess: true, depth: 0, data })) as unknown as Doc)
    : ((await payload.create({ collection: 'partner-eligibility', overrideAccess: true, depth: 0, data: { ...data, scheme: Number(sc.id), org: Number(reg.orgId), orgPartnerId: reg.orgPartnerId, orgName: reg.orgName, orgType: reg.orgType || undefined, adjustment, dispute: { status: 'none' }, payout: { status: 'pending' } } })) as unknown as Doc)
  const r = toResult(doc)
  const from = existing ? `${existing.final} · ${existing.eligible ? 'eligible' : 'not eligible'}` : ''
  const to = `${r.final} · ${r.eligible ? `eligible, slab ${r.slabIndex + 1}` : 'not eligible'}`
  if (from !== to) await audit({ actor, object: 'partner-eligibility', objectId: r.id, objectLabel: sc.name, action: existing ? 'scheme.result.recomputed' : 'scheme.result.computed', from, to, orgId: reg.orgId, comment: `${counted.length} deal${counted.length === 1 ? '' : 's'} counted` })
  return r
}

/** The eligibility run (FR-ELG-01): for every approved registration, the organisation's won deals inside the window, the
    sum, the slab; one row per organisation, recomputed in place while unpublished (adjustments, disputes and payouts kept). */
export const runEligibility = async (sc: Scheme, actor: Actor = SYSTEM): Promise<RunResult> => {
  const blocked = canCompute(sc)
  if (blocked) return { ok: false, error: blocked }
  const [regs, existing] = await Promise.all([listRegistrations(sc.id), resultsOf({ scheme: { equals: sc.id } })])
  let computed = 0
  let eligible = 0
  let skipped = 0
  for (const reg of regs) {
    if (reg.status !== 'approved') {
      skipped += 1
      continue
    }
    const deals = await wonDealsFor({ orgId: reg.orgId })
    const r = await upsertResult(sc, reg, deals, existing.find((e) => e.orgId === reg.orgId) ?? null, actor)
    computed += 1
    if (r.eligible) eligible += 1
  }
  const payload = await db()
  await payload.update({ collection: 'partner-schemes', id: Number(sc.id), overrideAccess: true, depth: 0, data: { results: { ...sc.results, computedAt: now(), computedBy: who(actor) } } })
  await audit({ actor, object: 'partner-schemes', objectId: sc.id, objectLabel: sc.name, action: 'scheme.results.computed', comment: `${computed} organisation${computed === 1 ? '' : 's'}, ${eligible} eligible` })
  return { ok: true, computed, eligible, skipped }
}

/** The scheduled pass: every published scheme that has closed and has no results yet is computed once (FR-ELG-01 "after a
    scheme closes"); the Scheme Admin reviews and publishes by hand. */
export const runDueSchemes = async (actor: Actor = SYSTEM, at = new Date()): Promise<{ schemes: string[]; errors: string[] }> => {
  const out = { schemes: [] as string[], errors: [] as string[] }
  for (const sc of await listSchemes('published')) {
    if (!isClosed(sc, at) || sc.results.computedAt || !sc.slabs.length) continue
    const r = await runEligibility(sc, actor)
    if (r.ok) out.schemes.push(sc.name)
    else out.errors.push(`${sc.name}: ${r.error}`)
  }
  return out
}

/* ---------- Review, publish, dispute, payout (FR-ELG-02, 05, 06) ---------- */

/** Every result for a scheme (K7), the highest final value first. */
export const listResults = (schemeId: string): Promise<EligibilityResult[]> => resultsOf({ scheme: { equals: schemeId } })

export const loadResultK7 = async (schemeId: string, partnerId: string): Promise<EligibilityResult | null> => (await resultsOf({ and: [{ scheme: { equals: schemeId } }, { orgPartnerId: { equals: partnerId } }] }))[0] ?? null

/** The partner's own result by scheme (through the scope, published only). */
export const loadResultFor = async (me: PartnerContext, sc: Scheme): Promise<EligibilityResult | null> => resultFor(me.scope, sc)

export const adjustResult = async (sc: Scheme, r: EligibilityResult, amount: number, reason: string, me: K7Context): Promise<SchemeMove<EligibilityResult>> => {
  if (!Number.isFinite(amount)) return { ok: false, error: 'The adjustment must be a number of rupees (negative to reduce).' }
  if (!reason.trim()) return { ok: false, error: 'An adjustment needs its reason (FR-ELG-02).' }
  const st = standing(sc.slabs, finalValue(r.achieved, amount))
  const payload = await db()
  const doc = (await payload.update({ collection: 'partner-eligibility', id: Number(r.id), overrideAccess: true, depth: 0, data: { adjustment: { amount, reason: reason.trim(), by: who(me.actor), at: now() }, final: st.final, eligible: st.eligible, slabIndex: st.slabIndex, target: st.target, gap: st.gap } })) as unknown as Doc
  const next = toResult(doc)
  await audit({ actor: me.actor, object: 'partner-eligibility', objectId: r.id, objectLabel: sc.name, action: 'scheme.result.adjusted', from: `${r.final} · ${r.eligible ? 'eligible' : 'not eligible'}`, to: `${next.final} · ${next.eligible ? `eligible, slab ${next.slabIndex + 1}` : 'not eligible'}`, orgId: r.orgId, comment: `${amount >= 0 ? '+' : ''}${amount}: ${reason.trim()}` })
  if (sc.results.publishedAt) await notify({ event: 'scheme.result.adjusted', subject: `Your result on ${sc.name} was adjusted`, body: `K7 adjusted it by ₹${amount.toLocaleString('en-IN')}: ${reason.trim()}. The scheme page shows the result as it now stands.`, href: `${PARTNER_SCHEMES}/${sc.id}/eligibility`, to: { kind: 'org', orgId: r.orgId, roles: ['admin'] } })
  return { ok: true, value: next }
}

export const publishResults = async (sc: Scheme, me: K7Context): Promise<SchemeMove<Scheme>> => {
  const blocked = canPublish(sc)
  if (blocked) return { ok: false, error: blocked }
  const payload = await db()
  const at = now()
  await payload.update({ collection: 'partner-schemes', id: Number(sc.id), overrideAccess: true, depth: 0, data: { results: { ...sc.results, publishedAt: at, publishedBy: who(me.actor) } } })
  const next = { ...sc, results: { ...sc.results, publishedAt: at, publishedBy: who(me.actor) } }
  await audit({ actor: me.actor, object: 'partner-schemes', objectId: sc.id, objectLabel: sc.name, action: 'scheme.results.published' })
  const settings = await getPartnerSettings()
  const days = sc.disputeDays ?? settings.schemes.disputeDays
  for (const r of await listResults(sc.id)) {
    await notify({
      event: 'scheme.results.published',
      subject: `Results for ${sc.name}: ${r.eligible ? 'eligible' : 'not eligible'}`,
      body: r.eligible ? `Your organisation reached slab ${r.slabIndex + 1} with ₹${r.final.toLocaleString('en-IN')} won in the window. The scheme page shows the benefit and the deals counted.${days ? ` You have ${days} days to raise a query.` : ''}` : `Your organisation won ₹${r.final.toLocaleString('en-IN')} in the window against a target of ₹${r.target.toLocaleString('en-IN')}. The scheme page shows the gap and the deals counted.${days ? ` You have ${days} days to raise a query.` : ''}`,
      href: `${PARTNER_SCHEMES}/${sc.id}/eligibility`,
      to: { kind: 'org', orgId: r.orgId, roles: ['admin'] },
    })
  }
  return { ok: true, value: next }
}

export const raiseDispute = async (me: PartnerContext, sc: Scheme, r: EligibilityResult, text: string): Promise<SchemeMove<EligibilityResult>> => {
  if (r.orgId !== me.scope.orgId) return { ok: false, error: 'Not your result.' }
  if (!me.roles.includes('admin')) return { ok: false, error: 'Only a Partner Admin raises a dispute.' }
  const settings = await getPartnerSettings()
  const blocked = canDispute(sc, r, settings.schemes.disputeDays)
  if (blocked) return { ok: false, error: blocked }
  if (text.trim().length < 10) return { ok: false, error: 'Say what you dispute and why (a sentence at least).' }
  const payload = await db()
  const doc = (await payload.update({ collection: 'partner-eligibility', id: Number(r.id), overrideAccess: true, depth: 0, data: { dispute: { status: 'open', text: text.trim(), raisedBy: me.user.name || me.user.email, raisedAt: now(), resolution: '', resolvedBy: '', resolvedAt: null } } })) as unknown as Doc
  const next = toResult(doc)
  await audit({ actor: me.actor, object: 'partner-eligibility', objectId: r.id, objectLabel: sc.name, action: 'scheme.dispute.raised', to: 'open', orgId: me.scope.orgId, comment: text.trim().slice(0, 400) })
  await notify({ event: 'scheme.dispute.raised', subject: `${me.org.tradeName || me.org.name} disputes its result on ${sc.name}`, body: text.trim().slice(0, 400), href: `${K7_SCHEMES}/${sc.id}/results/${me.org.partnerId}`, to: { kind: 'staff', role: 'schemeAdmin' } })
  return { ok: true, value: next }
}

export const resolveDispute = async (sc: Scheme, r: EligibilityResult, resolution: string, me: K7Context): Promise<SchemeMove<EligibilityResult>> => {
  if (r.dispute.status !== 'open') return { ok: false, error: 'No dispute is open on this result.' }
  if (!resolution.trim()) return { ok: false, error: 'Say how it was resolved; the partner reads it.' }
  const payload = await db()
  const doc = (await payload.update({ collection: 'partner-eligibility', id: Number(r.id), overrideAccess: true, depth: 0, data: { dispute: { ...r.dispute, status: 'resolved', resolution: resolution.trim(), resolvedBy: who(me.actor), resolvedAt: now() } } })) as unknown as Doc
  const next = toResult(doc)
  await audit({ actor: me.actor, object: 'partner-eligibility', objectId: r.id, objectLabel: sc.name, action: 'scheme.dispute.resolved', from: 'open', to: 'resolved', orgId: r.orgId, comment: resolution.trim().slice(0, 400) })
  await notify({ event: 'scheme.dispute.resolved', subject: `Your query on ${sc.name} was answered`, body: resolution.trim(), href: `${PARTNER_SCHEMES}/${sc.id}/eligibility`, to: { kind: 'org', orgId: r.orgId, roles: ['admin'] } })
  return { ok: true, value: next }
}

export const setPayout = async (sc: Scheme, r: EligibilityResult, status: PayoutStatus, reference: string, note: string, me: K7Context): Promise<SchemeMove<EligibilityResult>> => {
  if (!r.eligible) return { ok: false, error: 'Only an eligible result has a payout.' }
  if (!sc.results.publishedAt) return { ok: false, error: 'Publish the results before recording payouts.' }
  if (status !== 'pending' && !reference.trim()) return { ok: false, error: 'A processed or paid payout needs its reference number (FR-ELG-06).' }
  const payload = await db()
  const doc = (await payload.update({ collection: 'partner-eligibility', id: Number(r.id), overrideAccess: true, depth: 0, data: { payout: { status, reference: reference.trim(), note: note.trim(), by: who(me.actor), at: now() } } })) as unknown as Doc
  const next = toResult(doc)
  await audit({ actor: me.actor, object: 'partner-eligibility', objectId: r.id, objectLabel: sc.name, action: 'scheme.payout', from: r.payout.status, to: status, orgId: r.orgId, comment: [reference.trim(), note.trim()].filter(Boolean).join(' · ') })
  if (status !== r.payout.status) await notify({ event: 'scheme.payout', subject: `Payout for ${sc.name}: ${status}`, body: `${status === 'paid' ? 'Paid' : status === 'processed' ? 'Processed' : 'Pending'}${reference.trim() ? ` · reference ${reference.trim()}` : ''}${note.trim() ? ` · ${note.trim()}` : ''}`, href: `${PARTNER_SCHEMES}/${sc.id}/eligibility`, to: { kind: 'org', orgId: r.orgId, roles: ['admin'] } })
  return { ok: true, value: next }
}

/* ---------- The Finance export (FR-ELG-07) ---------- */

export const financeRows = async (sc: Scheme): Promise<FinanceRow[]> => {
  const results = await listResults(sc.id)
  const rows: FinanceRow[] = []
  for (const result of results) {
    const org = await loadOrg(result.orgId)
    const admins = org ? await orgUsers(org.id, ['admin']) : []
    rows.push({
      scheme: sc,
      result,
      org: { partnerId: org?.partnerId ?? result.orgPartnerId, name: org?.name ?? result.orgName, type: org?.type ?? result.orgType, gstin: org?.gstin ?? '', pan: org?.pan ?? '', country: org?.country ?? '', state: org?.state ?? '', city: org?.city ?? '', email: admins.find((u) => u.status === 'active')?.email ?? admins[0]?.email ?? '' },
    })
  }
  return rows
}

/* ---------- Counters for the desks ---------- */

export type SchemeCounts = { published: number; open: number; running: number; due: number; pending: number; disputes: number; payouts: number }

export const schemeCounts = async (): Promise<SchemeCounts> => {
  const payload = await db()
  const at = new Date()
  const published = await listSchemes('published')
  const [pending, disputes, payouts] = await Promise.all([
    payload.count({ collection: 'partner-scheme-registrations', where: { status: { equals: 'pending' } }, overrideAccess: true }),
    payload.count({ collection: 'partner-eligibility', where: { 'dispute.status': { equals: 'open' } }, overrideAccess: true }),
    payload.count({ collection: 'partner-eligibility', where: { and: [{ eligible: { equals: true } }, { 'payout.status': { not_equals: 'paid' } }, { scheme: { in: published.filter((sc) => sc.results.publishedAt).map((sc) => rel(sc.id)) } }] }, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
  ])
  return {
    published: published.length,
    open: published.filter((sc) => schemeGroup(sc, at) === 'open').length,
    running: published.filter((sc) => schemeGroup(sc, at) === 'running').length,
    due: published.filter((sc) => isClosed(sc, at) && !sc.results.publishedAt).length,
    pending: pending.totalDocs,
    disputes: disputes.totalDocs,
    payouts: payouts.totalDocs,
  }
}

/** Per scheme, for the K7 ledger: registrations by state and the results' state. */
export type SchemeTally = { pending: number; approved: number; declined: number; results: number; eligible: number; disputes: number; paid: number }
export const schemeTallies = async (schemeIds: string[]): Promise<Map<string, SchemeTally>> => {
  const out = new Map<string, SchemeTally>()
  if (!schemeIds.length) return out
  const [regs, results] = await Promise.all([registrationsOf({ scheme: { in: schemeIds.map(rel) } }), resultsOf({ scheme: { in: schemeIds.map(rel) } })])
  for (const id of schemeIds) out.set(id, { pending: 0, approved: 0, declined: 0, results: 0, eligible: 0, disputes: 0, paid: 0 })
  for (const r of regs) {
    const t = out.get(r.schemeId)
    if (t) t[r.status] += 1
  }
  for (const r of results) {
    const t = out.get(r.schemeId)
    if (!t) continue
    t.results += 1
    if (r.eligible) t.eligible += 1
    if (r.dispute.status === 'open') t.disputes += 1
    if (r.eligible && r.payout.status === 'paid') t.paid += 1
  }
  return out
}

/* ---------- The scheme document ---------- */

/** The bytes of a scheme's PDF after the caller's check: inline, from the directory outside public/. */
export const serveSchemeFile = (file: SchemeFile): Response => {
  const full = path.join(SCHEME_FILE_DIR, file.name)
  if (!full.startsWith(SCHEME_FILE_DIR + path.sep) || !existsSync(full)) return new Response('No file', { status: 404 })
  return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, {
    headers: { 'Content-Type': file.mime || 'application/pdf', 'Content-Length': String(statSync(full).size), 'Content-Disposition': `inline; filename="${file.name.replace(/"/g, '')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

export { resultStatus, schemePhase }
