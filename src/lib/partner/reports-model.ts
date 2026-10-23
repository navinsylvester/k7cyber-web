import { dealOutcome, isOpenOutcome, orderValue, pipelineValue, type Period, inPeriod } from './dashboard-model'
import type { Deal } from './deals-model'
import type { Application } from './registration-model'
import { schemePhase, type EligibilityResult, type Registration, type Scheme } from './schemes-model'
import { applicationDecisionMinutes, dealDecisionMinutes, type SlaReading, type SlaSettings } from './sla-model'
import { PARTNER_TYPE_LABEL } from './settings-model'
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUSES, type ApplicationStatus } from './status'

/* The K7 reports (02-build-plan.md M8 "Reports for K7": pipeline by partner, applications by state, scheme results, the
   approval SLA), computed from the portal's rows and the deals' CRM snapshots, never live. Each report is a list of rows
   with a totals line and a CSV shape. Pure; tested without a tenant. */

export const REPORTS = [
  { key: 'pipeline', label: 'Pipeline by partner', hint: 'Every organisation’s deals in the period: open, won and lost by the CRM’s word, with the pipeline and the won value.' },
  { key: 'applications', label: 'Applications by state', hint: 'Where the applications of the period stand, by partner type, with the time to a decision.' },
  { key: 'schemes', label: 'Scheme results', hint: 'Every scheme: registrations, results, the benefit due and what has been paid.' },
  { key: 'sla', label: 'Approval SLA', hint: 'What waits on K7 now and how long decisions took in the period, against the target.' },
] as const
export type ReportKey = (typeof REPORTS)[number]['key']
export const isReportKey = (v: unknown): v is ReportKey => REPORTS.some((r) => r.key === v)

export type CsvColumn<T> = { key: keyof T & string; label: string }

const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC 4180 with a header row; numbers plain, nulls blank. */
export const toCsv = <T extends object>(columns: CsvColumn<T>[], rows: T[]): string => [columns.map((c) => cell(c.label)).join(','), ...rows.map((r) => columns.map((c) => cell((r as Record<string, unknown>)[c.key])).join(','))].join('\r\n') + '\r\n'

/* ---------- Pipeline by partner ---------- */

export type PipelineRow = { orgId: string; partnerId: string; partner: string; type: string; deals: number; open: number; won: number; lost: number; pipelineValue: number; wonValue: number; winRate: number | null }

export const pipelineByPartner = (deals: Deal[], p?: Period): PipelineRow[] => {
  const by = new Map<string, PipelineRow>()
  for (const d of deals) {
    if (p && !inPeriod(d, p)) continue
    let row = by.get(d.orgId)
    if (!row) {
      row = { orgId: d.orgId, partnerId: d.orgPartnerId, partner: d.orgName, type: d.orgType ? PARTNER_TYPE_LABEL[d.orgType] : '', deals: 0, open: 0, won: 0, lost: 0, pipelineValue: 0, wonValue: 0, winRate: null }
      by.set(d.orgId, row)
    }
    row.deals += 1
    const o = dealOutcome(d)
    if (isOpenOutcome(o)) {
      row.open += 1
      row.pipelineValue += pipelineValue(d)
    } else if (o === 'won') {
      row.won += 1
      row.wonValue += orderValue(d) ?? 0
    } else if (o === 'lost') row.lost += 1
  }
  const rows = [...by.values()]
  for (const r of rows) r.winRate = r.won + r.lost > 0 ? Math.round((r.won / (r.won + r.lost)) * 1000) / 10 : null
  return rows.sort((a, b) => b.wonValue - a.wonValue || b.pipelineValue - a.pipelineValue || b.deals - a.deals || a.partner.localeCompare(b.partner))
}

export const pipelineTotals = (rows: PipelineRow[]): PipelineRow => {
  const t: PipelineRow = { orgId: '', partnerId: '', partner: 'Every partner', type: '', deals: 0, open: 0, won: 0, lost: 0, pipelineValue: 0, wonValue: 0, winRate: null }
  for (const r of rows) {
    t.deals += r.deals
    t.open += r.open
    t.won += r.won
    t.lost += r.lost
    t.pipelineValue += r.pipelineValue
    t.wonValue += r.wonValue
  }
  t.winRate = t.won + t.lost > 0 ? Math.round((t.won / (t.won + t.lost)) * 1000) / 10 : null
  return t
}

export const PIPELINE_COLUMNS: CsvColumn<PipelineRow>[] = [
  { key: 'partnerId', label: 'Partner ID' },
  { key: 'partner', label: 'Partner' },
  { key: 'type', label: 'Type' },
  { key: 'deals', label: 'Deals' },
  { key: 'open', label: 'Open' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'pipelineValue', label: 'Pipeline value (INR)' },
  { key: 'wonValue', label: 'Won value (INR)' },
  { key: 'winRate', label: 'Win rate (%)' },
]

/* ---------- Applications by state ---------- */

export type ApplicationStateRow = { status: ApplicationStatus; label: string; total: number; byType: Record<string, number> }
export type ApplicationsReport = { rows: ApplicationStateRow[]; total: number; types: string[]; decided: number; medianDecisionMinutes: number | null; withinTarget: number | null }

const appInPeriod = (a: Application, p?: Period): boolean => {
  if (!p) return true
  const at = a.submittedAt ?? a.createdAt
  return (!p.from || at >= p.from) && (!p.to || at <= p.to)
}

export const applicationsByState = (apps: Application[], sla: SlaSettings, targetHours: number, p?: Period): ApplicationsReport => {
  const inP = apps.filter((a) => a.status !== 'draft' && appInPeriod(a, p))
  const types = [...new Set(inP.map((a) => PARTNER_TYPE_LABEL[a.type]))].sort()
  const rows: ApplicationStateRow[] = APPLICATION_STATUSES.filter((s) => s !== 'draft').map((status) => ({ status, label: APPLICATION_STATUS_LABEL[status], total: 0, byType: Object.fromEntries(types.map((t) => [t, 0])) }))
  for (const a of inP) {
    const row = rows.find((r) => r.status === a.status)!
    row.total += 1
    row.byType[PARTNER_TYPE_LABEL[a.type]] = (row.byType[PARTNER_TYPE_LABEL[a.type]] ?? 0) + 1
  }
  const times = inP.map((a) => applicationDecisionMinutes(a, sla)).filter((m): m is number => m !== null)
  return { rows: rows.filter((r) => r.total > 0 || r.status === 'submitted' || r.status === 'approved'), total: inP.length, types, decided: times.length, medianDecisionMinutes: median(times), withinTarget: times.length ? Math.round((times.filter((m) => m <= targetHours * 60).length / times.length) * 1000) / 10 : null }
}

export type ApplicationsCsvRow = { state: string; total: number } & Record<string, number | string>
export const applicationsCsv = (r: ApplicationsReport): string => {
  const columns: CsvColumn<ApplicationsCsvRow>[] = [{ key: 'state', label: 'State' }, { key: 'total', label: 'Applications' }, ...r.types.map((t) => ({ key: t, label: t }))]
  return toCsv(columns, r.rows.map((row) => ({ state: row.label, total: row.total, ...row.byType }) as ApplicationsCsvRow))
}

/* ---------- Scheme results ---------- */

export type SchemeReportRow = { schemeId: string; scheme: string; phase: string; startDate: string; endDate: string; registered: number; pending: number; results: number; eligible: number; benefitDue: number; paid: number; paidAmount: number; disputesOpen: number; published: string }

const PHASE_WORD: Record<ReturnType<typeof schemePhase>, string> = { open: 'Open for registration', upcoming: 'Starts soon', running: 'Running', closed: 'Closed' }

/** The benefit an eligible result is due: the slab's amount when one is set. */
export const benefitOf = (sc: Pick<Scheme, 'slabs'>, r: Pick<EligibilityResult, 'eligible' | 'slabIndex'>): number => (r.eligible && r.slabIndex >= 0 ? (sc.slabs[r.slabIndex]?.amount ?? 0) : 0)

export const schemeResults = (schemes: Scheme[], registrations: Registration[], results: EligibilityResult[], now = new Date()): SchemeReportRow[] =>
  schemes
    .filter((sc) => sc.status !== 'draft')
    .map((sc) => {
      const regs = registrations.filter((r) => r.schemeId === sc.id)
      const res = results.filter((r) => r.schemeId === sc.id)
      const eligible = res.filter((r) => r.eligible)
      const paid = eligible.filter((r) => r.payout.status === 'paid')
      return {
        schemeId: sc.id,
        scheme: sc.name,
        phase: PHASE_WORD[schemePhase(sc, now)],
        startDate: sc.startDate,
        endDate: sc.endDate,
        registered: regs.filter((r) => r.status === 'approved').length,
        pending: regs.filter((r) => r.status === 'pending').length,
        results: res.length,
        eligible: eligible.length,
        benefitDue: eligible.reduce((s, r) => s + benefitOf(sc, r), 0),
        paid: paid.length,
        paidAmount: paid.reduce((s, r) => s + benefitOf(sc, r), 0),
        disputesOpen: res.filter((r) => r.dispute.status === 'open').length,
        published: sc.results.publishedAt ? sc.results.publishedAt.slice(0, 10) : '',
      }
    })
    .sort((a, b) => b.endDate.localeCompare(a.endDate))

export const SCHEME_COLUMNS: CsvColumn<SchemeReportRow>[] = [
  { key: 'scheme', label: 'Scheme' },
  { key: 'phase', label: 'Phase' },
  { key: 'startDate', label: 'Starts' },
  { key: 'endDate', label: 'Ends' },
  { key: 'registered', label: 'Registered' },
  { key: 'pending', label: 'Registrations waiting' },
  { key: 'results', label: 'Results' },
  { key: 'eligible', label: 'Eligible' },
  { key: 'benefitDue', label: 'Benefit due (INR)' },
  { key: 'paid', label: 'Paid' },
  { key: 'paidAmount', label: 'Paid (INR)' },
  { key: 'disputesOpen', label: 'Disputes open' },
  { key: 'published', label: 'Published' },
]

/* ---------- The approval SLA ---------- */

export type SlaQueueRow = { kind: 'deal' | 'application'; number: string; label: string; partner: string; startedAt: string; dueAt: string; state: SlaReading['state']; leftMinutes: number; href: string }
export type SlaReport = { open: number; atRisk: number; breached: number; queue: SlaQueueRow[]; decided: number; medianMinutes: number | null; p90Minutes: number | null; withinTarget: number | null; targetMinutes: number }

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2)
}

export const percentile = (xs: number[], p: number): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]!
}

export const slaReport = (queue: SlaQueueRow[], decidedDeals: Deal[], decidedApps: Application[], sla: SlaSettings, targetHours: number, p?: Period): SlaReport => {
  const times = [...decidedDeals.filter((d) => !p || inPeriod(d, p)).map((d) => dealDecisionMinutes(d, sla)), ...decidedApps.filter((a) => appInPeriod(a, p)).map((a) => applicationDecisionMinutes(a, sla))].filter((m): m is number => m !== null)
  const targetMinutes = Math.round(targetHours * 60)
  return {
    open: queue.length,
    atRisk: queue.filter((q) => q.state === 'at-risk').length,
    breached: queue.filter((q) => q.state === 'breached').length,
    queue: [...queue].sort((a, b) => a.leftMinutes - b.leftMinutes),
    decided: times.length,
    medianMinutes: median(times),
    p90Minutes: percentile(times, 90),
    withinTarget: times.length ? Math.round((times.filter((m) => m <= targetMinutes).length / times.length) * 1000) / 10 : null,
    targetMinutes,
  }
}

export const SLA_COLUMNS: CsvColumn<SlaQueueRow>[] = [
  { key: 'kind', label: 'Kind' },
  { key: 'number', label: 'Number' },
  { key: 'label', label: 'Item' },
  { key: 'partner', label: 'Partner' },
  { key: 'startedAt', label: 'Waiting since' },
  { key: 'dueAt', label: 'Due' },
  { key: 'state', label: 'State' },
  { key: 'leftMinutes', label: 'Working minutes left' },
]
