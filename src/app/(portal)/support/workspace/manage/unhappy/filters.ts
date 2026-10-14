import { followUpState } from '@/lib/support/csat'
import { causeOf, unhappyRows, type CsatRow } from '@/lib/support/csat-model'
import type { Settings } from '@/lib/support/kpi-model'
import { productFamily } from '@/lib/support/reference'

/* The unhappy-customers ledger's filters, shared by the page and its CSV export (09-portal-guide.md §4e). Every row is a low score;
   the filters narrow by what it was about, the product family, the engineer, the follow-up and free text. */

export type UnhappySP = { period?: string; area?: string; reason?: string; product?: string; owner?: string; fu?: string; q?: string; page?: string; ok?: string; error?: string }

/** The family a row's product folds to, as the matrix keys it. */
export const familyKey = (product: string): string => (product ? (productFamily(product) || product).toLowerCase() : 'no product on the case')

export const filterUnhappy = (rows: CsatRow[], sp: UnhappySP, settings: Settings, now: Date): CsatRow[] =>
  unhappyRows(rows, settings.csat).filter((r) => {
    const cause = causeOf(r)
    if (sp.area && (cause.area || 'none') !== sp.area) return false
    if (sp.reason && cause.key !== sp.reason) return false
    if (sp.product && familyKey(r.product) !== sp.product.toLowerCase()) return false
    if (sp.owner && r.ownerId !== sp.owner) return false
    if (sp.fu) {
      const f = followUpState(r, settings, now)
      if (sp.fu === 'open' && !(r.followUp === 'pending' || r.followUp === 'in-progress')) return false
      if (sp.fu === 'overdue' && f.state !== 'overdue') return false
      if (sp.fu === 'done' && r.followUp !== 'done') return false
    }
    if (sp.q) {
      const needle = sp.q.toLowerCase()
      if (![r.ticket, r.title, r.customerName, r.comment, r.email, r.product, r.followUpNote].some((x) => x.toLowerCase().includes(needle))) return false
    }
    return true
  })
