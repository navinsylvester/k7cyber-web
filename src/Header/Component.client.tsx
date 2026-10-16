'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { useTheme } from '@/providers/Theme'
import { linkHref, navHref } from '@/utilities/linkHref'
import { Icon } from '@/components/k7/Icon'

type NavItem = NonNullable<Header['navItems']>[number]

/* SiteHeader (design-system/components/SiteHeader): the sticky bar, the mega menu on a panel sheet beneath it,
   the two-button theme toggle, one primary action, and the mobile list behind the Menu button. */
export const SiteHeader: React.FC<{ data: Header }> = ({ data }) => {
  const items = data?.navItems ?? []
  const pathname = usePathname()
  const [open, setOpen] = useState<number | null>(null)
  const [mobile, setMobile] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const { theme, setTheme } = useTheme()

  const close = useCallback(() => {
    setOpen(null)
    setMobile(false)
  }, [])

  // Route change closes everything.
  useEffect(() => close(), [pathname, close])

  useEffect(() => {
    if (open === null && !mobile) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, mobile, close])

  const isCurrent = (item: NavItem): boolean => {
    const hrefs = [navHref(item), ...(item.columns ?? []).flatMap((c) => [navHref(c), ...(c.items ?? []).map(navHref)])]
    return hrefs.some((h) => h !== '#' && h !== '/' && pathname.startsWith(h))
  }

  const cta = data?.cta
  const panel = open !== null ? items[open] : null

  return (
    <header className="site-header g-paper" ref={ref}>
      <div className="bar">
        <Link className="brand" href="/" aria-label="K7 CyberSecurity">
          <Logo />
        </Link>

        <nav className="main-nav" aria-label="Main">
          {items.map((item, i) => {
            const hasPanel = (item.columns?.length ?? 0) > 0
            const current = isCurrent(item) ? { 'aria-current': 'page' as const } : {}
            return hasPanel ? (
              <button
                key={item.id ?? i}
                type="button"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
                {...current}
              >
                {item.label} <i className="chev" />
              </button>
            ) : (
              <Link key={item.id ?? i} href={navHref(item)} {...current}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="hdr-tools">
          <button
            type="button"
            className="theme-btn"
            aria-label={theme === 'light' ? 'Theme: light. Switch to dark.' : 'Theme: dark. Switch to light.'}
            title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            <Icon name="theme" />
          </button>
          {cta?.label && (
            <Link className="btn btn-primary btn-sm" href={linkHref(cta)}>
              {cta.label}
            </Link>
          )}
          <button
            type="button"
            className="btn btn-line btn-sm menu-btn"
            aria-expanded={mobile}
            aria-label={mobile ? 'Close menu' : 'Open menu'}
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>

      {panel && (
        <div className="mega g-panel" id={`mega-${open}`}>
          {(panel.columns ?? []).map((col, c) => {
            const rows = col.items ?? []
            return (
              <div className="mega-col" key={col.id ?? c}>
                <span className="label">
                  <span>{col.label}</span>
                  {rows.length > 0 && <span>{String(rows.length).padStart(2, '0')}</span>}
                </span>
                {rows.length === 0 ? (
                  <Link href={navHref(col)}>
                    <span>{col.label}</span>
                    <span className="arrow">→</span>
                  </Link>
                ) : (
                  rows.map((row, r) => (
                    <Link href={navHref(row)} key={row.id ?? r}>
                      <span>{row.label}</span>
                      <span className="arrow">→</span>
                    </Link>
                  ))
                )}
              </div>
            )
          })}
        </div>
      )}

      {mobile && (
        <nav className="mobile-nav g-panel" aria-label="Main">
          {items.map((item, i) => {
            const current = isCurrent(item)
            const columns = item.columns ?? []
            return (
              <React.Fragment key={item.id ?? i}>
                <Link href={navHref(item)} {...(current ? { 'aria-current': 'page' } : {})}>
                  <span>{item.label}</span>
                  {current && <i className="pixel" />}
                </Link>
                {columns.map((col, c) => (
                  <Link href={navHref(col)} key={col.id ?? c} style={{ fontSize: 17, fontWeight: 500, paddingLeft: 20 }}>
                    <span>{col.label}</span>
                    <span className="label muted">{col.items?.length ? String(col.items.length).padStart(2, '0') : ''}</span>
                  </Link>
                ))}
              </React.Fragment>
            )
          })}
        </nav>
      )}
    </header>
  )
}
