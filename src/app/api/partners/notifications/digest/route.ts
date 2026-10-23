import { NextResponse } from 'next/server'

import { cronAuthorised } from '@/lib/cron-auth'
import { digestPass } from '@/lib/partner/notify'
import { recordJobRun } from '@/lib/partner/ops'

/* The daily digest and the bell's retention (FR-NTF-01, M8): a scheduler calls it once a day with
   `Authorization: Bearer <CRON_SECRET>`; every bell row whose template says "digest" goes out in one email per person, and
   read rows older than `partner-settings.notify.bellRetentionDays` are removed. The same pass sits behind the Run button on
   the templates page. */

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ ...(await recordJobRun('digest', () => digestPass())), at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'POST with the cron secret' }, { status: 405 })
}
