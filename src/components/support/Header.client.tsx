'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useState } from 'react'

import { useTheme } from '@/providers/Theme'

type L = { href: string; label: string }

/* The portal header shell (SiteHeader shape), shared by the support and partner portals: brand, the audience's links, theme
   toggle, account, and the Menu button with the phone list beneath the bar. Brand and account arrive rendered from the server.
   `home` is the one link matched exactly (the others match by prefix); `name` labels the navigation. */
export const HeaderShell: React.FC<{ brand: React.ReactNode; links: L[]; account: React.ReactNode; mobileExtra?: L[]; home?: string; name?: string }> = ({ brand, links, account, mobileExtra = [], home = '/support', name = 'Support' }) => {
  const pathname = usePathname()
  const [mobile, setMobile] = useState(false)
  const { theme, setTheme } = useTheme()
  const current = (href: string) => (href === home ? pathname === home : pathname.startsWith(href))
  return (
    <header className="site-header g-paper">
      <div className="bar">
        {brand}
        <nav className="main-nav portal-nav" aria-label={name}>
          {links.map((l) => (
            <Link href={l.href} key={l.href} {...(current(l.href) ? { 'aria-current': 'page' as const } : {})}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hdr-tools">
          <div className="seg" role="group" aria-label="Theme">
            <button type="button" aria-pressed={theme !== 'light'} onClick={() => setTheme('dark')}>
              Dark
            </button>
            <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
              Light
            </button>
          </div>
          {account}
          <button type="button" className="btn btn-line btn-sm menu-btn" aria-expanded={mobile} aria-label={mobile ? 'Close menu' : 'Open menu'} onClick={() => setMobile(!mobile)}>
            {mobile ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>
      {mobile && (
        <nav className="mobile-nav g-panel" aria-label={name}>
          {[...links, ...mobileExtra].map((l) => (
            <Link href={l.href} key={l.href} onClick={() => setMobile(false)} {...(current(l.href) ? { 'aria-current': 'page' as const } : {})}>
              <span>{l.label}</span>
              {current(l.href) && <i className="pixel" />}
            </Link>
          ))}
          <div className="seg seg-l" role="group" aria-label="Theme" style={{ marginTop: 16 }}>
            <button type="button" aria-pressed={theme !== 'light'} onClick={() => setTheme('dark')}>
              Dark
            </button>
            <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
              Light
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}
