import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { FormBlock } from '@/blocks/Form/Component'
import { CapabilityRows } from '@/blocks/k7/CapabilityRows/Component'
import { CtaSheet } from '@/blocks/k7/CtaSheet/Component'
import { FeatureMatrix } from '@/blocks/k7/FeatureMatrix/Component'
import { IndexRows } from '@/blocks/k7/IndexRows/Component'
import { Intro } from '@/blocks/k7/Intro/Component'
import { PageBanner } from '@/blocks/k7/PageBanner/Component'
import { Prose } from '@/blocks/k7/Prose/Component'
import type { Ground, SheetMeta } from '@/components/k7/Sheet'

type Block = Page['layout'][number]

/* Every block is one sheet. The banner is sheet 01 on paper without a tab; the rest raise tabs that step from the
   right edge (k = 1) to the left (k = 0), and a sheet never sits on the ground of the sheet above it. */
type Placed = { block: Block; meta: SheetMeta | null }

/* Pure pre-pass: give every sheet its number, its tab position and its ground before rendering. */
const placeSheets = (blocks: Block[]): Placed[] => {
  const count = blocks.length
  const tabbed = blocks.filter((b) => b.blockType !== 'pageBanner').length
  const placed: Placed[] = []
  let prev: Ground = 'paper'
  let tabIndex = 0

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    if (block.blockType === 'pageBanner') {
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

  return (
    <Fragment>
      {placeSheets(blocks).map(({ block, meta }, i) => {
        const key = block.id ?? i
        if (block.blockType === 'pageBanner' || !meta) {
          return block.blockType === 'pageBanner' ? <PageBanner key={key} {...block} pageTitle={pageTitle} /> : null
        }
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
          case 'formBlock':
            // The Form template's K7 skin is still to come; the template's form renders inside a plain sheet for now.
            return (
              <section className={`sheet g-${meta.ground}`} key={key}>
                <FormBlock {...(block as unknown as React.ComponentProps<typeof FormBlock>)} />
              </section>
            )
          default:
            return null
        }
      })}
    </Fragment>
  )
}
