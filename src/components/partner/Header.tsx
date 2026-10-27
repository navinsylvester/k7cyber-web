import Link from 'next/link'
import React from 'react'

import { Logo } from '@/components/Logo/Logo'
import { HeaderShell } from '@/components/support/Header.client'
import { unreadCount } from '@/lib/partner/notify'
import { partnerSideSession } from '@/lib/partner/session'
import { initials } from '@/lib/support/format'

import { signOutAction } from '@/app/(partner)/partners/portal/actions'

import { Bell } from './Parts'

/* The partner portal's header (SiteHeader shape through the shared shell): brand, the core links, the bell, the theme toggle and
   the account. A partner user gets the four jobs (deals, sales material, schemes, training), with the dashboard under Deals and
   certificates under Training; the organisation is behind their name, notifications behind the bell. K7 staff get the desk and
   the queues they decide on; the rest of the back office is the desk strip (K7Nav). A visitor gets the front page and the two doors. */
export const PartnerHeader: React.FC = async () => {
  const me = await partnerSideSession()
  const partner = me?.kind === 'partner' ? me : null
  const k7 = me?.kind === 'k7' ? me : null
  const links = partner
    ? [
        { href: '/partners/portal', label: 'Home' },
        { href: '/partners/portal/deals', label: 'Deals', match: ['/partners/portal/dashboard'] },
        { href: '/partners/portal/collateral', label: 'Sales material' },
        { href: '/partners/portal/schemes', label: 'Schemes' },
        { href: '/partners/portal/training', label: 'Training', match: ['/partners/portal/certificates'] },
      ]
    : k7
      ? [
          { href: '/partners/portal/k7', label: 'Desk' },
          ...(k7.roles.includes('channelManager')
            ? [
                { href: '/partners/portal/k7/applications', label: 'Applications' },
                { href: '/partners/portal/k7/partners', label: 'Partners' },
              ]
            : []),
          ...(k7.roles.includes('dealDeskApprover') ? [{ href: '/partners/portal/k7/deals', label: 'Deals' }] : []),
          ...(k7.roles.some((r) => r === 'channelManager' || r === 'dealDeskApprover' || r === 'schemeAdmin') ? [{ href: '/partners/portal/k7/reports', label: 'Reports' }] : []),
        ]
      : [
          { href: '/partners/portal', label: 'Home' },
          { href: '/partners', label: 'The programme', exact: true },
          { href: '/partners/join', label: 'Apply' },
        ]
  const unread = partner ? await unreadCount({ kind: 'user', userId: partner.user.id, scope: partner.scope }) : k7 ? await unreadCount({ kind: 'staff', roles: k7.roles }) : 0
  const home = k7 ? '/partners/portal/k7' : '/partners/portal'
  return (
    <>
      {k7?.dev && (
        <div className="devbar">
          <span>
            <i className="pixel" /> Development sign-in · every partner-portal role
          </span>
          <span>UAT · k7crmuat</span>
        </div>
      )}
      <HeaderShell
        name="Partners"
        home={home}
        brand={
          <Link className="brand" href={home} aria-label="K7 Partners">
            <Logo />
            <span className="label">Partners</span>
          </Link>
        }
        links={links}
        mobileExtra={partner ? [{ href: '/partners/portal/organisation', label: 'Organisation' }, { href: '/partners/portal/notifications', label: 'Notifications' }] : me ? [] : [{ href: '/partners/portal/sign-in', label: 'Sign in' }]}
        account={
          me ? (
            <form action={signOutAction}>
              {(partner || k7) && <Bell href={partner ? '/partners/portal/notifications' : '/partners/portal/k7/notifications'} unread={unread} />}
              <Link className="who" href={partner ? '/partners/portal/organisation' : home} title={partner ? partner.user.email : k7?.email}>
                <span className="avatar" aria-hidden="true">
                  {initials(partner ? partner.user.name || partner.user.email : k7?.name || k7?.email || '?')}
                </span>
                <span className="who-name">{partner ? partner.user.name || partner.user.email : k7?.name || k7?.email}</span>
              </Link>
              <button className="link-u textbtn" type="submit">
                Sign out
              </button>
            </form>
          ) : (
            <Link className="btn btn-line btn-sm" href="/partners/portal/sign-in">
              Sign in →
            </Link>
          )
        }
      />
    </>
  )
}
