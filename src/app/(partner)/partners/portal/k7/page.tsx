import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { StaffRoleTags, Strip } from '@/components/partner/Parts'
import { unreadCount } from '@/lib/partner/notify'
import { requireK7 } from '@/lib/partner/session'
import { STAFF_ROLE_LABEL, getPartnerSettings, type StaffRole } from '@/lib/partner/settings'

export const metadata: Metadata = { title: 'Partner desk' }

/* The K7 side's home (02-build-plan.md §4, /partners/portal/k7): who you are here, the roles you hold and what each opens. The
   queues arrive with their milestones (applications M2, deals M4, partners M3, schemes M7, reports M8, settings M2). */
const OPENS: Record<StaffRole, string> = {
  channelManager: 'applications, every partner organisation, waivers and suspensions',
  dealDeskApprover: 'registered deals, conflicts, decisions and extensions',
  trainingAdmin: 'courses, tests and question banks (last phase)',
  marketingAdmin: 'collateral and schemes in the Payload admin',
  schemeAdmin: 'scheme registrations, eligibility runs and payouts',
}

export default async function K7HomePage() {
  const me = await requireK7('/partners/portal/k7')
  const settings = await getPartnerSettings()
  const unread = await unreadCount({ kind: 'staff', roles: me.roles })
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">Partner desk · K7 staff</span>
          <h1 className="h-util">{me.name || me.email}.</h1>
          <p className="lede">The channel programme’s back office: applications, deals, partners and schemes, each behind its role.</p>
        </div>
      </div>
      <Strip
        items={[
          { label: 'Signed in as', value: me.email || '—' },
          { label: 'Roles', value: <StaffRoleTags roles={me.roles} /> },
          { label: 'Unread', value: <Link href="/partners/portal/k7/notifications">{String(unread).padStart(2, '0')} notifications</Link> },
          { label: 'Staff listed', value: String(settings.staff.length).padStart(2, '0') },
        ]}
      />
      <div className="phome">
        <div>
          <h2>What your roles open</h2>
          {me.roles.length ? (
            <ol className="ntf">
              {me.roles.map((r) => (
                <li key={r}>
                  <span className="ntf-when">{r}</span>
                  <div className="ntf-body">
                    <strong>{STAFF_ROLE_LABEL[r]}</strong>
                    <p>Opens {OPENS[r]}.</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="lede">
              You hold no partner-portal role yet. Roles are given by work email in the portal’s settings (Payload admin → Partner portal settings → Staff).
            </p>
          )}
        </div>
        <aside className="ws-side">
          <div>
            <h2>Settings</h2>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>
              Protection {settings.deals.protectionDays} days · extension {settings.deals.extensionDays} days · decision within {settings.deals.approvalSlaHours} working hours · certificate gate {settings.deals.requireCertificate ? 'on' : 'off'} · CRM mirror {settings.crm.enabled ? 'on' : 'off'}.
            </p>
            <p className="more">
              <Link className="link-u" href="/admin/globals/partner-settings">
                Edit in the Payload admin
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
