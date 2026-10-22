import type { Metadata } from 'next'
import React from 'react'

import { Empty, NotificationList } from '@/components/partner/Parts'
import { listNotifications } from '@/lib/partner/notify'
import { requirePartner } from '@/lib/partner/session'

import { markAllReadAction } from './actions'

export const metadata: Metadata = { title: 'Notifications' }

/* The bell's page (FR-NTF-01): everything sent to this user, newest first. Rows are scoped by user and organisation. */
export default async function NotificationsPage() {
  const me = await requirePartner('/partners/portal/notifications')
  const rows = await listNotifications({ kind: 'user', userId: me.user.id, scope: me.scope })
  const unread = rows.filter((r) => !r.readAt).length
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">{String(rows.length).padStart(2, '0')} notifications · {String(unread).padStart(2, '0')} unread</span>
          <h1 className="h-util">Notifications.</h1>
          <p className="lede">What the programme has told you: decisions, deadlines and what arrives for your organisation.</p>
        </div>
        {unread > 0 && (
          <form action={markAllReadAction} className="ws-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Mark all as read
            </button>
          </form>
        )}
      </div>
      {rows.length ? (
        <NotificationList rows={rows} />
      ) : (
        <Empty label="Nothing yet">
          <>Nothing has been sent to you so far. Decisions on your deals and applications will appear here and by email.</>
        </Empty>
      )}
    </section>
  )
}
