import { NextResponse } from 'next/server'

import { causeOf, followUpState } from '@/lib/support/csat'
import { AREA_LABEL, reasonOf } from '@/lib/support/csat-model'
import { getSettings } from '@/lib/support/kpi-config'
import { asPeriod } from '@/lib/support/kpi-model'
import { csvEscape, loadDesk } from '@/lib/support/metrics'
import { label as optLabel, ORIGIN, PRIORITY, VERTICAL } from '@/lib/support/options'
import { isManager, tryAgent } from '@/lib/support/session'

import { filterCsat, type CsatSP } from '../filters'

/* The CSAT ledger as CSV with the same filters as the page. Managers only; 401 for anyone else. */
export async function GET(req: Request): Promise<Response> {
  const me = await tryAgent()
  if (!me || !(await isManager(me))) return new NextResponse('Unauthorized', { status: 401 })
  const url = new URL(req.url)
  const sp = Object.fromEntries(url.searchParams.entries()) as CsatSP
  const settings = await getSettings()
  const period = asPeriod(sp.period, settings.defaultPeriod)
  const desk = await loadDesk(me.auth, settings, period)
  const rows = filterCsat(desk.csat, sp, settings, desk.now).sort((a, b) => (b.respondedAt ?? '').localeCompare(a.respondedAt ?? ''))
  const head = ['Case', 'Title', 'Customer', 'Customer kind', 'Email', 'Score', 'Satisfied', 'Comment', 'About (area)', 'About (reason)', 'Classified by', "Customer's own pick", 'Engineer', 'Product', 'Issue', 'Vertical', 'Priority', 'Origin', 'Source', 'Resolved', 'Rated', 'Follow-up', 'Follow-up by', 'Follow-up closed', 'Follow-up working minutes', 'Follow-up note', 'Case id']
  const lines = [head.join(',')]
  for (const r of rows) {
    const f = followUpState(r, settings, desk.now)
    lines.push(
      [
        r.ticket,
        r.title,
        r.customerName,
        r.customerKind,
        r.email,
        r.score ?? '',
        r.score === null ? '' : r.score >= settings.csat.satisfiedFrom ? 'yes' : r.score <= settings.csat.unhappyAtOrBelow ? 'low' : 'neutral',
        r.comment,
        causeOf(r).area ? AREA_LABEL[causeOf(r).area as keyof typeof AREA_LABEL] : '',
        causeOf(r).label === 'Not classified yet' ? '' : causeOf(r).label,
        causeOf(r).by === 'desk' ? causeOf(r).who || 'desk' : causeOf(r).by,
        reasonOf(r.customerReason)?.label ?? '',
        r.ownerName,
        r.product,
        r.issue,
        optLabel(VERTICAL, r.vertical),
        optLabel(PRIORITY, r.priority),
        optLabel(ORIGIN, r.origin),
        r.source,
        r.resolvedAt ?? '',
        r.respondedAt ?? '',
        r.followUp === 'none' ? '' : f.state,
        r.followUpOwnerName,
        r.followUpAt ?? '',
        r.followUp === 'none' ? '' : Math.round(f.minutes),
        r.followUpNote,
        r.caseId,
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  const stamp = desk.now.toISOString().slice(0, 10)
  return new NextResponse(`﻿${lines.join('\r\n')}\r\n`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="csat-${period}-${stamp}.csv"`, 'Cache-Control': 'no-store' } })
}
