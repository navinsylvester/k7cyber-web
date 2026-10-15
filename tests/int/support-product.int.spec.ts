import { describe, expect, it } from 'vitest'

import { cadenceReading, canMove, CASE_STATUS, CRM_DEFECT_PRIORITY, CRM_DEFECT_STATUS, CRM_RFE_STATUS, crmRowKind, crmRowOpsFor, DEFAULT_PRODUCT, defaultTeam, inboxOrder, itemNumber, linkOpsFor, minutesPerDay, mirrorOpsFor, movesFor, normaliseProductSettings, parseItemNumber, provisionalPriority, similarity, triageReading, withOf, type ItemCase, type ItemRow, type MirrorContext } from '@/lib/support/product-model'
import { DEFAULT_HOURS } from '@/lib/support/sla'

/* The product desk's model without a tenant (10-product-desk.md §3, §6, §7): who may move an item where, the clocks, the settings
   block, and the CRM writes a change implies. IST business hours; 2026-10-13 is a Tuesday. */

const now = new Date('2026-10-13T06:30:00Z') // Tue 12:00 IST
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString()

let seq = 0
const item = (p: Partial<ItemRow> = {}): ItemRow => {
  seq++
  return {
    id: String(seq),
    seq,
    number: itemNumber(seq),
    kind: 'defect',
    team: 'engineering',
    state: 'raised',
    askedFrom: null,
    priority: 'P2',
    title: 'Scanner stops on large archives',
    summary: '',
    severityHint: 'degraded',
    customerImpact: '',
    productId: 'p1',
    productName: 'Total Security - 5U3Y',
    productFamily: 'Total Security',
    affectedVersion: '17.0.1',
    platform: '',
    issueCategory: '',
    subCategory: '',
    vertical: null,
    casePriority: null,
    tracker: { kind: 'none', projectId: '', id: '', key: '', url: '', status: '', category: '', syncedAt: null },
    fixedVersion: '',
    releasedVersion: '',
    releaseNote: '',
    showReleaseToCustomer: false,
    declineReason: '',
    declineNote: '',
    raisedBy: { id: 'a1', name: 'Priya', email: 'priya@k7.example' },
    raisedAt: hoursAgo(3),
    triagedBy: { id: '', name: '', email: '' },
    triagedAt: null,
    supportOwner: { id: 'a1', name: 'Priya', email: 'priya@k7.example' },
    productOwner: '',
    fixedAt: null,
    releasedAt: null,
    closedAt: null,
    lastActivityAt: hoursAgo(3),
    caseCount: 1,
    crmRfeId: '',
    crmDefectId: '',
    crmRef: '',
    createdAt: hoursAgo(3),
    ...p,
  }
}
const link = (p: Partial<ItemCase> = {}): ItemCase => ({ id: 'l1', itemId: '1', caseId: 'c1', ticket: 'CS-01192-C6G7', title: 'A case', productName: '', vertical: null, casePriority: null, customerKind: 'contact', accountName: '', supportOwner: { id: 'a1', name: 'Priya', email: '' }, caseChoice: 'keep-open', toldAt: null, linkedBy: { id: 'a1', name: 'Priya', email: '' }, linkedAt: hoursAgo(3), unlinkedAt: null, ...p })
const ctx = (i: ItemRow, cases: ItemCase[], mirror: Partial<MirrorContext['settings']['mirror']> = {}): MirrorContext => ({ item: i, cases, by: { id: 'p1', name: 'Shijas', email: 's@k7.example' }, settings: { ...DEFAULT_PRODUCT, mirror: { ...DEFAULT_PRODUCT.mirror, enabled: true, ...mirror } }, teamName: 'Engineering' })

describe('transitions', () => {
  it('lets principal support accept, ask and decline a raised item, and nobody else', () => {
    expect(canMove('principal', 'raised', 'tracked')).toBe(true)
    expect(canMove('principal', 'raised', 'declined')).toBe(true)
    expect(canMove('principal', 'raised', 'needs-info')).toBe(true)
    expect(canMove('support', 'raised', 'tracked')).toBe(false)
    expect(canMove('engineering', 'raised', 'tracked')).toBe(false)
  })
  it('lets the desk answer, close after release or decline, and reopen', () => {
    expect(canMove('support', 'needs-info', 'tracked')).toBe(true)
    expect(canMove('support', 'needs-info', 'raised')).toBe(true)
    expect(canMove('support', 'released', 'closed')).toBe(true)
    expect(canMove('support', 'declined', 'closed')).toBe(true)
    expect(canMove('support', 'closed', 'raised')).toBe(true)
    expect(canMove('support', 'tracked', 'fixed')).toBe(false)
    expect(canMove('support', 'tracked', 'released')).toBe(false)
  })
  it('lets the tracker (system) move tracked items, never close or reopen them', () => {
    expect(canMove('system', 'tracked', 'fixed')).toBe(true)
    expect(canMove('system', 'tracked', 'needs-info')).toBe(true)
    expect(canMove('system', 'fixed', 'released')).toBe(true)
    expect(canMove('system', 'closed', 'raised')).toBe(false)
    expect(movesFor('system', 'released')).toEqual(['closed'])
  })
  it('derives whose turn it is from state and team', () => {
    expect(withOf('raised', 'lab')).toBe('principal')
    expect(withOf('tracked', 'lab')).toBe('lab')
    expect(withOf('fixed', 'engineering')).toBe('engineering')
    expect(withOf('needs-info', 'lab')).toBe('support')
    expect(withOf('released', 'engineering')).toBe('support')
    expect(withOf('closed', 'engineering')).toBe('none')
  })
  it('routes detection to the Lab and reads the severity hint conservatively', () => {
    expect(defaultTeam('detection')).toBe('lab')
    expect(defaultTeam('enhancement')).toBe('engineering')
    expect(provisionalPriority('blocks')).toBe('P2')
    expect(provisionalPriority('degraded')).toBe('P3')
    expect(provisionalPriority('cosmetic')).toBe('P4')
    expect(provisionalPriority(null)).toBe('P3')
  })
})

describe('clocks', () => {
  it('reads the triage clock against the priority target in working hours', () => {
    // P1: 4 working hours. Raised Tue 09:00 IST, now 12:00 IST → 3 h used of 4, at risk at 75%.
    const i = item({ priority: 'P1', raisedAt: '2026-10-13T03:30:00Z' })
    const r = triageReading(i, DEFAULT_PRODUCT, DEFAULT_HOURS, now)
    expect(r.elapsed).toBe(180)
    expect(r.target).toBe(240)
    expect(r.state).toBe('at-risk')
    // Raised the previous Saturday at 17:00 IST: 1 h Saturday + 3 h Tuesday (Sunday closed, Monday 9 h) → well past.
    const late = triageReading(item({ priority: 'P1', raisedAt: '2026-10-10T11:30:00Z' }), DEFAULT_PRODUCT, DEFAULT_HOURS, now)
    expect(late.state).toBe('breached')
    // P2: 9 working hours; the same 3 h is on track.
    expect(triageReading(item({ priority: 'P2', raisedAt: '2026-10-13T03:30:00Z' }), DEFAULT_PRODUCT, DEFAULT_HOURS, now).state).toBe('ok')
  })
  it('stops the triage clock once the item is triaged', () => {
    const i = item({ priority: 'P1', raisedAt: '2026-10-13T03:30:00Z', triagedAt: '2026-10-13T04:30:00Z', state: 'tracked' })
    const r = triageReading(i, DEFAULT_PRODUCT, DEFAULT_HOURS, now)
    expect(r.state).toBe('met')
    expect(r.elapsed).toBe(60)
  })
  it('reads the update cadence in working days and pauses it off the tracked states', () => {
    expect(minutesPerDay(DEFAULT_HOURS)).toBe(540)
    const tracked = item({ state: 'tracked', priority: 'P1', lastActivityAt: '2026-10-09T03:30:00Z' }) // Fri 09:00 → Tue 12:00: Fri 9 + Sat 9 + Mon 9 + Tue 3 = 30 h (Sunday closed)
    const r = cadenceReading(tracked, DEFAULT_PRODUCT, DEFAULT_HOURS, now)
    expect(r.target).toBe(540)
    expect(r.elapsed).toBe(30 * 60)
    expect(r.state).toBe('breached')
    expect(cadenceReading(item({ state: 'released', lastActivityAt: '2026-10-09T03:30:00Z' }), DEFAULT_PRODUCT, DEFAULT_HOURS, now).state).toBe('paused')
  })
})

describe('settings', () => {
  it('fills defaults and normalises what the global holds', () => {
    expect(normaliseProductSettings(null)).toEqual(DEFAULT_PRODUCT)
    const s = normaliseProductSettings({
      teams: [{ key: 'lab', name: 'Threat Lab', inboxEmail: 'LAB@k7.example', leads: [{ email: 'Lead@k7.example' }], trackerProject: '7' }],
      principals: { roles: [{ name: 'CSR Manager' }], emails: 'a@k7.example, B@k7.example', managersAreprincipals: false },
      priorities: [{ key: 'P1', triageHours: 2, updateEveryDays: 1 }],
      mirror: { enabled: true },
      clock: { autoCloseDays: 7 },
    })
    expect(s.teams.find((t) => t.key === 'lab')).toEqual({ key: 'lab', name: 'Threat Lab', inboxEmail: 'lab@k7.example', leads: ['lead@k7.example'], trackerProject: '7' })
    expect(s.teams.find((t) => t.key === 'engineering')?.name).toBe('Engineering')
    expect(s.principals).toEqual({ roles: ['CSR Manager'], emails: ['a@k7.example', 'b@k7.example'], managersAreprincipals: false })
    expect(s.priorities.find((p) => p.key === 'P1')).toMatchObject({ triageHours: 2, updateEveryDays: 1, label: DEFAULT_PRODUCT.priorities[0]!.label })
    expect(s.priorities.find((p) => p.key === 'P3')?.triageHours).toBe(27)
    expect(s.mirror).toEqual({ enabled: true, createCrmRows: true, notesOnLinkedCases: true, statusBack: true })
    expect(s.clock.autoCloseDays).toBe(7)
    expect(s.tracker.kind).toBe('none')
  })
})

describe('the CRM mirror a change implies', () => {
  it('raise: an internal note and the status reason to Principle Support on a case kept open', () => {
    const ops = mirrorOpsFor(ctx(item(), [link()]), null, 'raised')
    expect(ops.map((o) => o.op)).toEqual(['note', 'status'])
    expect(ops[0]).toMatchObject({ op: 'note', subject: expect.stringMatching(/^Product desk: PD-\d{4} raised \(defect\)$/) })
    expect(ops[1]).toMatchObject({ op: 'status', statuscode: CASE_STATUS.PRINCIPLE, onlyFrom: null })
  })
  it('raise with a workaround: the note only; the agent resolves the case', () => {
    const ops = mirrorOpsFor(ctx(item(), [link({ caseChoice: 'workaround-resolved' })]), null, 'raised')
    expect(ops.map((o) => o.op)).toEqual(['note'])
  })
  it('accept for the Lab moves the case to In Progress-Lab, only from a loop status', () => {
    const ops = mirrorOpsFor(ctx(item({ team: 'lab', priority: 'P1' }), [link()]), 'raised', 'tracked')
    expect(ops.find((o) => o.op === 'status')).toMatchObject({ statuscode: CASE_STATUS.LAB, onlyFrom: [CASE_STATUS.PRINCIPLE, CASE_STATUS.LAB] })
    expect(mirrorOpsFor(ctx(item({ team: 'engineering' }), [link()]), 'raised', 'tracked').find((o) => o.op === 'status')).toMatchObject({ statuscode: CASE_STATUS.PRINCIPLE })
  })
  it('an answer back to tracked writes a note and leaves the status alone', () => {
    const ops = mirrorOpsFor(ctx(item({ state: 'needs-info' }), [link()]), 'needs-info', 'tracked')
    expect(ops.map((o) => o.op)).toEqual(['note'])
  })
  it('a question: a note and a task for the support owner on every linked case', () => {
    const ops = mirrorOpsFor(ctx(item({ state: 'tracked' }), [link(), link({ id: 'l2', caseId: 'c2', ticket: 'CS-02' })]), 'tracked', 'needs-info', { question: 'Which build?' })
    expect(ops.filter((o) => o.op === 'task')).toHaveLength(2)
    expect(ops.find((o) => o.op === 'task')).toMatchObject({ subject: expect.stringContaining('needs information'), description: 'Which build?' })
  })
  it('released and declined send the case back to In Progress-Support, only if it still sits in the loop', () => {
    const rel = mirrorOpsFor(ctx(item({ state: 'fixed', releasedVersion: '17.1' }), [link()]), 'fixed', 'released')
    expect(rel.find((o) => o.op === 'status')).toMatchObject({ statuscode: CASE_STATUS.SUPPORT, onlyFrom: [CASE_STATUS.PRINCIPLE, CASE_STATUS.LAB] })
    expect(rel.find((o) => o.op === 'note')).toMatchObject({ subject: expect.stringContaining('released in 17.1') })
    const dec = mirrorOpsFor(ctx(item({ state: 'raised', declineReason: 'duplicate' }), [link()]), 'raised', 'declined')
    expect(dec.find((o) => o.op === 'status')).toMatchObject({ statuscode: CASE_STATUS.SUPPORT })
    expect(dec.find((o) => o.op === 'note')?.subject).toContain('duplicate of another item')
  })
  it('never writes a status for an unlinked case, and nothing at all when the switches are off', () => {
    expect(mirrorOpsFor(ctx(item(), [link({ unlinkedAt: hoursAgo(1) })]), null, 'raised')).toEqual([])
    expect(mirrorOpsFor(ctx(item(), [link()], { notesOnLinkedCases: false, statusBack: false }), null, 'raised')).toEqual([])
    expect(mirrorOpsFor(ctx(item({ state: 'tracked' }), [link()], { notesOnLinkedCases: false, statusBack: false }), 'tracked', 'needs-info').map((o) => o.op)).toEqual(['task'])
  })
  it('a case joining an item gets the note and the loop status that matches the item state', () => {
    const ops = linkOpsFor(ctx(item({ state: 'tracked', team: 'lab' }), []), { caseId: 'c9', ticket: 'CS-09', caseChoice: 'keep-open' }, 'tracked')
    expect(ops.map((o) => o.op)).toEqual(['note', 'status'])
    expect(ops[1]).toMatchObject({ statuscode: CASE_STATUS.LAB })
    expect(linkOpsFor(ctx(item({ state: 'released' }), []), { caseId: 'c9', ticket: 'CS-09', caseChoice: 'keep-open' }, 'released').map((o) => o.op)).toEqual(['note'])
  })
})

describe('the CRM row behind an item', () => {
  it('an enhancement is an RFE row, anything else a defect row', () => {
    expect(crmRowKind('enhancement')).toBe('rfe')
    expect(crmRowKind('defect')).toBe('defect')
    expect(crmRowKind('detection')).toBe('defect')
  })
  it('writes the RFE status and the YODIZ id as the item moves, nothing until the row exists', () => {
    const settings = { ...DEFAULT_PRODUCT, mirror: { ...DEFAULT_PRODUCT.mirror, enabled: true, createCrmRows: true } }
    const none = item({ kind: 'enhancement' })
    expect(crmRowOpsFor({ item: none, settings }, 'tracked')).toEqual([])
    const i = item({ kind: 'enhancement', crmRfeId: 'rfe-1', tracker: { ...none.tracker, key: 'US-4001' } })
    expect(crmRowOpsFor({ item: i, settings }, 'tracked')).toEqual([{ op: 'rfe', caseId: '', ticket: i.number, action: 'update', rowId: 'rfe-1', body: { status: CRM_RFE_STATUS.ACCEPTED, yodizId: 'US-4001' } }])
    expect(crmRowOpsFor({ item: i, settings }, 'declined')[0]).toMatchObject({ body: { status: CRM_RFE_STATUS.REJECTED } })
    expect(crmRowOpsFor({ item: i, settings }, 'released')[0]).toMatchObject({ body: { status: CRM_RFE_STATUS.CLOSED } })
    expect(crmRowOpsFor({ item: i, settings }, 'raised')[0]).toMatchObject({ body: { status: CRM_RFE_STATUS.OPEN } })
    expect(crmRowOpsFor({ item: i, settings: { ...settings, mirror: { ...settings.mirror, createCrmRows: false } } }, 'tracked')).toEqual([])
  })
  it('writes the defect status by team, the priority and the YODIZ id', () => {
    const settings = { ...DEFAULT_PRODUCT, mirror: { ...DEFAULT_PRODUCT.mirror, enabled: true, createCrmRows: true } }
    const lab = item({ kind: 'detection', team: 'lab', priority: 'P1', crmDefectId: 'def-1' })
    expect(crmRowOpsFor({ item: lab, settings }, 'tracked')).toEqual([{ op: 'defect', caseId: '', ticket: lab.number, action: 'update', rowId: 'def-1', body: { status: CRM_DEFECT_STATUS.LAB, priority: CRM_DEFECT_PRIORITY.P1 } }])
    const eng = item({ kind: 'defect', team: 'engineering', priority: 'P3', crmDefectId: 'def-2' })
    expect(crmRowOpsFor({ item: eng, settings }, 'tracked')[0]).toMatchObject({ body: { status: CRM_DEFECT_STATUS.RND, priority: CRM_DEFECT_PRIORITY.P3 } })
    expect(crmRowOpsFor({ item: eng, settings }, 'fixed')[0]).toMatchObject({ body: { status: CRM_DEFECT_STATUS.CLOSED_ENGINEERING } })
    expect(crmRowOpsFor({ item: eng, settings }, 'released')[0]).toMatchObject({ body: { status: CRM_DEFECT_STATUS.CLOSED } })
    expect(crmRowOpsFor({ item: eng, settings }, 'declined')[0]).toMatchObject({ body: { status: CRM_DEFECT_STATUS.CLOSED } })
  })
  it('a move carries the row update along with the case writes', () => {
    const i = item({ kind: 'enhancement', crmRfeId: 'rfe-9', state: 'raised' })
    const ops = mirrorOpsFor(ctx(i, [link()]), 'raised', 'tracked')
    expect(ops.map((o) => o.op)).toEqual(['note', 'status', 'rfe'])
  })
})

describe('helpers', () => {
  it('formats and parses item numbers', () => {
    expect(itemNumber(42)).toBe('PD-0042')
    expect(itemNumber(12345)).toBe('PD-12345')
    expect(parseItemNumber('PD-0042')).toBe(42)
    expect(parseItemNumber('pd42')).toBe(42)
    expect(parseItemNumber('CS-0042')).toBeNull()
  })
  it('orders the inbox: questions, then raised oldest first, then the rest by activity', () => {
    const a = item({ state: 'tracked', lastActivityAt: hoursAgo(1) })
    const b = item({ state: 'raised', raisedAt: hoursAgo(10) })
    const c = item({ state: 'raised', raisedAt: hoursAgo(2) })
    const d = item({ state: 'needs-info' })
    expect([a, b, c, d].sort(inboxOrder).map((i) => i.id)).toEqual([d.id, b.id, c.id, a.id])
  })
  it('scores title similarity on shared words of four letters or more', () => {
    expect(similarity('Scanner stops on large archives', 'Scanner hangs with large archive files')).toBeGreaterThan(0)
    expect(similarity('Activation fails after renewal', 'Scanner stops on large archives')).toBe(0)
  })
})
