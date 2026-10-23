import { NextResponse } from 'next/server'

import { cronAuthorised } from '@/lib/cron-auth'
import { housekeeping, recordJobRun } from '@/lib/partner/ops'

/* Housekeeping (M9): a scheduler calls it daily with `Authorization: Bearer <CRON_SECRET>`; abandoned join drafts and old
   job-run rows are removed. The same pass sits behind the Run button on the Operations page. */

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ ...(await recordJobRun('housekeeping', () => housekeeping())), at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'POST with the cron secret' }, { status: 405 })
}
