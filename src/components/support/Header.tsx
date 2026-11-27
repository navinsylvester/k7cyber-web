import Link from 'next/link'
import React from 'react'

import { auth } from '@/auth'
import { Logo } from '@/components/Logo/Logo'
import { initials } from '@/lib/support/format'
import { unreadCount } from '@/lib/support/notify'

import { signOutAction } from '@/app/(portal)/support/actions'

import { HeaderShell } from './Header.client'
import { Bell } from './Parts'

/* The portal header (SiteHeader shape): brand, the audience's three links, the theme toggle and the account.
   Agents see the bell (S35) before their name and the workspace strip beneath the header (WorkspaceBar) on workspace pages. */
export const PortalHeader: React.FC = async () => {
  const session = await auth()
  // A partner-portal session belongs to the other side of the house; here it reads as signed out.
  const user = session?.user && session.user.kind !== 'partner' ? session.user : undefined
  const agent = user?.kind === 'agent'
  const links = agent
    ? [
        { href: '/support/workspace', label: 'Workspace' },
        { href: '/support/kb', label: 'Knowledge base' },
      ]
    : [
        { href: '/support', label: 'Help centre' },
        { href: '/support/cases', label: 'My cases' },
        { href: '/support/kb', label: 'Knowledge base' },
      ]
  const mobileExtra = user ? (agent ? [{ href: '/support/workspace/notifications', label: 'Notifications' }] : [{ href: '/support/profile', label: 'My details' }]) : [{ href: '/support/sign-in', label: 'Sign in' }, { href: '/support/register', label: 'Create account' }]
  const unread = agent && user?.userId ? await unreadCount(user.userId) : 0
  return (
    <>
      {user?.dev && (
        <div className="devbar">
          <span>
            <i className="pixel" /> Development sign-in · probe token
          </span>
          <span>UAT · k7crmuat</span>
        </div>
      )}
      <HeaderShell
        brand={
          <Link className="brand" href="/support" aria-label="K7 Support">
            <Logo />
            <span className="label">Support</span>
          </Link>
        }
        links={links}
        mobileExtra={mobileExtra}
        account={
          user ? (
            <form action={signOutAction}>
              {agent && <Bell href="/support/workspace/notifications" unread={unread} />}
              <Link className="who" href={agent ? '/support/workspace' : '/support/profile'} title={user.email ?? undefined}>
                <span className="avatar" aria-hidden="true">
                  {initials(user.name || user.email || '?')}
                </span>
                <span className="who-name">{user.name || user.email}</span>
              </Link>
              <button className="link-u textbtn" type="submit">
                Sign out
              </button>
            </form>
          ) : (
            <>
              <Link className="link-u" href="/support/sign-in">
                Sign in
              </Link>
              <Link className="btn btn-line btn-sm hdr-cta" href="/support/register">
                Create account →
              </Link>
            </>
          )
        }
      />
    </>
  )
}
