import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Empty, NotificationList, StaffRoleTags } from '@/components/partner/Parts'
import { listNotifications } from '@/lib/partner/notify'
import { requireK7 } from '@/lib/partner/session'

import { markAllReadAction } from '../../notifications/actions'

export const metadata: Metadata = { title: 'Notifications' }

/* The staff bell: the rows sent to the roles this person holds, shared with everyone else who holds them. */
export default async function K7NotificationsPage() {
  const me = await requireK7('/partners/portal/k7/notifications')
  const rows = me.roles.length ? await listNotifications({ kind: 'staff', roles: me.roles }) : []
  const unread = rows.filter((r) => !r.readAt).length
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">{String(rows.length).padStart(2, '0')} notifications · {String(unread).padStart(2, '0')} unread</span>
          <h1 className="h-util">Notifications.</h1>
          <p className="lede">
            What the portal has sent to your roles: <StaffRoleTags roles={me.roles} />
          </p>
        </div>
        <div className="ws-actions">
          {me.roles.includes('channelManager') && (
            <Link className="btn btn-line btn-sm" href="/partners/portal/k7/notifications/templates">
              Templates
            </Link>
          )}
          {unread > 0 && (
            <form action={markAllReadAction}>
              <button className="btn btn-line btn-sm" type="submit">
                Mark all as read
              </button>
            </form>
          )}
        </div>
      </div>
      {rows.length ? (
        <NotificationList rows={rows} />
      ) : (
        <Empty label="Nothing yet">
          <>Nothing has been sent to your roles so far. Applications and deals waiting on you will appear here and by email.</>
        </Empty>
      )}
    </section>
  )
}
