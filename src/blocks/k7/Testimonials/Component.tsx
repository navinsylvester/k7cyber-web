import React from 'react'

import type { TestimonialsBlock } from '@/payload-types'

import { Sheet, SheetHead, type SheetMeta } from '@/components/k7/Sheet'
import { QuoteCarousel } from './Carousel.client'

export const Testimonials: React.FC<TestimonialsBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, items }) => (
  <Sheet meta={meta} tabLabel={tabLabel} id="customers">
    <SheetHead headline={headline} dimClause={dimClause} lede={lede} />
    <QuoteCarousel items={items} />
  </Sheet>
)
