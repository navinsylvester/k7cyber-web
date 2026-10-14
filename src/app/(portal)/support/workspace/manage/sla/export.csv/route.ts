import { NextResponse } from 'next/server'

import { getSettings } from '@/lib/support/kpi-config'
import { asPeriod } from '@/lib/support/kpi-model'
import { csvEscape, loadDesk, violations } from '@/lib/support/metrics'
import { label as optLabel, ORIGIN, PRIORITY, VERTICAL } from '@/lib/support/options'
import { isManager, tryAgent } from '@/lib/support/session'

import { filterViolations, type SlaSP } from '../page'

/* The SLA report as CSV with the same filters as the page. Managers only; 401 for anyone else. */
export async function GET(req: Request): Promise<Response> {
  const me = await tryAgent()
  if (!me || !(await isManager(me))) return new NextResponse('Unauthorized', { status: 401 })
  const url = new URL(req.url)
  const sp = Object.fromEntries(url.searchParams.entries()) as SlaSP
  const settings = await getSettings()
  const period = asPeriod(sp.period, settings.defaultPeriod)
  const desk = await loadDesk(me.auth, settings, period)
  const rows = filterViolations(violations(desk), sp)
  const head = ['Case', 'Title', 'Clock', 'Owner', 'Priority', 'Vertical', 'Origin', 'Target (working min)', 'Elapsed (working min)', 'Over by (working min)', 'State', 'CRM KPI', 'Created', 'Resolved', 'Case id']
  const lines = [head.join(',')]
  for (const v of rows) {
    lines.push(
      [
        v.c.ticket,
        v.c.title,
        v.kind,
        v.c.owner.name,
        optLabel(PRIORITY, v.c.priority),
        optLabel(VERTICAL, v.c.vertical),
        optLabel(ORIGIN, v.c.origin),
        Math.round(v.reading.target),
        Math.round(v.reading.elapsed),
        Math.round(-v.reading.left),
        v.open ? 'open' : 'resolved',
        v.c.crm ? `${v.c.crm.name}: ${v.c.crm.state}` : '',
        v.c.createdon.toISOString(),
        v.c.resolvedAt?.toISOString() ?? '',
        v.c.id,
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  const stamp = desk.now.toISOString().slice(0, 10)
  return new NextResponse(`﻿${lines.join('\r\n')}\r\n`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="sla-breaches-${period}-${stamp}.csv"`, 'Cache-Control': 'no-store' } })
}
