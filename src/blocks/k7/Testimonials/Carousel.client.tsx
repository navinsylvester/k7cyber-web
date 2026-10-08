'use client'
import React, { useState } from 'react'

import type { TestimonialsBlock } from '@/payload-types'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

export const QuoteCarousel: React.FC<{ items: TestimonialsBlock['items'] }> = ({ items }) => {
  const [i, setI] = useState(0)
  const q = items[Math.min(i, items.length - 1)]!
  return (
    <>
      <figure className="quote" style={{ margin: 'clamp(40px, 5cqw, 72px) 0 0' }}>
        <div className="quote-side">
          <span className="avatar avatar-l">{initials(q.name)}</span>
          <div className="byline">
            <div>
              <div className="name">{q.name}</div>
              {q.company && <div className="body-s muted">{q.company}</div>}
            </div>
          </div>
          {q.tag && <span className="tag">{q.tag}</span>}
        </div>
        <blockquote>{q.quote}</blockquote>
      </figure>
      {items.length > 1 && (
        <div className="carousel-dots" role="tablist">
          {items.map((t, j) => (
            <button key={t.id ?? j} type="button" aria-current={j === i ? 'true' : undefined} aria-label={`Testimonial ${j + 1}`} onClick={() => setI(j)} />
          ))}
        </div>
      )}
    </>
  )
}
