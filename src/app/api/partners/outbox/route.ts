import { NextResponse } from 'next/server'

import { cronAuthorised } from '@/lib/cron-auth'
import { drainOutbox } from '@/lib/partner/mirror'
import { recordJobRun } from '@/lib/partner/ops'

/* The CRM outbox drain (02-build-plan.md decision 2, §4): a scheduler calls it with `Authorization: Bearer <CRON_SECRET>` and the
   pending, failed and skipped jobs run as the service identity, when the partner settings have the mirror on. The same drain
   sits behind the Run button on the K7 applications page. */

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let limit = 25
  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number }
    if (typeof body.limit === 'number' && body.limit > 0) limit = Math.min(200, Math.round(body.limit))
  } catch {
    /* no body */
  }
  try {
    return NextResponse.json({ ...(await recordJobRun('outbox', () => drainOutbox(limit))), at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'POST with the cron secret' }, { status: 405 })
}
