import { NextResponse } from 'next/server'

import { cronAuthorised } from '@/lib/cron-auth'
import { sweepDeals } from '@/lib/partner/deals'
import { recordJobRun } from '@/lib/partner/ops'

/* The deal sweep (01-requirements.md §7.2 Expired, FR-NTF-01 "protection ending"): a scheduler calls it daily with
   `Authorization: Bearer <CRON_SECRET>`; approved deals past their protection end expire, and those inside the notice window are
   told once. The same sweep sits behind the Run button on the K7 deals page. */

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ ...(await recordJobRun('dealsSweep', () => sweepDeals())), at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'POST with the cron secret' }, { status: 405 })
}
