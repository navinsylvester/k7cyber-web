import { NextResponse } from 'next/server'

import { getSettings } from '@/lib/support/kpi-config'
import { runSweep } from '@/lib/support/prevention'

/* The scheduled prevention sweep (09-portal-guide.md §4c). Called by a scheduler with `Authorization: Bearer <CRON_SECRET>`;
   runs as the service identity. `{ "live": true }` in the body asks for a live run, which still needs the settings switch on. */

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const settings = await getSettings()
  if (!settings.sweep.enabled) return NextResponse.json({ skipped: true, reason: 'sweep disabled in settings' })
  let live = false
  try {
    const body = (await req.json().catch(() => ({}))) as { live?: boolean }
    live = Boolean(body.live)
  } catch {
    /* no body */
  }
  try {
    const r = await runSweep({ kind: 'service' }, { actor: 'cron', live })
    return NextResponse.json({ ...r, at: r.at.toISOString() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'POST with the cron secret' }, { status: 405 })
}
