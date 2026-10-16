'use client'
import React, { useEffect, useState } from 'react'

import type { TestimonialsBlock } from '@/payload-types'

/* Receiver (design-system/components/Receiver): the testimonials as stations on a band. The status line says what is being
   received, the transmission is the quote, the stations are printed on the scale, and its needle sweeps in steps toward the next
   station; when it arrives the quote is replaced with no transition and the pixel on its station blinks twice (is-stamp).
   Counted things step: the needle moves in STEPS jumps over the dwell, never eased. A negative testimonial is interference on the band: named on the status line, with K7's one-line reply under it.
   Hover or focus holds the band; a press tunes. Under prefers-reduced-motion nothing scans and the needle rests on the station. */
const STEPS = 24
const ch = (k: number) => String(k + 1).padStart(2, '0')

type Band = 'positive' | 'negative'
const onBand = (t: TestimonialsBlock['items'][number], band: Band) => (t.sentiment === 'negative' ? 'negative' : 'positive') === band

export const Receiver: React.FC<{ items: TestimonialsBlock['items']; dwell?: number | null }> = ({ items: all, dwell }) => {
  /* Two bands on one receiver: praise and complaints. The switch retunes to the first station of the band. Nobody shows the
     second band; we do, and every station on it carries our reply. */
  const [bandName, setBandName] = useState<Band>('positive')
  const items = all.filter((t) => onBand(t, bandName))
  const counts = { positive: all.filter((t) => onBand(t, 'positive')).length, negative: all.filter((t) => onBand(t, 'negative')).length }
  const n = items.length
  /* The band's state moves as one: the station, the needle's step toward the next, and the stamp count that restarts the blink. */
  const [band, setBand] = useState({ i: 0, step: 0, stamp: 0 })
  const { i, step, stamp } = band
  const [held, setHeld] = useState(false)
  const [still, setStill] = useState(true)

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () => setStill(m.matches)
    read()
    m.addEventListener('change', read)
    return () => m.removeEventListener('change', read)
  }, [])

  useEffect(() => {
    if (n < 2 || held || still) return
    const t = setInterval(
      () => setBand((b) => (b.step + 1 >= STEPS ? { i: (b.i + 1) % n, step: 0, stamp: b.stamp + 1 } : { ...b, step: b.step + 1 })),
      ((dwell || 10) * 1000) / STEPS,
    )
    return () => clearInterval(t)
  }, [n, held, still, dwell])

  const tune = (k: number) => setBand((b) => ({ i: k, step: 0, stamp: b.stamp + 1 }))
  const flip = (to: Band) => {
    if (to === bandName) return
    setBandName(to)
    setBand((b) => ({ i: 0, step: 0, stamp: b.stamp + 1 }))
  }

  const q = items[Math.min(i, Math.max(n - 1, 0))]
  const empty = bandName === 'negative' ? 'No interference on this band. Yet.' : 'Nothing on this band yet.'
  const pos = (k: number) => ((k + 0.5) / n) * 100
  const next = (i + 1) % n
  const needle = n < 2 ? 50 : pos(i) + (pos(next) - pos(i)) * (step / STEPS)

  return (
    <div className="rx" style={{ marginTop: 'clamp(40px, 5cqw, 72px)' }} onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
      <div className="rx-status">
        <span className={`fresh is-fresh${still || n < 2 ? '' : ' is-live'}`}>
          <i className="fresh-px" />
          <span className="label">{n > 1 && !still ? 'Receiving' : 'Received'}</span>
        </span>
        {n > 0 && (
          <span className="label muted">
            CH {ch(i)}/{ch(n - 1)}
          </span>
        )}
        {bandName === 'negative' && <span className="label label-acc">Interference</span>}
        {q?.company && <span className="label">{q.company}</span>}
        {q?.tag && <span className="tag">{q.tag}</span>}
        <div className="seg rx-band" role="group" aria-label="Band">
          <button type="button" aria-pressed={bandName === 'positive'} onClick={() => flip('positive')}>
            Praise {ch(counts.positive - 1)}
          </button>
          <button type="button" aria-pressed={bandName === 'negative'} onClick={() => flip('negative')}>
            Complaints {ch(counts.negative - 1)}
          </button>
        </div>
        {bandName === 'negative' && <span className="label muted rx-note">Nobody shows these. We do, and we answer every one.</span>}
      </div>
      {/* Every transmission is laid out in the same cell so the band keeps the tallest quote's height: an arrival moves nothing below it. */}
      <div className="rx-txs">
        {n === 0 && (
          <figure className="rx-tx is-on">
            <blockquote>{empty}</blockquote>
          </figure>
        )}
        {items.map((t, k) => (
          <figure className={k === i ? 'rx-tx is-on' : 'rx-tx'} key={t.id ?? k} aria-hidden={k !== i}>
            <blockquote>{t.quote}</blockquote>
            <figcaption className="byline">
              <span className="name">{t.name}</span>
              {t.company && <span className="body-s muted">{t.company}</span>}
            </figcaption>
            {t.sentiment === 'negative' && t.reply && (
              /* Our one line under a complaint: the K7 label and the reply as a block, our stamp on their words. */
              <p className="rx-reply">
                <span className="label label-acc">K7 · reply</span>
                <span className="term">{t.reply}</span>
              </p>
            )}
          </figure>
        ))}
      </div>
      {/* The scale: ticks, the needle, and the stations printed on the dial at their positions (a wrapped row under the ticks on a phone). */}
      <div className="rx-scale">
        <svg className="rx-ticks" aria-hidden="true">
          <defs>
            <pattern id="rx-tick" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M.5 4v16 M8.5 12v8 M16.5 12v8 M24.5 12v8 M32.5 12v8" stroke="currentColor" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="20" fill="url(#rx-tick)" />
        </svg>
        <i className="rx-needle" style={{ left: `${needle}%` }} aria-hidden="true" />
        {n > 1 && (
          <ol className="rx-stations" role="tablist" aria-label="Stations">
            {items.map((t, k) => (
              <li key={t.id ?? k} role="presentation" style={{ '--pos': `${pos(k)}%` } as React.CSSProperties}>
                <button type="button" role="tab" aria-selected={k === i} onClick={() => tune(k)}>
                  <span className="k">{ch(k)}</span>
                  <span className="st">{t.company || t.name}</span>
                  {k === i && <i className="pixel is-stamp" key={stamp} />}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
