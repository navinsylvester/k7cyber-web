'use server'

import { redirect } from 'next/navigation'

import { housekeeping, recordJobRun } from '@/lib/partner/ops'
import { requireK7Role } from '@/lib/partner/session'

/* The Operations page's one lever: housekeeping by hand (the scheduler runs it daily through /api/partners/housekeeping). The
   other jobs have their Run buttons on their own pages. */

const PATH = '/partners/portal/k7/operations'

export async function runHousekeepingAction(): Promise<void> {
  const me = await requireK7Role(['channelManager'], PATH)
  try {
    const r = await recordJobRun('housekeeping', () => housekeeping(), { trigger: 'manual', actor: me.actor })
    redirect(`${PATH}?ok=${encodeURIComponent(`${r.drafts} abandoned draft${r.drafts === 1 ? '' : 's'} removed · ${r.jobRuns} old job run${r.jobRuns === 1 ? '' : 's'} removed${r.errors.length ? ` · ${r.errors.length} failed` : ''}`)}`)
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    redirect(`${PATH}?error=${encodeURIComponent(`Housekeeping failed: ${(e as Error).message.slice(0, 160)}`)}`)
  }
}
