import { NextResponse } from 'next/server'

import { digestPass } from '@/lib/partner/notify'

/* The daily digest and the bell's retention (FR-NTF-01, M8): a scheduler calls it once a day with
   `Authorization: Bearer <CRON_SECRET>`; every bell row whose template says "digest" goes out in one email per person, and
   read rows older than `partner-settings.notify.bellRetentionDays` are removed. The same pass sits behind the Run button on
   the templates page. */

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ ...(await digestPass()), at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'POST with the cron secret' }, { status: 405 })
}
