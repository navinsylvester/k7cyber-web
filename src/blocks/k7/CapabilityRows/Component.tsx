import React from 'react'

import type { CapabilityRowsBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { Icon } from '@/components/k7/Icon'
import { Sheet, SheetHead, type SheetMeta, bodyGap, withBold } from '@/components/k7/Sheet'

export const CapabilityRows: React.FC<CapabilityRowsBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, rows, actions }) => (
  <Sheet meta={meta} tabLabel={tabLabel} id={tabLabel?.toLowerCase().replace(/\W+/g, '-')}>
    <SheetHead headline={headline} dimClause={dimClause} lede={lede} />
    <div className="cap-list" style={bodyGap}>
      {rows.map((r, i) => (
        <div key={r.id ?? i}>
          <Icon name={r.icon} />
          <div>
            <h3>{r.title}</h3>
            <p>{withBold(r.text)}</p>
          </div>
        </div>
      ))}
    </div>
    <Actions items={actions} style={{ marginTop: 32 }} />
  </Sheet>
)
