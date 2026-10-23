import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { Period } from './dashboard-model'
import { toDeal, type Deal } from './deals-model'
import { toApplication } from './registration'
import type { Application } from './registration-model'
import { applicationsByState, applicationsCsv, pipelineByPartner, pipelineTotals, PIPELINE_COLUMNS, SCHEME_COLUMNS, schemeResults, SLA_COLUMNS, slaReport, toCsv, type ApplicationsReport, type PipelineRow, type ReportKey, type SchemeReportRow, type SlaReport } from './reports-model'
import { listSchemes } from './schemes'
import { toRegistration, toResult, type EligibilityResult, type Registration } from './schemes-model'
import { getPartnerSettings, type PartnerSettings } from './settings'
import { openClocks, queueRows } from './sla'

/* The K7 reports (M8): everything read from Payload in one pass, the maths in `reports-model.ts`. Up to 2,000 deals and
   applications; a programme past that gets the exports paged. */

type Doc = Record<string, unknown>
const db = () => getPayload({ config: configPromise })

export type ReportData = { settings: PartnerSettings; deals: Deal[]; applications: Application[]; registrations: Registration[]; results: EligibilityResult[]; schemes: Awaited<ReturnType<typeof listSchemes>>; pipeline: PipelineRow[]; pipelineTotals: PipelineRow; applicationsReport: ApplicationsReport; schemeRows: SchemeReportRow[]; sla: SlaReport }

export const loadReports = async (period: Period, now = new Date()): Promise<ReportData> => {
  const payload = await db()
  const settings = await getPartnerSettings()
  const [dealDocs, appDocs, schemes, regDocs, resDocs, clocks] = await Promise.all([
    payload.find({ collection: 'partner-deals', limit: 2000, depth: 1, sort: '-submittedAt', overrideAccess: true }),
    payload.find({ collection: 'partner-applications', where: { status: { not_equals: 'draft' } }, limit: 2000, depth: 0, sort: '-submittedAt', overrideAccess: true }),
    listSchemes('all'),
    payload.find({ collection: 'partner-scheme-registrations', limit: 2000, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'partner-eligibility', limit: 2000, depth: 0, overrideAccess: true }),
    openClocks(undefined, now),
  ])
  const deals = (dealDocs.docs as unknown as Doc[]).map(toDeal)
  const applications = (appDocs.docs as unknown as Doc[]).map(toApplication)
  const registrations = (regDocs.docs as unknown as Doc[]).map(toRegistration)
  const results = (resDocs.docs as unknown as Doc[]).map(toResult)
  const pipeline = pipelineByPartner(deals, period)
  return {
    settings,
    deals,
    applications,
    registrations,
    results,
    schemes,
    pipeline,
    pipelineTotals: pipelineTotals(pipeline),
    applicationsReport: applicationsByState(applications, settings.sla, settings.deals.approvalSlaHours, period),
    schemeRows: schemeResults(schemes, registrations, results, now),
    sla: slaReport(queueRows(clocks), deals.filter((d) => d.decidedAt), applications.filter((a) => a.decidedAt || a.status === 'clarification'), settings.sla, settings.deals.approvalSlaHours, period),
  }
}

export const reportCsv = (key: ReportKey, r: ReportData): string => {
  switch (key) {
    case 'pipeline':
      return toCsv(PIPELINE_COLUMNS, [...r.pipeline, r.pipelineTotals])
    case 'applications':
      return applicationsCsv(r.applicationsReport)
    case 'schemes':
      return toCsv(SCHEME_COLUMNS, r.schemeRows)
    case 'sla':
      return toCsv(SLA_COLUMNS, r.sla.queue)
  }
}
