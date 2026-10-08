import { RichText } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import type { ProseBlock } from '@/payload-types'

import { Sheet, SheetHead, type SheetMeta, bodyGap } from '@/components/k7/Sheet'

export const Prose: React.FC<ProseBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, richText }) => (
  <Sheet meta={meta} tabLabel={tabLabel}>
    {headline && <SheetHead headline={headline} dimClause={dimClause} lede={lede} />}
    <div style={headline ? bodyGap : undefined}>
      <RichText className="prose" data={richText} />
    </div>
  </Sheet>
)
