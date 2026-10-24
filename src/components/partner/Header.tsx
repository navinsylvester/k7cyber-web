import Link from 'next/link'
import React from 'react'

import { Logo } from '@/components/Logo/Logo'
import { HeaderShell } from '@/components/support/Header.client'
import { unreadCount } from '@/lib/partner/notify'
import { partnerSideSession } from '@/lib/partner/session'
import { initials } from '@/lib/support/format'

import { signOutAction } from '@/app/(partner)/partners/portal/actions'

import { Bell } from './Parts'

/* The partner portal's header (SiteHeader shape through the shared shell): brand, the audience's links, the bell, the theme toggle
   and the account. Partner users and K7 staff see different links; a visitor sees the door. */
export const PartnerHeader: React.FC = async () => {
  const me = await partnerSideSession()
  const partner = me?.kind === 'partner' ? me : null
  const k7 = me?.kind === 'k7' ? me : null
  const links = partner
    ? [
        { href: '/partners/portal', label: 'Home' },
        { href: '/partners/portal/deals', label: 'Deals' },
        { href: '/partners/portal/dashboard', label: 'Dashboard' },
        { href: '/partners/portal/collateral', label: 'Collateral' },
        { href: '/partners/portal/schemes', label: 'Schemes' },
        { href: '/partners/portal/training', label: 'Training' },
        { href: '/partners/portal/certificates', label: 'Certificates' },
        { href: '/partners/portal/organisation', label: 'Organisation' },
        { href: '/partners/portal/notifications', label: 'Notifications' },
      ]
    : k7
      ? [
          { href: '/partners/portal/k7', label: 'Partner desk' },
          ...(k7.roles.includes('channelManager')
            ? [
                { href: '/partners/portal/k7/applications', label: 'Applications' },
                { href: '/partners/portal/k7/partners', label: 'Partners' },
              ]
            : []),
          ...(k7.roles.includes('dealDeskApprover') ? [{ href: '/partners/portal/k7/deals', label: 'Deals' }] : []),
          ...(k7.roles.includes('marketingAdmin') ? [{ href: '/partners/portal/k7/collateral', label: 'Collateral' }] : []),
          ...(k7.roles.includes('schemeAdmin') ? [{ href: '/partners/portal/k7/schemes', label: 'Schemes' }] : []),
          ...(k7.roles.includes('trainingAdmin') ? [{ href: '/partners/portal/k7/training', label: 'Training' }] : []),
          ...(k7.roles.some((r) => r === 'channelManager' || r === 'trainingAdmin') ? [{ href: '/partners/portal/k7/certificates', label: 'Certificates' }] : []),
          ...(k7.roles.some((r) => r === 'channelManager' || r === 'dealDeskApprover' || r === 'schemeAdmin') ? [{ href: '/partners/portal/k7/reports', label: 'Reports' }] : []),
        ]
      : [
          { href: '/partners', label: 'The programme' },
          { href: '/partners/join', label: 'Join' },
        ]
  const unread = partner ? await unreadCount({ kind: 'user', userId: partner.user.id, scope: partner.scope }) : k7 ? await unreadCount({ kind: 'staff', roles: k7.roles }) : 0
  const home = partner ? '/partners/portal' : k7 ? '/partners/portal/k7' : '/partners/portal/sign-in'
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
        home="/partners/portal"
        brand={
          <Link className="brand" href={home} aria-label="K7 Partners">
            <Logo />
            <span className="label">Partners</span>
          </Link>
        }
        links={links}
        mobileExtra={me ? [] : [{ href: '/partners/portal/sign-in', label: 'Sign in' }]}
        account={
          me ? (
            <form action={signOutAction}>
              {(partner || k7) && <Bell href={partner ? '/partners/portal/notifications' : '/partners/portal/k7/notifications'} unread={unread} />}
              <Link className="who" href={home} title={partner ? partner.user.email : k7?.email}>
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
