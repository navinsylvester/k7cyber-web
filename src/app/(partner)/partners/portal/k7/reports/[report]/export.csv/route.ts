import { isPeriodKey, periodBounds, PERIODS } from '@/lib/partner/dashboard-model'
import { loadReports, reportCsv } from '@/lib/partner/reports'
import { isReportKey } from '@/lib/partner/reports-model'
import { tryK7 } from '@/lib/partner/session'

/* The reports' CSV (M8): one file per report for the period, to a K7 person with a role that opens the reports page. */
export async function GET(req: Request, { params }: { params: Promise<{ report: string }> }) {
  const me = await tryK7()
  if (!me) return new Response('Sign in first', { status: 401 })
  if (!me.roles.some((r) => r === 'channelManager' || r === 'dealDeskApprover' || r === 'schemeAdmin')) return new Response('Not your role', { status: 403 })
  const { report } = await params
  if (!isReportKey(report)) return new Response('Not found', { status: 404 })
  const sp = new URL(req.url).searchParams
  const asked = sp.get('period')
  const key = isPeriodKey(asked) ? asked : PERIODS[PERIODS.length - 1]!.key
  const data = await loadReports(periodBounds(key))
  const csv = reportCsv(report, data)
  return new Response(`﻿${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="partners-${report}-${key}.csv"`, 'Cache-Control': 'private, no-store' } })
}
