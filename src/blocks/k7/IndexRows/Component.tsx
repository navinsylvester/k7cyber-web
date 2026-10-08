import Link from 'next/link'
import React from 'react'

import type { IndexRowsBlock } from '@/payload-types'

import { Sheet, SheetHead, type SheetMeta, bodyGap } from '@/components/k7/Sheet'
import { linkHref } from '@/utilities/linkHref'

export const IndexRows: React.FC<IndexRowsBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, numbered, pattern, arrow, rows }) => (
  <Sheet meta={meta} tabLabel={tabLabel} id={tabLabel?.toLowerCase().replace(/\W+/g, '-')} className={pattern ? 'has-pattern' : undefined}>
    {pattern && (
      <svg aria-hidden="true" className="sheet-pattern">
        <defs>
          <pattern id="pt2" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M14 0L6 20" stroke="currentColor" strokeWidth="1" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pt2)" />
      </svg>
    )}
    <SheetHead headline={headline} dimClause={dimClause} lede={lede} />
    <div className="ilist" style={bodyGap}>
      {rows.map((r, i) => (
        <Link className="irow irow-grid" href={linkHref(r.link)} key={r.id ?? i}>
          {numbered && <span className="n">{String(i + 1).padStart(2, '0')}</span>}
          <span className="irow-title">{r.title}</span>
          <span className="desc">{r.description}</span>
          <span className="arrow">{arrow || '→'}</span>
        </Link>
      ))}
    </div>
  </Sheet>
)
