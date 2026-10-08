import React from 'react'

import type { PageBannerBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'

/* PageBanner: meta line, the H1 in h-page flush left, beside it the lede and up to two actions. Always on paper. */
export const PageBanner: React.FC<PageBannerBlock & { pageTitle: string }> = ({ metaLeft, metaRight, title, lede, actions, pageTitle }) => (
  <section className="sheet g-paper hero-u" id="top">
    {(metaLeft || metaRight) && (
      <div className="hero-meta">
        <span className="label">{metaLeft}</span>
        <span className="label">{metaRight}</span>
      </div>
    )}
    <div className="hero-grid">
      <h1 className="h-page">{title || pageTitle}</h1>
      <div className="hero-side">
        <p className="lede">{lede}</p>
        <Actions items={actions} />
      </div>
    </div>
  </section>
)
