'use server'

import { redirect } from 'next/navigation'

import { requireK7Role } from '@/lib/partner/session'
import { sweepSla } from '@/lib/partner/sla'

/* The reports page's one lever: the approval SLA pass by hand (the scheduler runs it hourly through /api/partners/sla/sweep). */

const PATH = '/partners/portal/k7/reports'

export async function sweepSlaAction(form: FormData): Promise<void> {
  await requireK7Role(['channelManager', 'dealDeskApprover'], PATH)
  const period = String(form.get('period') ?? '')
  const q = period ? `&period=${encodeURIComponent(period)}` : ''
  try {
    const r = await sweepSla()
    redirect(`${PATH}?ok=${encodeURIComponent(`${r.checked} on the clock · ${r.breached} past the target · ${r.noticed.length} notice${r.noticed.length === 1 ? '' : 's'} sent${r.errors.length ? ` · ${r.errors.length} failed` : ''}`)}${q}`)
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    redirect(`${PATH}?error=${encodeURIComponent(`The SLA pass failed: ${(e as Error).message.slice(0, 160)}`)}${q}`)
  }
}
