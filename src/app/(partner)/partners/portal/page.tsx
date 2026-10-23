import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { NotificationList, OrgStateTag, Pid, RoleTags, Strip, TypeTag } from '@/components/partner/Parts'
import { orgAudit } from '@/lib/partner/audit'
import { collateralCountFor, PARTNER_COLLATERAL } from '@/lib/partner/collateral'
import { dealCounts, PARTNER_DASHBOARD, PARTNER_DEALS, registerGate } from '@/lib/partner/deals'
import { listNotifications } from '@/lib/partner/notify'
import { requirePartner } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { dmy } from '@/lib/support/format'

export const metadata: Metadata = { title: 'Home' }

/* The partner's home (02-build-plan.md §4): the status strip first (who you are here, the organisation's state), then the latest
   notifications and the organisation's facts. Deals, the dashboard and the collateral library are here; schemes join the page with M7. Every read
   carries `me.scope`. */
export default async function PartnerHomePage() {
  const me = await requirePartner('/partners/portal')
  const [settings, notifications, trail, deals, blocked, collateral] = await Promise.all([getPartnerSettings(), listNotifications({ kind: 'user', userId: me.user.id, scope: me.scope }, 5), orgAudit(me.scope, 5), dealCounts(me.scope), registerGate(me), collateralCountFor(me)])
  const regions = settings.regions.filter((r) => me.org.regions.includes(r.code)).map((r) => r.name)
  const unread = notifications.filter((n) => !n.readAt).length
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <Pid id={me.org.partnerId} display />
          <h1 className="h-util">{me.org.tradeName || me.org.name}.</h1>
          <p className="lede">
            Welcome, {me.user.name.split(' ')[0] || me.user.email}. This is your organisation’s file with K7: what you have registered, what has been decided and what to do next.
          </p>
        </div>
      </div>
      <Strip
        items={[
          { label: 'Partner type', value: <TypeTag type={me.org.type} /> },
          { label: 'Status', value: <OrgStateTag status={me.org.status} /> },
          { label: 'Your roles', value: <RoleTags roles={me.roles} /> },
          { label: 'Deals', value: <Link href={PARTNER_DEALS}>{String(deals.approved).padStart(2, '0')} protected · {String(deals.submitted + deals.extensionRequested).padStart(2, '0')} with K7{deals.infoRequested ? ` · ${String(deals.infoRequested).padStart(2, '0')} need you` : ''}</Link> },
          { label: 'Certificate', value: me.org.certificate.status === 'valid' ? `Valid${me.org.certificate.until ? ` to ${dmy(me.org.certificate.until)}` : ''}` : 'Not yet required' },
        ]}
      />
      <div className="phome">
        <div>
          <h2>
            Latest notifications{unread ? <span className="muted" style={{ fontWeight: 400 }}> · {unread} unread</span> : null}
          </h2>
          {notifications.length ? (
            <>
              <NotificationList rows={notifications} />
              <p className="more">
                <Link className="link-u" href="/partners/portal/notifications">
                  All notifications →
                </Link>
              </p>
            </>
          ) : (
            <p className="lede" style={{ fontSize: 17 }}>
              Nothing has been sent to you yet. Decisions on your deals and applications will appear here and by email.
            </p>
          )}
        </div>
        <aside className="ws-side">
          <div>
            <h2>Deals</h2>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>
              {deals.approved + deals.submitted + deals.infoRequested + deals.extensionRequested + deals.rejected + deals.expired + deals.withdrawn === 0 ? 'No deal registered yet.' : `${deals.approved} approved and protected, ${deals.submitted + deals.extensionRequested} with K7, ${deals.infoRequested} waiting on you, ${deals.rejected + deals.expired + deals.withdrawn} closed.`}
              {deals.endingSoon ? ` ${deals.endingSoon} end${deals.endingSoon === 1 ? 's' : ''} protection within ${settings.deals.endingNoticeDays} days.` : ''}
            </p>
            <p className="more">
              {blocked ? (
                <Link className="link-u" href={PARTNER_DEALS}>
                  Your deals →
                </Link>
              ) : (
                <>
                  <Link className="link-u" href={`${PARTNER_DEALS}/new`}>
                    Register a deal →
                  </Link>
                  {' · '}
                  <Link className="link-u" href={PARTNER_DEALS}>
                    All deals
                  </Link>
                </>
              )}
              {' · '}
              <Link className="link-u" href={PARTNER_DASHBOARD}>
                Dashboard
              </Link>
            </p>
          </div>
          <div>
            <h2>Collateral</h2>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>
              {collateral === 0 ? 'Nothing published for your organisation yet.' : `${collateral} item${collateral === 1 ? '' : 's'} of sales and brand material, always the current version.`}
            </p>
            <p className="more">
              <Link className="link-u" href={PARTNER_COLLATERAL}>
                The library →
              </Link>
            </p>
          </div>
          <div>
            <h2>Your organisation</h2>
            <dl className="meta-rows">
              <dt>Legal name</dt>
              <dd className="sans">{me.org.name}</dd>
              {me.org.tradeName && (
                <>
                  <dt>Trade name</dt>
                  <dd className="sans">{me.org.tradeName}</dd>
                </>
              )}
              <dt>Country</dt>
              <dd className="sans">{me.org.country || '—'}</dd>
              <dt>Regions</dt>
              <dd className="sans">{regions.length ? regions.join(', ') : '—'}</dd>
              <dt>Signed in as</dt>
              <dd className="sans">{me.user.email}</dd>
            </dl>
            <p className="more">
              <Link className="link-u" href="/partners/portal/organisation">
                {me.roles.includes('admin') ? 'The organisation and its users →' : 'The organisation →'}
              </Link>
            </p>
          </div>
          {trail.length > 0 && (
            <div>
              <h2>Recent record</h2>
              <ol className="ntf">
                {trail.map((t) => (
                  <li key={t.id}>
                    <span className="ntf-when">{dmy(t.at)}</span>
                    <div className="ntf-body">
                      <strong>{t.action.replace(/[.-]/g, ' ')}</strong>
                      <p>
                        {t.objectLabel || t.object}
                        {t.from || t.to ? ` · ${t.from || '—'} → ${t.to || '—'}` : ''}
                        {t.actor.name ? ` · ${t.actor.name}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
