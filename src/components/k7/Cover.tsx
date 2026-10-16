import React from 'react'

import { Icon, type IconName } from '@/components/k7/Icon'

export type CoverData = { brand?: string | null; series?: string | null; period?: string | null; year?: string | null; footLeft?: string | null; footRight?: string | null } | null | undefined

/* ReportCover (design-system/components/ReportCover): a drawn cover, 3:4 on ink, its brand on the tab with one glyph, the series,
   the period in the counting width with the signal pixel, and the foot. The record sheet's report and the Why K7 panel's charter. */
export const Cover: React.FC<{ c: CoverData; icon?: IconName | string | null }> = ({ c, icon = 'archive' }) => (
  <div className="cover" style={{ alignSelf: 'start', maxWidth: 260 }}>
    <div className="ftab label">
      <Icon name={icon || 'archive'} className="licon" />
      {c?.brand}
    </div>
    <div className="cover-body">
      <div className="cover-series">{c?.series}</div>
      <div className="cover-period">
        <span className="yr">{c?.period}</span>
        {c?.year}
        <span className="sig" />
      </div>
      <div className="cover-foot">
        <span>{c?.footLeft}</span>
        <span>{c?.footRight}</span>
      </div>
    </div>
  </div>
)
