import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { StaffRoleTags, Strip } from '@/components/partner/Parts'
import { collateralCounts } from '@/lib/partner/collateral'
import { dealCounts } from '@/lib/partner/deals'
import { owedOutboxCount } from '@/lib/partner/mirror'
import { unreadCount } from '@/lib/partner/notify'
import { orgCounts } from '@/lib/partner/organisation'
import { applicationCounts } from '@/lib/partner/registration'
import { schemeCounts } from '@/lib/partner/schemes'
import { requireK7 } from '@/lib/partner/session'
import { slaCounts } from '@/lib/partner/sla'
import { STAFF_ROLE_LABEL, getPartnerSettings, type StaffRole } from '@/lib/partner/settings'

export const metadata: Metadata = { title: 'Partner desk' }

/* The K7 side's home (02-build-plan.md §4, /partners/portal/k7): who you are here, the roles you hold and what each opens. The
   queues arrive with their milestones (applications and settings M2, partners M3, deals M4, collateral M6, schemes M7, reports M8). */
const OPENS: Record<StaffRole, string> = {
  channelManager: 'applications, every partner organisation, waivers and suspensions, the reports, the settings and the notification templates',
  dealDeskApprover: 'registered deals, conflicts, decisions and extensions, the pipeline and SLA reports',
  trainingAdmin: 'courses, tests and question banks (last phase)',
  marketingAdmin: 'the collateral library (edited in the Payload admin, read here) and schemes',
  schemeAdmin: 'scheme registrations, the eligibility run, adjustments and publication, disputes, payouts and the Finance export',
}

export default async function K7HomePage() {
  const me = await requireK7('/partners/portal/k7')
  const settings = await getPartnerSettings()
  const cm = me.roles.includes('channelManager')
  const dda = me.roles.includes('dealDeskApprover')
  const mkt = me.roles.includes('marketingAdmin')
  const sch = me.roles.includes('schemeAdmin')
  const [unread, counts, owed, orgs, deals, library, schemes, sla] = await Promise.all([unreadCount({ kind: 'staff', roles: me.roles }), cm ? applicationCounts() : null, cm || dda ? owedOutboxCount() : 0, cm ? orgCounts() : null, dda ? dealCounts() : null, mkt ? collateralCounts() : null, sch ? schemeCounts() : null, cm || dda ? slaCounts(settings) : null])
  const breached = sla ? (cm ? sla.applications.breached : 0) + (dda ? sla.deals.breached : 0) : 0
  const onClock = sla ? (cm ? sla.applications.open : 0) + (dda ? sla.deals.open : 0) : 0
  return (
    <>
    <K7Nav active="home" roles={me.roles} counts={{ applications: counts?.submitted, partners: orgs?.edits, deals: deals?.open, collateral: library?.withoutFile, schemes: schemes ? schemes.pending + schemes.due + schemes.disputes : undefined, reports: breached || undefined }} />
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">Partner desk · K7 staff</span>
          <h1 className="h-util">{me.name || me.email}.</h1>
          <p className="lede">The channel programme’s back office: applications, deals, partners, collateral and schemes, each behind its role.</p>
        </div>
      </div>
      <Strip
        items={[
          { label: 'Signed in as', value: me.email || '—' },
          { label: 'Roles', value: <StaffRoleTags roles={me.roles} /> },
          { label: 'Unread', value: <Link href="/partners/portal/k7/notifications">{String(unread).padStart(2, '0')} notifications</Link> },
          ...(counts ? [{ label: 'Applications', value: <Link href="/partners/portal/k7/applications">{String(counts.submitted + counts.underReview).padStart(2, '0')} open · {String(counts.submitted).padStart(2, '0')} new</Link> }] : [{ label: 'Staff listed', value: String(settings.staff.length).padStart(2, '0') }]),
          ...(orgs ? [{ label: 'Partners', value: <Link href="/partners/portal/k7/partners">{String(orgs.approved).padStart(2, '0')} approved{orgs.edits ? ` · ${String(orgs.edits).padStart(2, '0')} edits waiting` : ''}</Link> }] : []),
          ...(deals ? [{ label: 'Deals', value: <Link href="/partners/portal/k7/deals">{String(deals.submitted).padStart(2, '0')} new · {String(deals.extensionRequested).padStart(2, '0')} extensions · {String(deals.approved).padStart(2, '0')} protected</Link> }] : []),
          ...(library ? [{ label: 'Collateral', value: <Link href="/partners/portal/k7/collateral">{String(library.published).padStart(2, '0')} published{library.withoutFile ? ` · ${String(library.withoutFile).padStart(2, '0')} without a file` : ''} · {String(library.downloads30).padStart(2, '0')} downloads in 30 days</Link> }] : []),
          ...(sla ? [{ label: 'Approval SLA', value: <Link href="/partners/portal/k7/reports">{String(onClock).padStart(2, '0')} on the clock{breached ? ` · ${String(breached).padStart(2, '0')} past the target` : ''}</Link> }] : []),
          ...(schemes ? [{ label: 'Schemes', value: <Link href="/partners/portal/k7/schemes">{String(schemes.open + schemes.running).padStart(2, '0')} live{schemes.pending ? ` · ${String(schemes.pending).padStart(2, '0')} registrations waiting` : ''}{schemes.due ? ` · ${String(schemes.due).padStart(2, '0')} results due` : ''}{schemes.disputes ? ` · ${String(schemes.disputes).padStart(2, '0')} disputes` : ''}</Link> }] : []),
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
              Protection {settings.deals.protectionDays} days · extension {settings.deals.extensionDays} days · decision within {settings.deals.approvalSlaHours} working hours · certificate gate {settings.deals.requireCertificate ? 'on' : 'off'} · CRM mirror {settings.crm.enabled ? 'on' : 'off'}
              {owed ? ` · ${owed} CRM job${owed === 1 ? '' : 's'} waiting` : ''} · {settings.staff.length} staff listed.
            </p>
            <p className="more">
              {cm ? (
                <>
                  <Link className="link-u" href="/partners/portal/k7/settings">
                    Edit the settings
                  </Link>
                  {' · '}
                  <Link className="link-u" href="/partners/portal/k7/notifications/templates">
                    Notification templates
                  </Link>
                </>
              ) : (
                <Link className="link-u" href="/admin/globals/partner-settings">
                  Edit in the Payload admin
                </Link>
              )}
            </p>
          </div>
        </aside>
      </div>
    </section>
    </>
  )
}
