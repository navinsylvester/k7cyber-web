import React from 'react'

import type { CtaSheetBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { Sheet, type SheetMeta } from '@/components/k7/Sheet'

export const CtaSheet: React.FC<CtaSheetBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, paragraph, actions }) => (
  <Sheet meta={{ ...meta, ground: 'signal' }} tabLabel={tabLabel} id="next-step" className="cta-sheet">
    <div className="sheet-head">
      <h2 className="h-sheet">{headline}</h2>
      <p>{paragraph}</p>
    </div>
    <Actions items={actions} className="cta-actions" />
  </Sheet>
)
