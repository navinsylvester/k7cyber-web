'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'

export type HomeQuote = { channel: string; quote: string; name: string; role: string }

const ArrowL = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" aria-hidden="true">
    <path d="M20 12H6M11 6l-6 6 6 6" />
  </svg>
)
const ArrowR = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" aria-hidden="true">
    <path d="M4 12h14M13 6l6 6-6 6" />
  </svg>
)

/* 08 · Customers: a radio tuner. Each quote is a channel; the needle slides to the one playing. It changes channel every 6 s
   until someone touches it, and never on its own under reduced motion. Server-rendered on channel 1, so it reads without JS. */
export const Customers: React.FC<{ quotes: HomeQuote[]; note?: string }> = ({ quotes, note }) => {
  const n = quotes.length
  const [ch, setCh] = useState(0)
  const timer = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
  }, [])

  useEffect(() => {
    if (n < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    timer.current = window.setInterval(() => setCh((c) => (c + 1) % n), 6000)
    return stop
  }, [n, stop])

  const tune = (i: number) => {
    stop()
    setCh(((i % n) + n) % n)
  }

  if (!n) return null

  return (
    <>
      <div className="ss-car">
        <div className="ss-car-copy">
          <div>
            <div className="m-mono ss-kicker">08 · Customers</div>
            <h2 className="m-d ss-h2 ss-lines">
              <span>Don’t take our word.</span>
              <span className="m-out">Tune in to theirs.</span>
            </h2>
          </div>
          <div>
            <div className="ss-tuner" aria-hidden="true">
              <svg width="100%" height="72">
                <defs>
                  <pattern id="m-rf1" width="48" height="72" patternUnits="userSpaceOnUse">
                    <path d="M0 36q12 -56 24 0t24 0" fill="none" stroke="#F4F3F0" strokeWidth="2" />
                  </pattern>
                  <pattern id="m-rf2" width="96" height="72" patternUnits="userSpaceOnUse">
                    <path d="M0 36q24 -66 48 0t48 0" fill="none" stroke="#F4F3F0" strokeOpacity="0.35" strokeWidth="1.5" />
                  </pattern>
                  <pattern id="m-rf3" width="32" height="72" patternUnits="userSpaceOnUse">
                    <path d="M0 36q8 -28 16 0t16 0" fill="none" stroke="#EC6A23" strokeWidth="2.5" />
                  </pattern>
                </defs>
                <rect className="m-rfb" x="-200" y="0" width="4400" height="72" fill="url(#m-rf2)" />
                <rect className="m-rfa" x="-200" y="0" width="4400" height="72" fill="url(#m-rf1)" />
                <rect className="m-rfc" x="-200" y="0" width="4400" height="72" fill="url(#m-rf3)" />
              </svg>
              <div className="ss-scale" />
              <div className="m-needle" style={{ left: `${((2 * ch + 1) / (2 * n)) * 100}%` }} />
            </div>
            <div className="ss-channels" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
              {quotes.map((q, i) => (
                <button className="m-chb" type="button" key={i} aria-pressed={ch === i} onClick={() => tune(i)}>
                  CH {String(i + 1).padStart(2, '0')}
                  <br />
                  {q.channel}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="ss-car-panel">
          <div className="ss-car-bar">
            <span className="m-mono ss-rx">
              <span className="m-blink" aria-hidden="true" />
              Now receiving
            </span>
            {n > 1 && (
              <span className="ss-arrows">
                <button className="m-arrow" type="button" aria-label="Previous testimonial" onClick={() => tune(ch - 1)}>
                  <ArrowL />
                </button>
                <button className="m-arrow" type="button" aria-label="Next testimonial" onClick={() => tune(ch + 1)}>
                  <ArrowR />
                </button>
              </span>
            )}
          </div>
          <div className="ss-slides">
            {quotes.map((q, i) => (
              <figure className={`m-slide${i === ch ? ' is-on' : ''}`} key={i} aria-hidden={i !== ch}>
                <blockquote>{q.quote}</blockquote>
                <figcaption>
                  <span className="m-d">{q.name}</span>
                  <span className="m-mono">{q.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
      {note && <p className="m-mono ss-car-note">{note}</p>}
    </>
  )
}
