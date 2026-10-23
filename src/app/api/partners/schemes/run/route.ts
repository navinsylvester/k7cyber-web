import { NextResponse } from 'next/server'

import { cronAuthorised } from '@/lib/cron-auth'
import { recordJobRun } from '@/lib/partner/ops'
import { runDueSchemes } from '@/lib/partner/schemes'

/* The eligibility pass (01-requirements.md FR-ELG-01 "after a scheme closes"): a scheduler calls it daily with
   `Authorization: Bearer <CRON_SECRET>`; every published scheme that has closed and has no results yet is computed once from
   the deals' CRM snapshots. The Scheme Admin reviews and publishes by hand; the same pass sits behind "Compute what is due" on
   the desk. */

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await recordJobRun('schemesRun', () => runDueSchemes())
    return NextResponse.json(r, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'POST with the cron secret' }, { status: 405 })
}
