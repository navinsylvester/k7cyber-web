import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { PartnerHeader } from '@/components/partner/Header'
import { partnerPortalEnabled } from '@/lib/partner/settings'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { defaultTheme } from '@/providers/Theme/shared'
import { cn } from '@/utilities/ui'

import '../(frontend)/globals.css'
import '../(portal)/portal.css'
import './partner.css'

/* The partner portal's own root layout (docs/partner-portal/02-build-plan.md §4): the site chrome without the marketing footer,
   never indexed, always rendered at request time because every page depends on who is signed in. It stands on the support
   portal's chrome (section 09, portal.css) and adds section 10 (partner.css). Off unless PARTNER_PORTAL_ENABLED allows. */

export const dynamic = 'force-dynamic'

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], style: ['normal', 'italic'], variable: '--font-archivo', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'K7 Partners', template: '%s | K7 Partners' },
  robots: { index: false, follow: false },
}

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  if (!partnerPortalEnabled()) notFound()
  return (
    <html className={cn(archivo.variable, plexMono.variable)} data-theme={defaultTheme} lang="en" suppressHydrationWarning>
      <head>
        <InitTheme />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <Providers>
          <div className="page">
            <PartnerHeader />
            <main className="portal-main" id="main">
              {children}
            </main>
            <footer className="site-footer g-paper" style={{ paddingTop: 28 }}>
              <div className="footer-base" style={{ marginTop: 0 }}>
                <span className="label">K7 Computing Private Limited · Chennai, India</span>
                <span className="label">
                  <Link href="/partners">Partner programme</Link> · <Link href="/partners/join">Join</Link> · <Link href="/support">Support</Link> · <Link href="/">k7computing.com</Link>
                </span>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  )
}
