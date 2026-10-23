import type { Metadata } from 'next'
import React from 'react'

import { Empty } from '@/components/partner/Parts'
import { SchemeLedger } from '@/components/partner/Schemes'
import { PARTNER_SCHEMES, schemesFor } from '@/lib/partner/schemes'
import { groupSchemes } from '@/lib/partner/schemes-model'
import { requirePartner } from '@/lib/partner/session'

export const metadata: Metadata = { title: 'Schemes' }

/* The schemes a partner may see (01-requirements.md §9.1, FR-SCH-02): the published ones that apply to the organisation's type
   and regions, in three groups: open for registration, running, closed; each with the organisation's standing. Every user of
   the organisation reads it; the Partner Admin registers. */
export default async function SchemesPage() {
  const me = await requirePartner(PARTNER_SCHEMES)
  const rows = await schemesFor(me)
  const groups = groupSchemes(rows)
  const open = rows.filter((r) => r.group === 'open' && (!r.registration || r.registration.status === 'declined')).length
  const results = rows.filter((r) => r.result).length
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">{me.org.tradeName || me.org.name} · schemes</span>
          <h1 className="h-util">Incentive schemes.</h1>
          <p className="lede">K7’s schemes for your partner type and regions. Register while a scheme is open, follow your progress while it runs, and check your result once K7 publishes it. Progress and results count the deals K7’s CRM says you won inside the scheme’s dates.</p>
        </div>
        <div className="ws-actions">
          <span className="hint">
            {String(rows.length).padStart(2, '0')} scheme{rows.length === 1 ? '' : 's'} for your organisation{open ? ` · ${String(open).padStart(2, '0')} open to register` : ''}{results ? ` · ${String(results).padStart(2, '0')} result${results === 1 ? '' : 's'} published` : ''}
          </span>
        </div>
      </div>
      {groups.length === 0 ? <Empty label="Schemes">No scheme applies to your organisation right now. K7 publishes schemes here as the programme opens; you will be told when one does.</Empty> : <SchemeLedger groups={groups} href={(sc) => `${PARTNER_SCHEMES}/${sc.id}`} />}
    </section>
  )
}
