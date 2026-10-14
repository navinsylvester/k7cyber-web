import type { CsatRow } from '@/lib/support/csat-model'
import type { Settings } from '@/lib/support/kpi-model'
import { followUpState } from '@/lib/support/csat'

/* The CSAT ledger's filters, shared by the page and its CSV export. */

export type CsatSP = { period?: string; score?: string; owner?: string; fu?: string; source?: string; by?: string; page?: string; ok?: string; error?: string; q?: string }

export const filterCsat = (rows: CsatRow[], sp: CsatSP, settings: Settings, now: Date): CsatRow[] =>
  rows.filter((r) => {
    if (r.status !== 'responded' || r.score === null) return false
    if (sp.score === 'low' && r.score > settings.csat.unhappyAtOrBelow) return false
    if (sp.score === 'mid' && (r.score <= settings.csat.unhappyAtOrBelow || r.score >= settings.csat.satisfiedFrom)) return false
    if (sp.score === 'high' && r.score < settings.csat.satisfiedFrom) return false
    if (/^[1-5]$/.test(sp.score ?? '') && r.score !== Number(sp.score)) return false
    if (sp.owner && r.ownerId !== sp.owner) return false
    if (sp.source && r.source !== sp.source) return false
    if (sp.fu) {
      const f = followUpState(r, settings, now)
      if (sp.fu === 'open' && !(r.followUp === 'pending' || r.followUp === 'in-progress')) return false
      if (sp.fu === 'overdue' && f.state !== 'overdue') return false
      if (sp.fu === 'done' && r.followUp !== 'done') return false
      if (sp.fu === 'none' && r.followUp !== 'none') return false
    }
    if (sp.q) {
      const needle = sp.q.toLowerCase()
      if (![r.ticket, r.title, r.customerName, r.comment, r.email].some((x) => x.toLowerCase().includes(needle))) return false
    }
    return true
  })
