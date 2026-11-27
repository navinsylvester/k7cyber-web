import { NextResponse } from 'next/server'

import { cronAuthorised } from '@/lib/cron-auth'
import { runWatch } from '@/lib/support/watch'

/* The notification watch (09-portal-guide.md §4g). Called every minute by a scheduler with `Authorization: Bearer <CRON_SECRET>`;
   runs as the service identity. It writes only the portal's own rows and mail: never Dynamics. */

export const dynamic = 'force-dynamic'

// One pass at a time per process: a slow Dataverse must not stack minute after minute.
let running: Promise<unknown> | null = null

export async function POST(req: Request): Promise<Response> {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (running) return NextResponse.json({ skipped: true, reason: 'a pass is still running' })
  try {
    const p = runWatch({ kind: 'service' })
    running = p
    return NextResponse.json(await p)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  } finally {
    running = null
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'POST with the cron secret' }, { status: 405 })
}
