import React from 'react'

import type { PublicationRowsBlock } from '@/payload-types'

import { Icon } from '@/components/k7/Icon'
import { Sheet, SheetHead, type SheetMeta, bodyGap } from '@/components/k7/Sheet'

export const PublicationRows: React.FC<PublicationRowsBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, rows }) => (
  <Sheet meta={meta} tabLabel={tabLabel} id="insight">
    <SheetHead headline={headline} dimClause={dimClause} lede={lede} />
    <div className="ilist pub-list" style={bodyGap}>
      {rows.map((r, i) => (
        <a className="irow" href={r.url} key={r.id ?? i} rel={r.url.startsWith('http') ? 'noopener noreferrer' : undefined} target={r.url.startsWith('http') ? '_blank' : undefined}>
          <Icon name={r.icon} />
          <span className="irow-title">{r.title}</span>
          <span className="desc">{r.source}</span>
          <span className="when label">{r.kind}</span>
          <span className="arrow">→</span>
        </a>
      ))}
    </div>
  </Sheet>
)
