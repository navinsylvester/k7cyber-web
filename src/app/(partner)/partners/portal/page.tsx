import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { NotificationList, OrgStateTag, Pid, RoleTags, Strip, TypeTag } from '@/components/partner/Parts'
import { orgAudit } from '@/lib/partner/audit'
import { listNotifications } from '@/lib/partner/notify'
import { requirePartner } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { dmy } from '@/lib/support/format'

export const metadata: Metadata = { title: 'Home' }

/* The partner's home (02-build-plan.md §4): the status strip first (who you are here, the organisation's state), then the latest
   notifications and the organisation's facts. Deals, collateral and schemes join the page with their milestones. Every read
   carries `me.scope`. */
export default async function PartnerHomePage() {
  const me = await requirePartner('/partners/portal')
  const [settings, notifications, trail] = await Promise.all([getPartnerSettings(), listNotifications({ kind: 'user', userId: me.user.id, scope: me.scope }, 5), orgAudit(me.scope, 5)])
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
