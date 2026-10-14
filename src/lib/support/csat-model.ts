import { workingMinutesBetween, type BusinessHours } from './sla'

/* Customer satisfaction (09-portal-guide.md §4d): the pure model. A survey is one question, "How did we do?", answered 1–5 on a
   resolved case; a low score opens a follow-up a manager must close; a customer's recent scores and any manager flag decide the
   care band agents see beside the customer. Storage, mail and Dataverse live in csat.ts; everything here runs without a tenant. */

export type CsatScore = 1 | 2 | 3 | 4 | 5
export const SCORES: CsatScore[] = [1, 2, 3, 4, 5]
export const SCORE_WORD: Record<CsatScore, string> = { 1: 'Very unhappy', 2: 'Unhappy', 3: 'Neutral', 4: 'Happy', 5: 'Very happy' }
export const asScore = (v: unknown): CsatScore | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5 ? n : null
}

export type InviteMode = 'off' | 'portal' | 'all'

export type CsatSettings = {
  enabled: boolean
  /** Scores at or above this count as satisfied; CSAT is their share of all responses. */
  satisfiedFrom: number
  /** Scores at or below this open a follow-up and mark the customer for extra care. */
  unhappyAtOrBelow: number
  /** Which resolved cases are emailed a survey by the sweep: none, those raised through the portal, or every case with an email. */
  inviteMode: InviteMode
  /** Email the survey when an agent resolves a case from the workspace. */
  inviteOnResolve: boolean
  /** Hours after the invitation before one reminder; null for none. */
  reminderAfterHours: number | null
  /** Days a survey link stays valid. */
  surveyDays: number
  /** Working minutes a manager has to contact an unhappy customer. */
  followUpMinutes: number
  notifyManagersOnLow: boolean
  /** Days of history that decide a customer's care band. */
  careWindowDays: number
  /** How many of the latest scores make the band. */
  careRecent: number
}

export const DEFAULT_CSAT: CsatSettings = {
  enabled: true,
  satisfiedFrom: 4,
  unhappyAtOrBelow: 2,
  inviteMode: 'portal',
  inviteOnResolve: true,
  reminderAfterHours: 72,
  surveyDays: 14,
  followUpMinutes: 240,
  notifyManagersOnLow: true,
  careWindowDays: 180,
  careRecent: 3,
}

export const INVITE_MODE_LABEL: Record<InviteMode, string> = { off: 'Never (portal ratings only)', portal: 'Cases raised through the portal', all: 'Every resolved case with an email address' }

type Raw = Record<string, unknown>
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const normaliseCsat = (g: Raw | null | undefined): CsatSettings => {
  if (!g) return DEFAULT_CSAT
  const satisfiedFrom = clamp(Math.round(num(g.satisfiedFrom, DEFAULT_CSAT.satisfiedFrom)), 2, 5)
  const unhappy = clamp(Math.round(num(g.unhappyAtOrBelow, DEFAULT_CSAT.unhappyAtOrBelow)), 1, satisfiedFrom - 1)
  const reminder = numOrNull(g.reminderAfterHours)
  return {
    enabled: bool(g.enabled, true),
    satisfiedFrom,
    unhappyAtOrBelow: unhappy,
    inviteMode: g.inviteMode === 'off' || g.inviteMode === 'all' ? g.inviteMode : 'portal',
    inviteOnResolve: bool(g.inviteOnResolve, true),
    reminderAfterHours: reminder === null || reminder <= 0 ? null : Math.round(reminder),
    surveyDays: clamp(Math.round(num(g.surveyDays, DEFAULT_CSAT.surveyDays)), 1, 90),
    followUpMinutes: Math.max(15, Math.round(num(g.followUpMinutes, DEFAULT_CSAT.followUpMinutes))),
    notifyManagersOnLow: bool(g.notifyManagersOnLow, true),
    careWindowDays: clamp(Math.round(num(g.careWindowDays, DEFAULT_CSAT.careWindowDays)), 7, 730),
    careRecent: clamp(Math.round(num(g.careRecent, DEFAULT_CSAT.careRecent)), 1, 10),
  }
}

/* ---------- Rows ---------- */

export type CsatStatus = 'invited' | 'responded'
export type CsatSource = 'portal' | 'email' | 'agent' | ''
export type FollowUpStatus = 'none' | 'pending' | 'in-progress' | 'done'
export const FOLLOW_UP_LABEL: Record<FollowUpStatus, string> = { none: '—', pending: 'To contact', 'in-progress': 'In hand', done: 'Closed' }

export type CsatRow = {
  id: string
  caseId: string
  ticket: string
  title: string
  customerId: string
  customerName: string
  customerKind: 'account' | 'contact' | ''
  contactId: string
  email: string
  ownerId: string
  ownerName: string
  product: string
  issue: string
  vertical: number | null
  priority: number | null
  origin: number | null
  status: CsatStatus
  source: CsatSource
  score: CsatScore | null
  comment: string
  resolvedAt: string | null
  invitedAt: string | null
  remindedAt: string | null
  respondedAt: string | null
  followUp: FollowUpStatus
  followUpOwnerId: string
  followUpOwnerName: string
  followUpAt: string | null
  followUpNote: string
  createdAt: string
}

export const isSatisfied = (score: CsatScore, s: CsatSettings): boolean => score >= s.satisfiedFrom
export const isUnhappy = (score: CsatScore, s: CsatSettings): boolean => score <= s.unhappyAtOrBelow

export type Distribution = Record<CsatScore, number>
export const emptyDistribution = (): Distribution => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })

const round1 = (n: number) => Math.round(n * 10) / 10
export const share = (part: number, whole: number): number | null => (whole > 0 ? round1((part / whole) * 100) : null)

export type FollowUpReading = { state: 'none' | 'open' | 'overdue' | 'within' | 'late'; minutes: number; left: number }

/** How a follow-up stands against the target: open or overdue while pending, within or late once closed. */
export const readFollowUp = (r: Pick<CsatRow, 'followUp' | 'respondedAt' | 'followUpAt'>, s: CsatSettings, hours: BusinessHours, now: Date): FollowUpReading => {
  if (r.followUp === 'none' || !r.respondedAt) return { state: 'none', minutes: 0, left: s.followUpMinutes }
  const end = r.followUp === 'done' && r.followUpAt ? new Date(r.followUpAt) : now
  const minutes = workingMinutesBetween(r.respondedAt, end, hours)
  const left = s.followUpMinutes - minutes
  if (r.followUp === 'done') return { state: minutes <= s.followUpMinutes ? 'within' : 'late', minutes, left }
  return { state: minutes > s.followUpMinutes ? 'overdue' : 'open', minutes, left }
}

export type CsatSummary = {
  responses: number
  invited: number
  responseRate: number | null
  satisfied: number
  csat: number | null
  average: number | null
  unhappy: number
  neutral: number
  distribution: Distribution
  followUpsOpen: number
  followUpsOverdue: number
  followUpsClosed: number
  followUpsWithin: number
  followUpPct: number | null
}

/** The numbers behind the cards: CSAT (share satisfied), the mean, the response rate and how follow-ups are going. */
export const summarise = (rows: CsatRow[], s: CsatSettings, hours: BusinessHours, now: Date = new Date()): CsatSummary => {
  const answered = rows.filter((r) => r.status === 'responded' && r.score !== null)
  const distribution = emptyDistribution()
  let sum = 0
  let satisfied = 0
  let unhappy = 0
  let neutral = 0
  for (const r of answered) {
    const sc = r.score!
    distribution[sc]++
    sum += sc
    if (isSatisfied(sc, s)) satisfied++
    else if (isUnhappy(sc, s)) unhappy++
    else neutral++
  }
  let followUpsOpen = 0
  let followUpsOverdue = 0
  let followUpsClosed = 0
  let followUpsWithin = 0
  for (const r of answered) {
    if (r.followUp === 'none') continue
    const f = readFollowUp(r, s, hours, now)
    if (f.state === 'open' || f.state === 'overdue') {
      followUpsOpen++
      if (f.state === 'overdue') followUpsOverdue++
    } else {
      followUpsClosed++
      if (f.state === 'within') followUpsWithin++
    }
  }
  const invited = rows.filter((r) => r.invitedAt).length
  const answeredInvites = rows.filter((r) => r.invitedAt && r.status === 'responded').length
  return {
    responses: answered.length,
    invited,
    responseRate: share(answeredInvites, invited),
    satisfied,
    csat: share(satisfied, answered.length),
    average: answered.length ? round1(sum / answered.length) : null,
    unhappy,
    neutral,
    distribution,
    followUpsOpen,
    followUpsOverdue,
    followUpsClosed,
    followUpsWithin,
    followUpPct: share(followUpsWithin, followUpsClosed),
  }
}

/** Per-facet CSAT lines for the breakdown table. */
export type FacetLine = { key: string; label: string; responses: number; average: number | null; csat: number | null; unhappy: number }
export const facetLines = (rows: CsatRow[], s: CsatSettings, facet: (r: CsatRow) => { key: string; label: string }): FacetLine[] => {
  const m = new Map<string, FacetLine & { sum: number; satisfied: number }>()
  for (const r of rows) {
    if (r.status !== 'responded' || r.score === null) continue
    const f = facet(r)
    let l = m.get(f.key)
    if (!l) {
      l = { key: f.key, label: f.label, responses: 0, average: null, csat: null, unhappy: 0, sum: 0, satisfied: 0 }
      m.set(f.key, l)
    }
    l.responses++
    l.sum += r.score
    if (isSatisfied(r.score, s)) l.satisfied++
    if (isUnhappy(r.score, s)) l.unhappy++
  }
  return [...m.values()]
    .map(({ sum, satisfied, ...l }) => ({ ...l, average: l.responses ? round1(sum / l.responses) : null, csat: share(satisfied, l.responses) }))
    .sort((a, b) => b.responses - a.responses || a.label.localeCompare(b.label))
}

/* ---------- The care band ---------- */

export type CareLevel = 'high' | 'watch' | 'good' | 'none'
export const CARE_LABEL: Record<CareLevel, string> = { high: 'Handle with care', watch: 'Watch', good: 'Happy customer', none: 'No rating yet' }

export type CareFlag = { id: string; customerId: string; customerName: string; level: 'high' | 'watch'; reason: string; setBy: string; setById: string; setAt: string; until: string | null; active: boolean }

export type Care = {
  level: CareLevel
  /** One sentence an agent reads before replying. */
  reason: string
  lastScore: CsatScore | null
  lastAt: string | null
  average: number | null
  /** Ratings considered (the latest few inside the window). */
  n: number
  /** Every rating in the window, for the counts. */
  total: number
  openFollowUp: boolean
  flag: CareFlag | null
}

export const NO_CARE: Care = { level: 'none', reason: '', lastScore: null, lastAt: null, average: null, n: 0, total: 0, openFollowUp: false, flag: null }

export const flagActive = (f: CareFlag | null | undefined, now: Date = new Date()): f is CareFlag => Boolean(f && f.active && (!f.until || new Date(f.until).getTime() > now.getTime()))

const daysAgoWord = (iso: string, now: Date): string => {
  const d = Math.floor((now.getTime() - new Date(iso).getTime()) / 864e5)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : d < 60 ? 'a month ago' : `${Math.round(d / 30)} months ago`
}

type Rating = Pick<CsatRow, 'score' | 'respondedAt' | 'followUp' | 'ticket'>

/** The band from a customer's ratings (newest first or not) and any manager flag. A flag wins; then an open follow-up or a low last
   score means high; a low score among the recent few or a weak average means watch; otherwise a satisfied customer. */
export const careFrom = (ratings: Rating[], flag: CareFlag | null, s: CsatSettings, now: Date = new Date()): Care => {
  const since = now.getTime() - s.careWindowDays * 864e5
  const inWindow = ratings
    .filter((r): r is Rating & { score: CsatScore; respondedAt: string } => r.score !== null && Boolean(r.respondedAt) && new Date(r.respondedAt!).getTime() >= since)
    .sort((a, b) => (a.respondedAt < b.respondedAt ? 1 : -1))
  const recent = inWindow.slice(0, s.careRecent)
  const last = recent[0] ?? null
  const average = recent.length ? round1(recent.reduce((t, r) => t + r.score, 0) / recent.length) : null
  const openFollowUp = inWindow.some((r) => r.followUp === 'pending' || r.followUp === 'in-progress')
  const base: Care = { level: 'none', reason: '', lastScore: last?.score ?? null, lastAt: last?.respondedAt ?? null, average, n: recent.length, total: inWindow.length, openFollowUp, flag: flagActive(flag, now) ? flag : null }
  if (base.flag) return { ...base, level: base.flag.level, reason: `Flagged by ${base.flag.setBy || 'a manager'}${base.flag.reason ? `: ${base.flag.reason}` : ''}` }
  if (!last) return base
  const lowRecent = recent.filter((r) => isUnhappy(r.score, s))
  if (openFollowUp) {
    const open = inWindow.find((r) => r.followUp === 'pending' || r.followUp === 'in-progress')!
    return { ...base, level: 'high', reason: `Rated ${open.score}/5 on ${open.ticket} ${daysAgoWord(open.respondedAt, now)}; a manager's follow-up is still open.` }
  }
  if (isUnhappy(last.score, s)) return { ...base, level: 'high', reason: `Rated their last case ${last.ticket} ${last.score}/5 ${daysAgoWord(last.respondedAt, now)}.` }
  if (average !== null && average < 3) return { ...base, level: 'high', reason: `Averages ${average}/5 over their last ${recent.length} ratings.` }
  if (lowRecent.length) return { ...base, level: 'watch', reason: `Rated ${lowRecent[0]!.ticket} ${lowRecent[0]!.score}/5 ${daysAgoWord(lowRecent[0]!.respondedAt, now)}; happier since.` }
  if (average !== null && average < s.satisfiedFrom) return { ...base, level: 'watch', reason: `Averages ${average}/5 over their last ${recent.length} ratings.` }
  return { ...base, level: 'good', reason: recent.length === 1 ? `Rated ${last.ticket} ${last.score}/5 ${daysAgoWord(last.respondedAt, now)}.` : `Averages ${average}/5 over their last ${recent.length} ratings.` }
}

/** Order for sorting lists by how much care a customer needs. */
export const CARE_RANK: Record<CareLevel, number> = { high: 0, watch: 1, none: 2, good: 3 }
