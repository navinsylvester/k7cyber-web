import React from 'react'

import type { HomeHeroBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { withBold } from '@/components/k7/Sheet'

export const HomeHero: React.FC<HomeHeroBlock & { index: number; count: number }> = ({ metaLeft, liveLabel, line1, line2, line3, redactNote, lede, actions, log, index, count }) => {
  const words = line3.trim().replace(/[.!?]$/, '').split(' ')
  const last = words.pop() ?? ''
  const punct = /[.!?]$/.test(line3.trim()) ? line3.trim().slice(-1) : ''
  const entries = (log ?? []).map((l) => l.text)
  const strip = [...entries, ...entries].join('  ·  ')
  return (
    <section className="sheet g-paper hero-home" id="top">
      <svg className="pattern" aria-hidden="true">
        <defs>
          <pattern id="pt1" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M16 12v8M12 16h8" stroke="currentColor" strokeWidth="1" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pt1)" />
      </svg>
      <div className="hero-meta">
        <span className="label">
          {String(index).padStart(2, '0')}/{String(count).padStart(2, '0')} · {metaLeft}
        </span>
        {liveLabel && (
          <span className="label">
            <i className="pixel is-live" /> {liveLabel}
          </span>
        )}
      </div>
      <h1 className="stair">
        <span>{line1}</span>
        <span>{line2}</span>
        <span>
          {words.length > 0 && `${words.join(' ')} `}
          <span className="redact" tabIndex={0}>
            {last}
          </span>
          {punct}
        </span>
      </h1>
      {redactNote && <p className="redact-note label">{redactNote}</p>}
      <div className="hero-foot">
        <p className="lede">{withBold(lede)}</p>
        <Actions items={actions} />
      </div>
      {entries.length > 0 && (
        <div className="logstrip" aria-hidden="true">
          <span>{strip}&nbsp;&nbsp;·&nbsp;&nbsp;</span>
        </div>
      )}
    </section>
  )
}
