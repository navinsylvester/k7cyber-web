import { NextResponse } from 'next/server'

import { cronAuthorised } from '@/lib/cron-auth'
import { sweepCertificates } from '@/lib/partner/certificates'
import { recordJobRun } from '@/lib/partner/ops'

/* The certificate sweep (01-requirements.md FR-TRN-10, FR-CRT-05, 06; M11): a scheduler calls it daily with
   `Authorization: Bearer <CRON_SECRET>`; certificates past their date expire and their holders are told, the reminders go out
   once per threshold, passes that predate certificates get theirs, every organisation's certificate mirror is checked and the
   renewal request raised where the rule still holds. The same pass sits behind the Run button on the K7 certificates page. */

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ ...(await recordJobRun('certificatesSweep', () => sweepCertificates())), at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'POST with the cron secret' }, { status: 405 })
}
