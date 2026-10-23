import { NextResponse } from 'next/server'

import { sweepSla } from '@/lib/partner/sla'

/* The approval SLA pass (FR-NTF-01 "Approval SLA breached", M8): a scheduler calls it hourly with
   `Authorization: Bearer <CRON_SECRET>`; every deal or application that has waited past the target in working hours gets one
   breach notice to the queue's approvers, their managers and the escalation addresses. The same pass sits behind the Run
   button on the K7 reports page. */

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ ...(await sweepSla()), at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'POST with the cron secret' }, { status: 405 })
}
