import { NextResponse } from 'next/server'

import { isGuid } from '@/lib/dataverse/odata'
import { getCities } from '@/lib/support/reference'
import { tryAgent } from '@/lib/support/session'

/* Cities of a state for the GeoPicker (components/support/CasePickers.client). Agents only; cached per state for an hour. */
export async function GET(req: Request): Promise<Response> {
  const me = await tryAgent()
  if (!me) return NextResponse.json({ error: 'Sign in as an agent.' }, { status: 401 })
  const state = new URL(req.url).searchParams.get('state') ?? ''
  if (!isGuid(state)) return NextResponse.json({ error: 'state must be a GUID' }, { status: 400 })
  try {
    const cities = await getCities(me.auth, state)
    return NextResponse.json(cities.map((c) => ({ id: c.id, name: c.name })), { headers: { 'Cache-Control': 'private, max-age=600' } })
  } catch {
    return NextResponse.json({ error: 'Could not read cities.' }, { status: 502 })
  }
}
