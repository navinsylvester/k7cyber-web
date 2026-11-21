import Link from 'next/link'
import React from 'react'

import { getCachedGlobal } from '@/utilities/getGlobals'
import { navHref } from '@/utilities/linkHref'

const Slash: React.FC = () => (
  <svg viewBox="0 0 48 73" aria-hidden="true">
    <polygon points="33.5,0 48,0 14.5,73 0,73" fill="#EC6A23" />
  </svg>
)

/* The homepage's footer: the artboard's (designs/home/Seventh-Sense-Landing.html) in place of SiteFooter, which layout.tsx leaves
   out on `/`. Its links are the Footer global's, the same ones SiteFooter shows elsewhere (Support, Research, the partner portal
   among them), one row per column; the socials and the legal line sit on the orange base. Styles: home.css (`ss-foot`). */
export async function HomeFooter() {
  const data = await getCachedGlobal('footer', 1)()
  const columns = (data?.columns ?? []).filter((c) => (c.links?.length ?? 0) > 0)

  return (
    <footer className="ss-foot">
      <div className="m-wrap">
        <div className="ss-foot-top">
          <img src="/logos/k7-cybersecurity-logo-white.svg" alt="K7 CyberSecurity" />
          <span className="m-mono">Beyond the obvious · Answerable to you</span>
        </div>
        {columns.map((col, i) => (
          <nav className="ss-foot-row" aria-labelledby={`ss-foot-${i}`} key={col.id ?? i}>
            <h2 className="m-d" id={`ss-foot-${i}`}>
              <Slash />
              {col.heading}
            </h2>
            <ul className="ss-foot-links">
              {(col.links ?? []).map((l, j) => (
                <li key={l.id ?? j}>
                  <Link href={navHref(l)}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="m-d ss-foot-mark" aria-hidden="true">
        <span className="m-out">Seventh</span>
        <Slash />
        <span className="m-out">Sense</span>
      </div>
      <div className="ss-foot-base">
        <div className="m-wrap m-mono">
          <span>{data?.legal}</span>
          <nav aria-label="Elsewhere">
            {(data?.socials ?? []).map((s, i) => (
              <a href={s.url} key={s.id ?? i} rel="noopener noreferrer" target="_blank">
                {s.name}
              </a>
            ))}
            <a href="#top">Back to top ↑</a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
