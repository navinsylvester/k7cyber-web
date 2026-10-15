import { addWorkingMinutes, readSla, workingMinutesBetween, type BusinessHours, type SlaReading } from './sla'

/* The product desk's pure model (docs/support-portal/10-product-desk.md §3, §7): kinds, teams, the bridge states and who may move
   them, the priorities with their clocks, the settings block, and the CRM mirror operations a state change implies. No I/O here;
   product.ts and product-mirror.ts do the reading and writing. Tested in tests/int/support-product.int.spec.ts. */

/* ---------- Vocabulary ---------- */

export type ItemKind = 'defect' | 'enhancement' | 'detection'
export const KINDS: ItemKind[] = ['defect', 'enhancement', 'detection']
export const KIND_LABEL: Record<ItemKind, string> = { defect: 'Defect', enhancement: 'Enhancement', detection: 'Detection' }
export const KIND_HINT: Record<ItemKind, string> = {
  defect: 'The product misbehaves: a crash, a wrong result, something that does not work as documented.',
  enhancement: 'The product should do something it does not do today.',
  detection: 'A false positive, a missed threat, a sample for analysis or a VDB question. Samples go to the Lab store by script, never here.',
}
export const asKind = (v: unknown): ItemKind | null => (KINDS.includes(v as ItemKind) ? (v as ItemKind) : null)

export type Team = 'engineering' | 'lab'
export const TEAMS: Team[] = ['engineering', 'lab']
export const asTeam = (v: unknown): Team | null => (TEAMS.includes(v as Team) ? (v as Team) : null)
/** Routing by kind, the default principal support may override at triage. */
export const defaultTeam = (kind: ItemKind): Team => (kind === 'detection' ? 'lab' : 'engineering')

export type ItemState = 'raised' | 'tracked' | 'needs-info' | 'fixed' | 'released' | 'declined' | 'closed'
export const STATES: ItemState[] = ['raised', 'tracked', 'needs-info', 'fixed', 'released', 'declined', 'closed']
export const STATE_LABEL: Record<ItemState, string> = { raised: 'Raised', tracked: 'Tracked', 'needs-info': 'Needs info', fixed: 'Fixed', released: 'Released', declined: 'Declined', closed: 'Closed' }
export const OPEN_STATES: ItemState[] = ['raised', 'tracked', 'needs-info', 'fixed', 'released']
export const asState = (v: unknown): ItemState | null => (STATES.includes(v as ItemState) ? (v as ItemState) : null)

/** Who acts: the desk (any agent), principal support, the two product teams, or the portal itself (the tracker sync, the sweep). */
export type Side = 'support' | 'principal' | 'engineering' | 'lab' | 'system'
export const SIDE_LABEL: Record<Side, string> = { support: 'Support', principal: 'Principal support', engineering: 'Engineering', lab: 'Lab', system: 'Portal' }

export type With = 'principal' | 'engineering' | 'lab' | 'support' | 'none'
export const WITH_LABEL: Record<With, string> = { principal: 'with principal support', engineering: 'with engineering', lab: 'with the Lab', support: 'with support', none: '' }

/** Whose turn it is, derived from the state and the team; never stored. */
export const withOf = (state: ItemState, team: Team): With => {
  switch (state) {
    case 'raised':
      return 'principal'
    case 'tracked':
    case 'fixed':
      return team
    case 'needs-info':
    case 'released':
    case 'declined':
      return 'support'
    case 'closed':
      return 'none'
  }
}

export type Priority = 'P1' | 'P2' | 'P3' | 'P4'
export const PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4']
export const asPriority = (v: unknown): Priority | null => (PRIORITIES.includes(v as Priority) ? (v as Priority) : null)

export type SeverityHint = 'blocks' | 'degraded' | 'cosmetic'
export const SEVERITIES: SeverityHint[] = ['blocks', 'degraded', 'cosmetic']
export const SEVERITY_LABEL: Record<SeverityHint, string> = { blocks: 'Blocks the customer', degraded: 'Degraded, workaround exists', cosmetic: 'Cosmetic or minor' }
export const asSeverity = (v: unknown): SeverityHint | null => (SEVERITIES.includes(v as SeverityHint) ? (v as SeverityHint) : null)
/** The provisional priority an item carries until principal support sets one: the agent's severity hint, read conservatively. */
export const provisionalPriority = (s: SeverityHint | null): Priority => (s === 'blocks' ? 'P2' : s === 'cosmetic' ? 'P4' : 'P3')

export type CaseChoice = 'keep-open' | 'workaround-resolved'
export const CASE_CHOICE_LABEL: Record<CaseChoice, string> = { 'keep-open': 'Keep the case open with product', 'workaround-resolved': 'Workaround given: I resolve the case; tell me when it ships' }
export const asCaseChoice = (v: unknown): CaseChoice => (v === 'workaround-resolved' ? 'workaround-resolved' : 'keep-open')

export type DeclineReason = 'duplicate' | 'by-design' | 'wont-fix' | 'cannot-reproduce' | 'not-a-bug'
export const DECLINE_REASONS: { key: DeclineReason; label: string }[] = [
  { key: 'duplicate', label: 'Duplicate of another item' },
  { key: 'by-design', label: 'Works as designed' },
  { key: 'wont-fix', label: 'Will not fix' },
  { key: 'cannot-reproduce', label: 'Cannot reproduce' },
  { key: 'not-a-bug', label: 'Not a product issue' },
]
export const asDeclineReason = (v: unknown): DeclineReason | null => (DECLINE_REASONS.some((d) => d.key === v) ? (v as DeclineReason) : null)
export const declineLabel = (k: DeclineReason | ''): string => DECLINE_REASONS.find((d) => d.key === k)?.label ?? ''

/* ---------- Transitions ---------- */

/** Who may move an item from one state to another (§3.2). `system` is the tracker sync and the sweep (phase B). */
const MOVES: { from: ItemState; to: ItemState; by: Side[] }[] = [
  { from: 'raised', to: 'tracked', by: ['principal'] }, // accept into the loop
  { from: 'raised', to: 'needs-info', by: ['principal'] }, // a question before triage
  { from: 'raised', to: 'declined', by: ['principal'] },
  { from: 'tracked', to: 'needs-info', by: ['principal', 'engineering', 'lab', 'system'] },
  { from: 'tracked', to: 'fixed', by: ['principal', 'engineering', 'lab', 'system'] },
  { from: 'tracked', to: 'released', by: ['principal', 'system'] }, // a hotfix shipped straight away
  { from: 'tracked', to: 'declined', by: ['principal', 'engineering', 'lab', 'system'] },
  { from: 'needs-info', to: 'raised', by: ['support', 'principal'] }, // the answer, back to where it was asked
  { from: 'needs-info', to: 'tracked', by: ['support', 'principal', 'system'] },
  { from: 'fixed', to: 'released', by: ['principal', 'system'] },
  { from: 'fixed', to: 'tracked', by: ['principal', 'system'] }, // the fix did not hold
  { from: 'released', to: 'closed', by: ['support', 'principal', 'system'] },
  { from: 'declined', to: 'closed', by: ['support', 'principal', 'system'] },
  { from: 'released', to: 'raised', by: ['support', 'principal'] }, // reopened: it is back
  { from: 'declined', to: 'raised', by: ['support', 'principal'] },
  { from: 'closed', to: 'raised', by: ['support', 'principal'] },
]

export const canMove = (side: Side, from: ItemState, to: ItemState): boolean => MOVES.some((m) => m.from === from && m.to === to && m.by.includes(side))

/** The states a side may move an item to from here. */
export const movesFor = (side: Side, from: ItemState): ItemState[] => MOVES.filter((m) => m.from === from && m.by.includes(side)).map((m) => m.to)

/* ---------- Settings ---------- */

export type TeamSetting = { key: Team; name: string; inboxEmail: string; leads: string[]; trackerProject: string }
export type PrioritySetting = { key: Priority; label: string; triageHours: number; updateEveryDays: number }
export type TrackerKind = 'none' | 'yodiz'
export type StatusMapEntry = { tracker: TrackerKind; projectId: string; statusCode: string; statusName: string; state: ItemState }

export type ProductSettings = {
  enabled: boolean
  teams: TeamSetting[]
  principals: { roles: string[]; emails: string[]; managersAreprincipals: boolean }
  priorities: PrioritySetting[]
  tracker: { kind: TrackerKind; pollMinutes: number; pollInBusinessHoursOnly: boolean; dailyBudget: number }
  statusMap: StatusMapEntry[]
  mirror: { enabled: boolean; createCrmRows: boolean; notesOnLinkedCases: boolean; statusBack: boolean }
  clock: { pauseWhileWithProduct: boolean; autoCloseDays: number; warnAtPercent: number }
  notify: { principalsOnRaise: boolean; inboxOnAccept: boolean; ownerOnChange: boolean }
  updatedAt: string | null
}

/* Defaults follow §7: the industry's targets by priority, the two teams the CRM already names, the mirror off until verified on UAT. */
export const DEFAULT_PRODUCT: ProductSettings = {
  enabled: true,
  teams: [
    { key: 'engineering', name: 'Engineering', inboxEmail: '', leads: [], trackerProject: '' },
    { key: 'lab', name: 'Lab', inboxEmail: '', leads: [], trackerProject: '' },
  ],
  principals: { roles: ['K7 - Principal Support', 'Principal Support'], emails: [], managersAreprincipals: true },
  priorities: [
    { key: 'P1', label: 'Customers blocked, data at risk, widespread false positive', triageHours: 4, updateEveryDays: 1 },
    { key: 'P2', label: 'Major function degraded, workaround exists', triageHours: 9, updateEveryDays: 3 },
    { key: 'P3', label: 'Minor defect or enhancement with demand', triageHours: 27, updateEveryDays: 10 },
    { key: 'P4', label: 'Cosmetic, low demand', triageHours: 45, updateEveryDays: 22 },
  ],
  tracker: { kind: 'none', pollMinutes: 30, pollInBusinessHoursOnly: true, dailyBudget: 300 },
  statusMap: [],
  mirror: { enabled: false, createCrmRows: true, notesOnLinkedCases: true, statusBack: true },
  clock: { pauseWhileWithProduct: true, autoCloseDays: 14, warnAtPercent: 75 },
  notify: { principalsOnRaise: true, inboxOnAccept: true, ownerOnChange: true },
  updatedAt: null,
}

type Raw = Record<string, unknown>
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : [])
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
const num = (v: unknown, d: number, min = 0): number => (typeof v === 'number' && Number.isFinite(v) && v >= min ? v : d)
const emails = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str((x as Raw)?.email ?? x).trim().toLowerCase()).filter(Boolean) : typeof v === 'string' ? v.split(/[\n,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean) : [])

/** From the Payload global (or nothing) to a complete settings object. */
export const normaliseProductSettings = (g: Raw | null | undefined): ProductSettings => {
  if (!g) return DEFAULT_PRODUCT
  const teams = DEFAULT_PRODUCT.teams.map((d) => {
    const t = arr(g.teams).find((x) => x.key === d.key)
    return t ? { key: d.key, name: str(t.name, d.name) || d.name, inboxEmail: str(t.inboxEmail).trim().toLowerCase(), leads: emails(t.leads), trackerProject: str(t.trackerProject).trim() } : d
  })
  const pr = g.principals as Raw | undefined
  const priorities = DEFAULT_PRODUCT.priorities.map((d) => {
    const p = arr(g.priorities).find((x) => x.key === d.key)
    return p ? { key: d.key, label: str(p.label, d.label) || d.label, triageHours: num(p.triageHours, d.triageHours, 1), updateEveryDays: num(p.updateEveryDays, d.updateEveryDays, 1) } : d
  })
  const tr = g.tracker as Raw | undefined
  const mi = g.mirror as Raw | undefined
  const cl = g.clock as Raw | undefined
  const no = g.notify as Raw | undefined
  return {
    enabled: bool(g.enabled, true),
    teams,
    principals: {
      roles: pr ? (Array.isArray(pr.roles) ? pr.roles.map((r) => str((r as Raw)?.name ?? r).trim()).filter(Boolean) : DEFAULT_PRODUCT.principals.roles) : DEFAULT_PRODUCT.principals.roles,
      emails: pr ? emails(pr.emails) : [],
      managersAreprincipals: bool(pr?.managersAreprincipals, true),
    },
    priorities,
    tracker: { kind: tr?.kind === 'yodiz' ? 'yodiz' : 'none', pollMinutes: num(tr?.pollMinutes, 30, 5), pollInBusinessHoursOnly: bool(tr?.pollInBusinessHoursOnly, true), dailyBudget: num(tr?.dailyBudget, 300, 10) },
    statusMap: arr(g.statusMap)
      .map((m) => ({ tracker: (m.tracker === 'yodiz' ? 'yodiz' : 'none') as TrackerKind, projectId: str(m.projectId), statusCode: str(m.statusCode), statusName: str(m.statusName), state: asState(m.state) ?? 'tracked' }))
      .filter((m) => m.statusCode),
    mirror: { enabled: bool(mi?.enabled, false), createCrmRows: bool(mi?.createCrmRows, true), notesOnLinkedCases: bool(mi?.notesOnLinkedCases, true), statusBack: bool(mi?.statusBack, true) },
    clock: { pauseWhileWithProduct: bool(cl?.pauseWhileWithProduct, true), autoCloseDays: num(cl?.autoCloseDays, 14, 1), warnAtPercent: num(cl?.warnAtPercent, 75, 10) },
    notify: { principalsOnRaise: bool(no?.principalsOnRaise, true), inboxOnAccept: bool(no?.inboxOnAccept, true), ownerOnChange: bool(no?.ownerOnChange, true) },
    updatedAt: str(g.updatedAt) || null,
  }
}

export const teamOf = (s: ProductSettings, key: Team): TeamSetting => s.teams.find((t) => t.key === key) ?? DEFAULT_PRODUCT.teams.find((t) => t.key === key)!
export const priorityOf = (s: ProductSettings, key: Priority): PrioritySetting => s.priorities.find((p) => p.key === key) ?? DEFAULT_PRODUCT.priorities.find((p) => p.key === key)!

/* ---------- Rows ---------- */

export type Person = { id: string; name: string; email: string }
export const NOBODY: Person = { id: '', name: '', email: '' }

export type ItemRow = {
  id: string
  seq: number
  number: string
  kind: ItemKind
  team: Team
  state: ItemState
  /** The state a question was asked from, so the answer returns there. */
  askedFrom: ItemState | null
  priority: Priority
  title: string
  summary: string
  severityHint: SeverityHint | null
  customerImpact: string
  productId: string
  productName: string
  productFamily: string
  affectedVersion: string
  platform: string
  issueCategory: string
  subCategory: string
  vertical: number | null
  casePriority: number | null
  /** Set by principal support, the tracker or the release form. */
  tracker: { kind: TrackerKind; projectId: string; id: string; key: string; url: string; status: string; category: string; syncedAt: string | null }
  fixedVersion: string
  releasedVersion: string
  releaseNote: string
  showReleaseToCustomer: boolean
  declineReason: DeclineReason | ''
  declineNote: string
  raisedBy: Person
  raisedAt: string
  triagedBy: Person
  triagedAt: string | null
  supportOwner: Person
  productOwner: string
  fixedAt: string | null
  releasedAt: string | null
  closedAt: string | null
  lastActivityAt: string
  caseCount: number
  crmRfeId: string
  crmDefectId: string
  /** The CRM row's own number (RF0224, DF0094). */
  crmRef: string
  createdAt: string
}

export type ItemCase = {
  id: string
  itemId: string
  caseId: string
  ticket: string
  title: string
  productName: string
  vertical: number | null
  casePriority: number | null
  customerKind: 'account' | 'contact' | ''
  accountName: string
  supportOwner: Person
  caseChoice: CaseChoice
  toldAt: string | null
  linkedBy: Person
  linkedAt: string
  unlinkedAt: string | null
}

export type EventKind = 'handoff' | 'comment' | 'tracker-comment' | 'state' | 'tracker-status' | 'route' | 'priority' | 'link' | 'unlink' | 'ask' | 'answer' | 'told' | 'sample' | 'mirror'
export const EVENT_LABEL: Record<EventKind, string> = { handoff: 'Hand-off', comment: 'Comment', 'tracker-comment': 'Tracker comment', state: 'State', 'tracker-status': 'Tracker status', route: 'Routed', priority: 'Priority', link: 'Case linked', unlink: 'Case unlinked', ask: 'Question', answer: 'Answer', told: 'Customer told', sample: 'Sample', mirror: 'CRM mirror' }

export type Evidence = { id: string; name: string; mime: string; size: number; url: string }

export type ItemEvent = {
  id: string
  itemId: string
  kind: EventKind
  side: Side
  by: Person
  text: string
  from: ItemState | ''
  to: ItemState | ''
  caseTicket: string
  evidence: Evidence[]
  at: string
}

/* ---------- Clocks (§7) ---------- */

/** Working minutes in one business day: what "every N working days" means in minutes. */
export const minutesPerDay = (bh: BusinessHours): number => {
  const [sh, sm] = bh.start.split(':').map(Number)
  const [eh, em] = bh.end.split(':').map(Number)
  const m = (eh ?? 18) * 60 + (em ?? 0) - ((sh ?? 9) * 60 + (sm ?? 0))
  return m > 0 ? m : 540
}

/** The triage clock: working hours since the item was raised against the priority's triage target. Stops when triage happened. */
export const triageReading = (item: Pick<ItemRow, 'raisedAt' | 'triagedAt' | 'priority' | 'state'>, s: ProductSettings, bh: BusinessHours, now: Date): SlaReading => {
  const p = priorityOf(s, item.priority)
  return readSla({ start: item.raisedAt, end: item.triagedAt ?? (item.state !== 'raised' ? now : null), now, targetMinutes: p.triageHours * 60, warnAtPercent: s.clock.warnAtPercent, hours: bh })
}

/** The update cadence while tracked: working time since the last activity against "every N working days". */
export const cadenceReading = (item: Pick<ItemRow, 'lastActivityAt' | 'priority' | 'state'>, s: ProductSettings, bh: BusinessHours, now: Date): SlaReading => {
  const p = priorityOf(s, item.priority)
  return readSla({ start: item.lastActivityAt, end: null, now, targetMinutes: p.updateEveryDays * minutesPerDay(bh), warnAtPercent: s.clock.warnAtPercent, hours: bh, paused: item.state !== 'tracked' && item.state !== 'fixed' })
}

/** When a released item nobody closed is closed by the sweep. */
export const autoCloseAt = (releasedAt: string, s: ProductSettings): Date => new Date(new Date(releasedAt).getTime() + s.clock.autoCloseDays * 864e5)

/** The deadline of the triage clock, for the inbox. */
export const triageDeadline = (raisedAt: string, priority: Priority, s: ProductSettings, bh: BusinessHours): Date => addWorkingMinutes(raisedAt, priorityOf(s, priority).triageHours * 60, bh)

/** Working minutes an item has spent with product (raised → released/declined/closed, or now). */
export const minutesWithProduct = (item: Pick<ItemRow, 'raisedAt' | 'releasedAt' | 'closedAt' | 'state'>, bh: BusinessHours, now: Date): number => {
  const end = item.releasedAt ?? (item.state === 'declined' || item.state === 'closed' ? item.closedAt : null)
  return workingMinutesBetween(item.raisedAt, end ?? now, bh)
}

/* ---------- The CRM mirror a change implies (§6) ---------- */

export type MirrorOp =
  | { op: 'status'; caseId: string; ticket: string; statuscode: number; /** Only when the case currently sits in one of these. */ onlyFrom: number[] | null }
  | { op: 'note'; caseId: string; ticket: string; subject: string; text: string }
  | { op: 'task'; caseId: string; ticket: string; subject: string; description: string }
  /** The CRM's own RFE or defect row: created at raise (body = the create input), updated as the item moves (body = status, priority, yodizId). */
  | { op: 'rfe' | 'defect'; caseId: string; ticket: string; action: 'create' | 'update'; rowId: string; body: Record<string, unknown> }

/* The RFE and defect rows (03-metadata-summary.md): which CRM status an item state means. */
export const CRM_RFE_STATUS = { OPEN: 696720001, ACCEPTED: 696720002, REJECTED: 696720003, CLOSED: 696720004 } as const
export const CRM_DEFECT_STATUS = { SUPPORT: 696720000, LAB: 696720001, CORE: 696720002, RND: 696720003, CLOSED_ENGINEERING: 696720004, CLOSED: 696720005 } as const
export const CRM_DEFECT_PRIORITY: Record<Priority, number> = { P1: 696720003, P2: 696720000, P3: 696720001, P4: 696720002 }
export const CRM_RFE_TYPE_CUSTOMER = 100000001
export const CRM_RFE_FROM_CUSTOMER = 100000000

/** An enhancement is an RFE row; a defect or a detection issue is a defect row. */
export const crmRowKind = (kind: ItemKind): 'rfe' | 'defect' => (kind === 'enhancement' ? 'rfe' : 'defect')

export const rfeStatusFor = (state: ItemState): number => {
  switch (state) {
    case 'raised':
      return CRM_RFE_STATUS.OPEN
    case 'tracked':
    case 'needs-info':
    case 'fixed':
      return CRM_RFE_STATUS.ACCEPTED
    case 'declined':
      return CRM_RFE_STATUS.REJECTED
    case 'released':
    case 'closed':
      return CRM_RFE_STATUS.CLOSED
  }
}

export const defectStatusFor = (state: ItemState, team: Team): number => {
  switch (state) {
    case 'raised':
      return CRM_DEFECT_STATUS.SUPPORT
    case 'tracked':
    case 'needs-info':
      return team === 'lab' ? CRM_DEFECT_STATUS.LAB : CRM_DEFECT_STATUS.RND
    case 'fixed':
      return CRM_DEFECT_STATUS.CLOSED_ENGINEERING
    case 'released':
    case 'closed':
    case 'declined':
      return CRM_DEFECT_STATUS.CLOSED
  }
}

/** The update of the item's CRM row that a state (or a priority or tracker change) implies; nothing until the row exists. */
export const crmRowOpsFor = (c: Pick<MirrorContext, 'item' | 'settings'>, state: ItemState): MirrorOp[] => {
  if (!c.settings.mirror.createCrmRows) return []
  const i = c.item
  const yodiz = i.tracker.key ? { yodizId: i.tracker.key } : {}
  if (crmRowKind(i.kind) === 'rfe') return i.crmRfeId ? [{ op: 'rfe', caseId: '', ticket: i.number, action: 'update', rowId: i.crmRfeId, body: { status: rfeStatusFor(state), ...yodiz } }] : []
  return i.crmDefectId ? [{ op: 'defect', caseId: '', ticket: i.number, action: 'update', rowId: i.crmDefectId, body: { status: defectStatusFor(state, i.team), priority: CRM_DEFECT_PRIORITY[i.priority], ...yodiz } }] : []
}

/** Note subjects start with this; `isCustomerVisibleNote` never matches it, so customers never see them. */
export const MIRROR_NOTE_PREFIX = 'Product desk:'

/** Case status reasons (options.ts) the mirror writes; kept here so the model stays free of Dataverse imports. */
export const CASE_STATUS = { PRINCIPLE: 1, LAB: 696720002, SUPPORT: 696720001 } as const
const LOOP_STATUSES = [CASE_STATUS.PRINCIPLE, CASE_STATUS.LAB]

export type MirrorContext = { item: Pick<ItemRow, 'number' | 'kind' | 'team' | 'title' | 'priority' | 'tracker' | 'releasedVersion' | 'releaseNote' | 'declineReason' | 'declineNote' | 'fixedVersion' | 'crmRfeId' | 'crmDefectId'>; cases: Pick<ItemCase, 'caseId' | 'ticket' | 'caseChoice' | 'unlinkedAt'>[]; by: Person; settings: ProductSettings; teamName: string }

const line = (c: MirrorContext, what: string): string => `${MIRROR_NOTE_PREFIX} ${c.item.number} ${what}`

/** The operations a bridge-state change implies on every linked case. Pure; product-mirror.ts applies them. */
export const mirrorOpsFor = (c: MirrorContext, from: ItemState | null, to: ItemState, o: { question?: string } = {}): MirrorOp[] => {
  const ops: MirrorOp[] = []
  const live = c.cases.filter((x) => !x.unlinkedAt)
  const m = c.settings.mirror
  const tk = c.item.tracker.key ? ` · ${c.item.tracker.key}${c.item.tracker.status ? ` ${c.item.tracker.status}` : ''}` : ''
  for (const x of live) {
    const open = x.caseChoice === 'keep-open'
    switch (to) {
      case 'raised':
        if (from === null) {
          if (m.notesOnLinkedCases) ops.push({ op: 'note', caseId: x.caseId, ticket: x.ticket, subject: line(c, `raised (${KIND_LABEL[c.item.kind].toLowerCase()})`), text: `${c.by.name || 'An agent'} raised ${c.item.number} "${c.item.title}" with principal support. ${open ? 'The case stays open with product.' : 'A workaround was given; the case is resolved and the customer is told when the fix ships.'}` })
          if (m.statusBack && open) ops.push({ op: 'status', caseId: x.caseId, ticket: x.ticket, statuscode: CASE_STATUS.PRINCIPLE, onlyFrom: null })
        } else {
          if (m.notesOnLinkedCases) ops.push({ op: 'note', caseId: x.caseId, ticket: x.ticket, subject: line(c, 'reopened'), text: `${c.by.name || 'An agent'} reopened ${c.item.number} "${c.item.title}"; it is back with principal support.` })
          if (m.statusBack && open) ops.push({ op: 'status', caseId: x.caseId, ticket: x.ticket, statuscode: CASE_STATUS.PRINCIPLE, onlyFrom: [CASE_STATUS.SUPPORT, ...LOOP_STATUSES] })
        }
        break
      case 'tracked':
        if (m.notesOnLinkedCases) ops.push({ op: 'note', caseId: x.caseId, ticket: x.ticket, subject: line(c, from === 'needs-info' ? 'answered' : from === 'fixed' ? 'back in progress' : `accepted by ${c.teamName}`), text: from === 'needs-info' ? `The question on ${c.item.number} was answered; it is back with ${c.teamName}${tk}.` : from === 'fixed' ? `The fix for ${c.item.number} did not hold; it is back with ${c.teamName}${tk}.` : `${c.by.name || 'Principal support'} accepted ${c.item.number} "${c.item.title}" for ${c.teamName} at ${c.item.priority}${tk}.` })
        if (m.statusBack && open && from !== 'needs-info' && from !== 'fixed') ops.push({ op: 'status', caseId: x.caseId, ticket: x.ticket, statuscode: c.item.team === 'lab' ? CASE_STATUS.LAB : CASE_STATUS.PRINCIPLE, onlyFrom: LOOP_STATUSES })
        break
      case 'needs-info':
        if (m.notesOnLinkedCases) ops.push({ op: 'note', caseId: x.caseId, ticket: x.ticket, subject: line(c, 'needs information from support'), text: `${c.teamName} asks on ${c.item.number}: ${o.question ?? '(see the item)'}\nAnswer from the case page or the product desk.` })
        ops.push({ op: 'task', caseId: x.caseId, ticket: x.ticket, subject: `Answer ${c.item.number}: ${c.teamName} needs information`, description: o.question ?? '' })
        break
      case 'fixed':
        if (m.notesOnLinkedCases) ops.push({ op: 'note', caseId: x.caseId, ticket: x.ticket, subject: line(c, `fixed${c.item.fixedVersion ? ` in ${c.item.fixedVersion}` : ''}`), text: `${c.item.number} "${c.item.title}" is fixed${c.item.fixedVersion ? ` in ${c.item.fixedVersion}` : ''} and awaiting release${tk}.` })
        break
      case 'released':
        if (m.notesOnLinkedCases) ops.push({ op: 'note', caseId: x.caseId, ticket: x.ticket, subject: line(c, `released${c.item.releasedVersion ? ` in ${c.item.releasedVersion}` : ''}`), text: `${c.item.number} "${c.item.title}" shipped${c.item.releasedVersion ? ` in ${c.item.releasedVersion}` : ''}.${c.item.releaseNote ? ` ${c.item.releaseNote}` : ''} Tell the customer and close the item from the portal.` })
        if (m.statusBack && open) ops.push({ op: 'status', caseId: x.caseId, ticket: x.ticket, statuscode: CASE_STATUS.SUPPORT, onlyFrom: LOOP_STATUSES })
        break
      case 'declined':
        if (m.notesOnLinkedCases) ops.push({ op: 'note', caseId: x.caseId, ticket: x.ticket, subject: line(c, `declined: ${declineLabel(c.item.declineReason).toLowerCase() || 'declined'}`), text: `${c.by.name || 'Product'} declined ${c.item.number} "${c.item.title}"${c.item.declineReason ? ` (${declineLabel(c.item.declineReason).toLowerCase()})` : ''}.${c.item.declineNote ? ` ${c.item.declineNote}` : ''} Decide the case with the customer.` })
        if (m.statusBack && open) ops.push({ op: 'status', caseId: x.caseId, ticket: x.ticket, statuscode: CASE_STATUS.SUPPORT, onlyFrom: LOOP_STATUSES })
        break
      case 'closed':
        if (m.notesOnLinkedCases) ops.push({ op: 'note', caseId: x.caseId, ticket: x.ticket, subject: line(c, 'closed'), text: `${c.item.number} is closed${c.by.name ? ` by ${c.by.name}` : ''}.` })
        break
    }
  }
  return [...ops, ...crmRowOpsFor(c, to)]
}

/** The ops for one more case joining an existing item. */
export const linkOpsFor = (c: MirrorContext, x: Pick<ItemCase, 'caseId' | 'ticket' | 'caseChoice'>, state: ItemState): MirrorOp[] => {
  const ops: MirrorOp[] = []
  const m = c.settings.mirror
  if (m.notesOnLinkedCases) ops.push({ op: 'note', caseId: x.caseId, ticket: x.ticket, subject: line(c, `linked (${STATE_LABEL[state].toLowerCase()})`), text: `${c.by.name || 'An agent'} linked this case to ${c.item.number} "${c.item.title}", which is ${STATE_LABEL[state].toLowerCase()} ${WITH_LABEL[withOf(state, c.item.team)]}.` })
  if (m.statusBack && x.caseChoice === 'keep-open' && (state === 'raised' || state === 'tracked' || state === 'needs-info' || state === 'fixed')) ops.push({ op: 'status', caseId: x.caseId, ticket: x.ticket, statuscode: state === 'raised' ? CASE_STATUS.PRINCIPLE : c.item.team === 'lab' ? CASE_STATUS.LAB : CASE_STATUS.PRINCIPLE, onlyFrom: null })
  return ops
}

/* ---------- Small helpers shared by pages ---------- */

/** PD-0042 from a sequence number. */
export const itemNumber = (seq: number): string => `PD-${String(seq).padStart(4, '0')}`
export const parseItemNumber = (s: string): number | null => {
  const m = /^PD-?(\d{1,8})$/i.exec(s.trim())
  return m ? Number(m[1]) : null
}

/** Open items first by urgency: needs-info (ball with the desk), then raised oldest first, then the rest by last activity. */
export const inboxOrder = (a: ItemRow, b: ItemRow): number => {
  const rank = (s: ItemState) => (s === 'needs-info' ? 0 : s === 'raised' ? 1 : s === 'released' ? 2 : s === 'fixed' ? 3 : s === 'tracked' ? 4 : 5)
  const r = rank(a.state) - rank(b.state)
  if (r) return r
  return a.state === 'raised' ? a.raisedAt.localeCompare(b.raisedAt) : b.lastActivityAt.localeCompare(a.lastActivityAt)
}

/** Words of a title worth matching when the escalate panel asks "is it one of these?". */
export const titleWords = (title: string): string[] =>
  title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .slice(0, 6)
const STOP = new Set(['with', 'from', 'that', 'this', 'when', 'after', 'while', 'issue', 'problem', 'error', 'customer', 'unable', 'not', 'the', 'and'])

/** Simple relevance: shared words between a candidate title and the case title. */
export const similarity = (a: string, b: string): number => {
  const wa = new Set(titleWords(a))
  const wb = titleWords(b)
  if (!wa.size || !wb.length) return 0
  return wb.filter((w) => wa.has(w)).length
}
