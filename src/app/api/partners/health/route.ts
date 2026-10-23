import { NextResponse } from 'next/server'

import { health } from '@/lib/partner/ops'

/* The monitor's question (M9, docs/partner-portal/05-staging-and-go-live.md §4): 200 when the database answers and no
   readiness check fails, 503 otherwise, with the failing checks by key and nothing else: no secret, no configuration. */

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const h = await health()
  return NextResponse.json(h, { status: h.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
