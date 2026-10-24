import Link from 'next/link'
import React from 'react'

import type { StaffRole } from '@/lib/partner/settings-model'

export type K7Section = 'home' | 'applications' | 'partners' | 'deals' | 'collateral' | 'schemes' | 'training' | 'certificates' | 'reports' | 'operations' | 'settings' | 'notifications'

export const K7 = '/partners/portal/k7'

type Section = { key: K7Section; label: string; href: string; roles?: StaffRole[] }

/* The partner desk's strip, the support workspace's shape (section 09 `wsbar`): the queues as research tabs. A tab shows only
   when the person holds a role that opens it; collateral (M6) is the Marketing Admin's, schemes (M7) the Scheme Admin's, training (M10) the Training Admin's, certificates (M11) the Channel Manager's and the Training Admin's, reports (M8) open to the three roles that read them, operations (M9) is the Channel Manager's. */
const SECTIONS: Section[] = [
  { key: 'home', label: 'Desk', href: K7 },
  { key: 'applications', label: 'Applications', href: `${K7}/applications`, roles: ['channelManager'] },
  { key: 'partners', label: 'Partners', href: `${K7}/partners`, roles: ['channelManager'] },
  { key: 'deals', label: 'Deals', href: `${K7}/deals`, roles: ['dealDeskApprover'] },
  { key: 'collateral', label: 'Collateral', href: `${K7}/collateral`, roles: ['marketingAdmin'] },
  { key: 'schemes', label: 'Schemes', href: `${K7}/schemes`, roles: ['schemeAdmin'] },
  { key: 'training', label: 'Training', href: `${K7}/training`, roles: ['trainingAdmin'] },
  { key: 'certificates', label: 'Certificates', href: `${K7}/certificates`, roles: ['channelManager', 'trainingAdmin'] },
  { key: 'reports', label: 'Reports', href: `${K7}/reports`, roles: ['channelManager', 'dealDeskApprover', 'schemeAdmin'] },
  { key: 'operations', label: 'Operations', href: `${K7}/operations`, roles: ['channelManager'] },
  { key: 'settings', label: 'Settings', href: `${K7}/settings`, roles: ['channelManager'] },
]

export const K7Nav: React.FC<{ active: K7Section; roles: StaffRole[]; counts?: Partial<Record<K7Section, number>> }> = ({ active, roles, counts = {} }) => (
  <div className="wsbar g-paper">
    <div className="wsbar-in">
      <nav className="rtabs" aria-label="Partner desk">
        {SECTIONS.filter((s) => !s.roles || s.roles.some((r) => roles.includes(r))).map((s) => (
          <Link className="rtab label on-paper" href={s.href} key={s.key} {...(s.key === active ? { 'aria-current': 'page' as const } : {})}>
            <span className="pixel" aria-hidden="true" />
            {s.label}
            {counts[s.key] ? <span className="rtab-n">{String(counts[s.key]).padStart(2, '0')}</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  </div>
)
