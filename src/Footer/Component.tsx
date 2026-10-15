import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import { Icon, socialGlyph } from '@/components/k7/Icon'
import { navHref } from '@/utilities/linkHref'

export async function Footer() {
  const data = await getCachedGlobal('footer', 1)()

  return (
    <footer className="site-footer g-contrast">
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
            {(col.links ?? []).map((l, j) => (
              <Link href={navHref(l)} key={l.id ?? j}>
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="footer-base body-s">
        <span>{data?.legal}</span>
        {data?.offices && <span className="label">{data.offices}</span>}
      </div>
    </footer>
  )
}
