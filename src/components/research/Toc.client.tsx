'use client'
import React, { useEffect } from 'react'

/* Article table of contents: marks the section in view. */
export const Toc: React.FC<{ items: { id: string; text: string }[] }> = ({ items }) => {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const links = new Map(items.map((i) => [i.id, document.querySelector<HTMLAnchorElement>(`.toc a[href="#${i.id}"]`)]))
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            links.forEach((a) => a?.classList.remove('is-active'))
            links.get(en.target.id)?.classList.add('is-active')
          }
        })
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )
    items.forEach((i) => {
      const el = document.getElementById(i.id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [items])
  if (!items.length) return null
  return (
    <details className="toc" open>
      <summary className="label">On this page</summary>
      <ol>
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`}>{i.text}</a>
          </li>
        ))}
      </ol>
    </details>
  )
}
