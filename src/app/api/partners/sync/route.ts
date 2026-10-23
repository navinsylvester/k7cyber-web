import { NextResponse } from 'next/server'

import { syncDeals } from '@/lib/partner/sync'

/* The dashboard read-back (01-requirements.md FR-DASH-05, 02-build-plan.md decision 14): a scheduler calls it with
   `Authorization: Bearer <CRON_SECRET>`, every 15 minutes or every hour as it likes; the run happens only when
   `partner-settings.crm.syncMinutes` have passed since the last one, unless the body says `{ "force": true }`. The same sync sits
   behind "Sync now" on the K7 deals pages. Reads only; the browser never meets the CRM (FR-DASH-04). */

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let force = false
  try {
    const body = (await req.json().catch(() => ({}))) as { force?: boolean }
    force = body.force === true
  } catch {
    /* no body */
  }
  try {
    const r = await syncDeals({ trigger: 'cron', force })
    return NextResponse.json(r, { status: r.ran || r.skipped ? 200 : 500 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'POST with the cron secret' }, { status: 405 })
}
