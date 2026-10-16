import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import { Icon, socialGlyph } from '@/components/k7/Icon'
import { navHref } from '@/utilities/linkHref'

const pad = (n: number) => String(n).padStart(2, '0')
/* The print date, DD-MM-YYYY as the tables set dates: the build's date on a static page. */
const printed = () => {
  const d = new Date()
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

/* SiteFooter (design-system/components/SiteFooter): the back of the file. The End-of-file tab rises into the sheet above, the
   columns are numbered indexes on hairlines, the type-set wordmark closes the page at the width of the sheet, and the base line
   carries the legal, the offices and the print stamp. */
export async function Footer() {
  const data = await getCachedGlobal('footer', 1)()
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer g-contrast">
      <div className="sheet-tab" style={{ '--k': 0 } as React.CSSProperties}>
        <span>
          <i className="pixel" />
          <span className="label">End of file</span>
        </span>
        <span className="label">{year}</span>
      </div>
      <div className="footer-grid">
        <div className="footer-brand">
          {/* The white logo on contrast, 30px (SiteFooter). */}
          <img src="/logos/k7-cybersecurity-logo-white.svg" alt="K7 CyberSecurity" style={{ height: 30, width: 'auto', alignSelf: 'flex-start' }} />
          {data?.tagline && <p className="body-s">{data.tagline}</p>}
          {(data?.socials?.length ?? 0) > 0 && (
            <div className="social">
              {/* The five drawn glyphs (Icon, social); a network without one shows its mono code. */}
              {data.socials!.map((s, i) => {
                const glyph = socialGlyph(s.name)
                return (
                  <a href={s.url} aria-label={s.name} key={s.id ?? i} rel="noopener noreferrer" target="_blank">
                    {glyph ? <Icon name={glyph} /> : s.code}
                  </a>
                )
              })}
            </div>
          )}
        </div>
        {(data?.columns ?? []).map((col, i) => (
          <div className="footer-col" key={col.id ?? i}>
            <h2 className="label">{col.heading}</h2>
            <ol>
              {(col.links ?? []).map((l, j) => (
                <li key={l.id ?? j}>
                  <Link href={navHref(l)}>
                    <span className="n">{pad(j + 1)}</span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <div className="footer-mark" aria-hidden="true">
        <span className="wordmark-mark" />
        <span>K7 CyberSecurity</span>
      </div>
      <div className="footer-base body-s">
        <span>{data?.legal}</span>
        {data?.offices && <span className="label">{data.offices}</span>}
        <span className="fresh is-fresh">
          <i className="fresh-px" />
          <span className="label">Printed {printed()}</span>
        </span>
      </div>
    </footer>
  )
}
