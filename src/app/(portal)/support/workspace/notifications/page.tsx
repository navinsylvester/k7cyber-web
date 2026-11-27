import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Empty, Flash, NotificationList, PageHead, Pager, qs } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { listNotifications } from '@/lib/support/notify'
import { requireAgent, sessionIsManager } from '@/lib/support/session'

import { markAllReadAction } from './actions'

export const metadata: Metadata = { title: 'Notifications' }

type SP = { show?: string; page?: string; ok?: string }

const PATH = `${WS}/notifications`
const PAGE = 30

/* The bell's page (09-portal-guide.md §4g): what the workspace told this agent, newest first. Opening one marks it read. */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const unreadOnly = sp.show === 'unread'
  const page = Math.max(1, Number(sp.page) || 1)
  const [{ rows, total, unread }, manager] = await Promise.all([listNotifications(me.userId, { unread: unreadOnly, page, limit: PAGE }), sessionIsManager()])
  return (
    <>
      <WorkspaceBar active="notifications" />
      <section className="sheet ws g-paper">
        <PageHead
          above={
            <span className="label muted">
              {String(total).padStart(2, '0')} {unreadOnly ? 'unread' : 'notifications'} · {String(unread).padStart(2, '0')} unread
            </span>
          }
          title="Notifications"
          lede="Your cases’ SLA clocks, your figures against the desk’s targets, and what happened on your cases: assigned to you, the customer wrote, escalated."
          actions={
            unread > 0 ? (
              <form action={markAllReadAction}>
                <button className="btn btn-line btn-sm" type="submit">
                  Mark all as read
                </button>
              </form>
            ) : undefined
          }
        />
        {sp.ok === 'read' && <Flash>Everything is marked as read.</Flash>}
        <div className="seg seg-l" role="group" aria-label="Show" style={{ marginBottom: 20 }}>
          <Link href={PATH} aria-pressed={!unreadOnly}>
            All
          </Link>
          <Link href={`${PATH}?show=unread`} aria-pressed={unreadOnly}>
            Unread
          </Link>
        </div>
        {rows.length ? (
          <>
            <NotificationList rows={rows} open={(id) => `${PATH}/go/${id}`} />
            <div className="ledger-foot label">
              <span>
                {total.toLocaleString('en-IN')} · page {page}
              </span>
              <Pager page={page} totalPages={Math.max(1, Math.ceil(total / PAGE))} href={(p) => PATH + qs({ show: unreadOnly ? 'unread' : undefined, page: p > 1 ? p : undefined })} label="Notifications" newer="Newer" older="Older" />
            </div>
          </>
        ) : (
          <Empty label={unreadOnly ? 'Nothing unread' : 'Nothing yet'}>
            {unreadOnly ? 'You have read everything.' : 'Nothing has been sent to you so far. When one of your cases needs you, it shows here, and by email once the mail server is set.'}
            {manager ? (
              <>
                {' '}
                Who is told what: <Link href={`${WS}/manage/notifications`}>notification settings</Link>.
              </>
            ) : null}
          </Empty>
        )}
      </section>
    </>
  )
}
