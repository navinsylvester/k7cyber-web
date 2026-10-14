import Link from 'next/link'
import React from 'react'

import { sessionIsManager } from '@/lib/support/session'

export type WsSection = 'home' | 'cases' | 'queues' | 'customers' | 'kb' | 'products' | 'rfe' | 'dashboards' | 'search' | 'manage'

export const WS = '/support/workspace'

const SECTIONS: { key: WsSection; label: string; href: string }[] = [
  { key: 'home', label: 'Home', href: WS },
  { key: 'cases', label: 'Cases', href: `${WS}/cases` },
  { key: 'queues', label: 'Queues', href: `${WS}/queues` },
  { key: 'customers', label: 'Customers', href: `${WS}/customers` },
  { key: 'dashboards', label: 'Dashboards', href: `${WS}/dashboards/active-cases` },
  { key: 'kb', label: 'Knowledge', href: `${WS}/kb` },
  { key: 'products', label: 'Products', href: `${WS}/products` },
  { key: 'rfe', label: 'RFEs', href: `${WS}/rfe` },
]

const MANAGE_SECTION: { key: WsSection; label: string; href: string } = { key: 'manage', label: 'Manage', href: `${WS}/manage` }

/* The workspace strip under the header: the sitemap of the mobile app as research-style tabs, and the quick search.
   Managers (09-portal-guide.md §4c) get one more tab. */
export const WorkspaceBar = async ({ active, ground = 'paper', q }: { active: WsSection; ground?: 'paper' | 'panel'; q?: string }) => {
  const manager = active === 'manage' || (await sessionIsManager())
  const sections = manager ? [...SECTIONS, MANAGE_SECTION] : SECTIONS
  return (
  <div className="wsbar g-paper">
    <div className="wsbar-in">
      <nav className="rtabs" aria-label="Workspace">
        {sections.map((s) => (
          <Link className={`rtab label on-${ground}`} href={s.href} key={s.key} {...(s.key === active ? { 'aria-current': 'page' as const } : {})}>
            <span className="pixel" aria-hidden="true" />
            {s.label}
          </Link>
        ))}
      </nav>
      <form className="wssearch" action={`${WS}/search`} method="get" role="search">
        <label className="sr-only" htmlFor="ws-q">
          Search cases, customers and articles
        </label>
        <span className="control">
          <input id="ws-q" name="q" type="search" placeholder="Case number, title, customer or email" defaultValue={q} autoComplete="off" />
          <button type="submit" aria-label="Search">
            →
          </button>
        </span>
      </form>
    </div>
  </div>
)
}
