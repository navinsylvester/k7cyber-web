import Link from 'next/link'
import React from 'react'

export type Tab = 'k7-labs' | 'lab-blog' | 'vulnerability-information' | 'top-threats' | 'threat-reports'
export const TABS: { key: Tab; label: string; href: string }[] = [
  { key: 'k7-labs', label: 'K7 Labs', href: '/research' },
  { key: 'lab-blog', label: 'Lab Blog', href: '/research/lab-blog' },
  { key: 'vulnerability-information', label: 'Vulnerability Information', href: '/research/vulnerability-information' },
  { key: 'top-threats', label: 'Top Threats', href: '/research/top-threats' },
  { key: 'threat-reports', label: 'Threat Reports', href: '/research/threat-reports' },
]

export type Crumb = { label: string; href?: string }

/* The research bar: breadcrumbs and the five section tabs. The active tab joins the ground of the sheet below (A2);
   on a detail page the tab is marked as the section rather than the current page. */
export const ResearchBar: React.FC<{ active: Tab; crumbs: Crumb[]; ground?: 'paper' | 'panel' | 'contrast'; section?: boolean }> = ({ active, crumbs, ground = 'panel', section = false }) => (
  <div className="research-bar g-paper">
    <nav aria-label="Breadcrumb">
      <ol className="crumbs label">
        <li>
          <Link href="/insight">Resources</Link>
        </li>
        {crumbs.map((c, i) => (
          <li key={i}>{c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>
        ))}
      </ol>
    </nav>
    <nav className="rtabs" aria-label="Research">
      {TABS.map((t) => {
        const on = t.key === active
        return (
          <Link className={`rtab label on-${ground}${on && section ? ' is-section' : ''}`} href={t.href} key={t.key} {...(on && !section ? { 'aria-current': 'page' } : {})}>
            <span className="pixel" aria-hidden="true" />
            {t.label}
          </Link>
        )
      })}
    </nav>
  </div>
)
