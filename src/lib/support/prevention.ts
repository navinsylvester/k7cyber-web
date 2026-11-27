import 'server-only'

import type { DataverseAuth } from '@/lib/dataverse'

import { csatSweep, type CsatSweepResult } from './csat'
import { getSettings } from './kpi-config'
import { atRiskBoard, loadDesk } from './metrics'

/* The scheduled sweep (POST /api/support/sla/sweep, 09-portal-guide.md §4d): the CSAT pass, surveys for the period's resolved
   cases, one reminder, the overdue follow-ups. Until 2026-11-27 it also ran fixed prevention rules (stale, waiting, nudge…);
   those gave way to the SLA and KPI notifications of the watch (watch.ts, §4g), which run on the configured targets alone.
   The rules' history stays in `support-sla-events`. */

export type SweepResult = { runId: string; mode: 'dry-run' | 'live'; at: Date; warnings: string[]; csat: CsatSweepResult | null }

export const runSweep = async (auth: DataverseAuth, o: { actor: string; live?: boolean }): Promise<SweepResult> => {
  const settings = await getSettings()
  const desk = await loadDesk(auth, settings, '7d')
  const live = Boolean(o.live) && settings.sweep.live
  const runId = `${desk.now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`
  const result: SweepResult = { runId, mode: live ? 'live' : 'dry-run', at: desk.now, warnings: [...desk.warnings], csat: null }
  if (settings.csat.enabled) {
    try {
      result.csat = await csatSweep(desk, { live, settings })
      result.warnings.push(...result.csat.notes)
    } catch (e) {
      result.warnings.push(`CSAT pass failed: ${(e as Error).message}`)
    }
  }
  return result
}

export { atRiskBoard }
