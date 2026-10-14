import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import Link from 'next/link'
import React from 'react'

import { PortalHeader } from '@/components/support/Header'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { cn } from '@/utilities/ui'

import '../(frontend)/globals.css'
import './portal.css'

/* The support portal's own root layout (08-implementation-plan.md §1): the site chrome without the marketing footer,
   never indexed, always rendered at request time because every page depends on who is signed in. */

export const dynamic = 'force-dynamic'

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], style: ['normal', 'italic'], variable: '--font-archivo', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'K7 Support', template: '%s | K7 Support' },
  robots: { index: false, follow: false },
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={cn(archivo.variable, plexMono.variable)} lang="en" suppressHydrationWarning>
      <head>
        <InitTheme />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <Providers>
          <div className="page">
            <PortalHeader />
            <main className="portal-main" id="main">
              {children}
            </main>
            <footer className="site-footer g-paper" style={{ paddingTop: 28 }}>
              <div className="footer-base" style={{ marginTop: 0 }}>
                <span className="label">K7 Computing Private Limited · Chennai, India</span>
                <span className="label">
                  <Link href="/research">K7 Labs</Link> · <Link href="/">k7computing.com</Link>
                </span>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  )
}
