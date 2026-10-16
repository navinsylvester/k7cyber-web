import React from 'react'

import type { HomeHeroBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { withBold } from '@/components/k7/Sheet'

type Layer = NonNullable<HomeHeroBlock['figure']>[number]

/* The stack (Hero): three tab-shaped plates, sensor at the foot, the platform on it, the agentic SOC on top, joined by
   two upward arrows. One signal pixel climbs the chain in steps; under prefers-reduced-motion it rests on the top plate.
   Plates are filled with the ground so the registration pattern stays outside them. */
const RUN = 0.4557 // seven-run: the tab's right edge descends to the left at 24.5°
const plate = (x: number, y: number, w: number, h: number) => `M${x} ${y}H${x + w}L${(x + w - h * RUN).toFixed(1)} ${y + h}H${x}Z`

const Stack: React.FC<{ layers: Layer[] }> = ({ layers }) => {
  const [sensor, platform, soc] = layers
  const H = 88
  const tops = [288, 164, 40] // sensor, platform, soc
  const widths = [480, 480, 400]
  const rows = [sensor, platform, soc]
  return (
    <figure className="hero-fig" aria-label={`${sensor?.label}, ${platform?.label}, ${soc?.label}: the sensor feeds the platform, the agentic SOC sits on top`}>
      <svg className="stack" viewBox="0 0 560 400" role="img" aria-hidden="true">
        {rows.map((r, i) =>
          r ? (
            <g key={i}>
              <path className="plate" d={plate(40, tops[i]!, widths[i]!, H)} />
              <text className="lbl" x="96" y={tops[i]! + 28}>
                {r.label}
              </text>
              <text className="val" x="96" y={tops[i]! + 56}>
                {r.value}
              </text>
              {r.note && (
                <text className="lbl mu" x="96" y={tops[i]! + 76}>
                  {r.note}
                </text>
              )}
            </g>
          ) : null,
        )}
        {/* the two arrows up the chain */}
        <path className="line" d="M68 288V258M60 266l8-8 8 8" />
        <path className="line" d="M68 164V134M60 142l8-8 8 8" />
        {/* the one pixel, climbing */}
        <rect className="px climb" x="64" y="328" width="8" height="8" />
        <text className="lbl mu" x="520" y="396" textAnchor="end">
          Fig. 01 · Sensor → Platform → Agentic SOC
        </text>
      </svg>
    </figure>
  )
}

export const HomeHero: React.FC<HomeHeroBlock & { index: number; count: number }> = ({ metaLeft, liveLabel, line1, line2, line3, lede, actions, figure, log, index, count }) => {
  const entries = (log ?? []).map((l) => l.text)
  const strip = [...entries, ...entries].join('  ·  ')
  const layers = (figure ?? []).slice(0, 3)
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
      <div className="hero-body">
        <div className="hero-copy">
          <h1 className="h-hero">
            <span>{line1}</span>
            <span>{line2}</span>
            <span>{line3}</span>
          </h1>
          <p className="lede">{withBold(lede)}</p>
          <Actions items={actions} />
        </div>
        {layers.length === 3 && <Stack layers={layers} />}
      </div>
      {entries.length > 0 && (
        <div className="logstrip" aria-hidden="true">
          <span>{strip}&nbsp;&nbsp;·&nbsp;&nbsp;</span>
        </div>
      )}
    </section>
  )
}
