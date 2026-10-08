import React from 'react'

import type { Media } from '@/payload-types'

/* L6 · Series cover: one HTML cover for every Cyber Threat Monitor issue, drawn from the period. */
export const Cover: React.FC<{ period: string; range?: string | null; series?: string | null; image?: Media | number | null; className?: string }> = ({ period, range, series, image, className = '' }) => {
  const url = image && typeof image === 'object' ? (image.sizes?.medium?.url ?? image.url) : null
  if (url) {
    return (
      <figure className={`ph ${className}`} style={{ '--ar': '3/4' } as React.CSSProperties}>
        <img src={url} alt={`Cover: ${series ?? 'Report'}, ${period}`} />
      </figure>
    )
  }
  const [a, b] = period.split(' ')
  const annual = /^annual$/i.test(a ?? '')
  return (
    <div className={`cover ${className}`} role="img" aria-label={`Cover: ${series ?? 'Cyber Threat Monitor'}, ${period}`}>
      <div>
        <div className="cover-top">
          <svg viewBox="0 0 22 22" aria-hidden="true">
            <path d="M0 0h15l7 7v15H0z" fill="#FF4521" />
          </svg>
          K7 Labs
        </div>
        <div className="cover-series">{series?.replace(/ Report$/, '') ?? 'Cyber Threat Monitor'}</div>
      </div>
      <div className="cover-period">
        {annual ? (
          <>
            {b}
            <span className="sig" />
            <span className="yr" style={{ fontSize: '.38em', letterSpacing: '-.02em', marginTop: '.12em' }}>
              {a}
            </span>
          </>
        ) : (
          <>
            {a}
            <span className="yr">
              {b}
              <span className="sig" />
            </span>
          </>
        )}
      </div>
      <div className="cover-foot">
        <span>{range}</span>
        <span>Report</span>
      </div>
    </div>
  )
}
