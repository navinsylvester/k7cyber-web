import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { CapabilityRows } from '@/blocks/k7/CapabilityRows/Component'
import { ComparisonTable } from '@/blocks/k7/ComparisonTable/Component'
import { CtaSheet } from '@/blocks/k7/CtaSheet/Component'
import { FeatureMatrix } from '@/blocks/k7/FeatureMatrix/Component'
import { FeaturePanels } from '@/blocks/k7/FeaturePanels/Component'
import { FormSheet } from '@/blocks/k7/FormSheet/Component'
import { HomeHero } from '@/blocks/k7/HomeHero/Component'
import { IndexRows } from '@/blocks/k7/IndexRows/Component'
import { Intro } from '@/blocks/k7/Intro/Component'
import { Locations } from '@/blocks/k7/Locations/Component'
import { ModuleGrid } from '@/blocks/k7/ModuleGrid/Component'
import { PageBanner } from '@/blocks/k7/PageBanner/Component'
import { PanelGrid } from '@/blocks/k7/PanelGrid/Component'
import { Prose } from '@/blocks/k7/Prose/Component'
import { PublicationRows } from '@/blocks/k7/PublicationRows/Component'
import { Testimonials } from '@/blocks/k7/Testimonials/Component'
import type { Ground, SheetMeta } from '@/components/k7/Sheet'

type Block = Page['layout'][number]

/* Every block is one sheet. The banner is sheet 01 on paper without a tab; the rest raise tabs that step from the
   right edge (k = 1) to the left (k = 0), and a sheet never sits on the ground of the sheet above it. */
type Placed = { block: Block; meta: SheetMeta | null }

/* Pure pre-pass: give every sheet its number, its tab position and its ground before rendering. */
const placeSheets = (blocks: Block[]): Placed[] => {
  const count = blocks.length
  const isBanner = (b: Block) => b.blockType === 'pageBanner' || b.blockType === 'homeHero'
  const tabbed = blocks.filter((b) => !isBanner(b)).length
  const placed: Placed[] = []
  let prev: Ground = 'paper'
  let tabIndex = 0

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    if (isBanner(block)) {
      prev = 'paper'
      placed.push({ block, meta: null })
      continue
    }
    const wanted = 'ground' in block ? block.ground : undefined
    let ground: Ground =
      block.blockType === 'ctaSheet' ? 'signal' : wanted && wanted !== 'auto' ? wanted : prev === 'paper' ? 'panel' : 'paper'
    if (ground === prev) ground = ground === 'paper' ? 'panel' : 'paper'
    prev = ground
    tabIndex += 1
    placed.push({ block, meta: { index: i + 1, count, k: tabbed > 1 ? 1 - (tabIndex - 1) / (tabbed - 1) : 1, ground } })
  }
  return placed
}

export const RenderBlocks: React.FC<{ blocks: Block[]; pageTitle: string }> = ({ blocks, pageTitle }) => {
  if (!blocks?.length) return null
  // A compact banner has no title, so the first sheet headline becomes the page's H1.
  const hasH1 = blocks.some((b) => b.blockType === 'homeHero' || (b.blockType === 'pageBanner' && !b.compact))

  return (
    <Fragment>
      {placeSheets(blocks).map(({ block, meta }, i) => {
        const key = block.id ?? i
        if (block.blockType === 'pageBanner') return <PageBanner key={key} {...block} pageTitle={pageTitle} />
        if (block.blockType === 'homeHero') return <HomeHero key={key} {...block} index={i + 1} count={blocks.length} />
        if (!meta) return null
        switch (block.blockType) {
          case 'intro':
            return <Intro key={key} {...block} meta={meta} />
          case 'capabilityRows':
            return <CapabilityRows key={key} {...block} meta={meta} />
          case 'featureMatrix':
            return <FeatureMatrix key={key} {...block} meta={meta} />
          case 'indexRows':
            return <IndexRows key={key} {...block} meta={meta} />
          case 'prose':
            return <Prose key={key} {...block} meta={meta} />
          case 'ctaSheet':
            return <CtaSheet key={key} {...block} meta={meta} />
          case 'moduleGrid':
            return <ModuleGrid key={key} {...block} meta={meta} />
          case 'featurePanels':
            return <FeaturePanels key={key} {...block} meta={meta} />
          case 'panelGrid':
            return <PanelGrid key={key} {...block} meta={meta} />
          case 'comparisonTable':
            return <ComparisonTable key={key} {...block} meta={meta} />
          case 'publicationRows':
            return <PublicationRows key={key} {...block} meta={meta} />
          case 'testimonials':
            return <Testimonials key={key} {...block} meta={meta} />
          case 'locations':
            return <Locations key={key} {...block} meta={meta} />
          case 'formSheet':
            return <FormSheet key={key} {...block} meta={meta} as={hasH1 ? 'h2' : 'h1'} />
          default:
            return null
        }
      })}
    </Fragment>
  )
}
