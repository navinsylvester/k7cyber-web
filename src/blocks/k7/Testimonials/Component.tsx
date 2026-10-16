import React from 'react'

import type { TestimonialsBlock } from '@/payload-types'

import { Sheet, SheetHead, type SheetMeta } from '@/components/k7/Sheet'
import { QuoteCarousel } from './Carousel.client'
import { Receiver } from './Receiver.client'

export const Testimonials: React.FC<TestimonialsBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, receiver, dwell, items }) => (
  <Sheet meta={meta} tabLabel={tabLabel} id="customers">
    <SheetHead headline={headline} dimClause={dimClause} lede={lede} />
    {receiver ? <Receiver items={items} dwell={dwell} /> : <QuoteCarousel items={items} />}
  </Sheet>
)
