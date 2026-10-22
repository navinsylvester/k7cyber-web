import { NextResponse } from 'next/server'

import { auth } from '@/auth'

/* Request interception for the two portals. Support (08-implementation-plan.md §2): the workspace needs an agent, the customer's
   own pages need a customer session, everything else under /support is public. Partners (partner-portal/02-build-plan.md §4):
   /partners/portal/k7/* needs an agent session (the role is checked in requireK7Role, which needs Payload), the rest of
   /partners/portal/* a partner session, the door itself is public. A partner session counts for nothing on /support and a
   customer session for nothing on /partners: one cookie, three kinds, each side sees only its own. Running Auth.js here also
   keeps the session cookie refreshed. */

const signInUrl = (req: { url: string; nextUrl: { pathname: string; search: string } }, agent: boolean) => {
  const u = new URL('/support/sign-in', req.url)
  if (agent) u.searchParams.set('agent', '1')
  u.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  return u
}

const partnerSignInUrl = (req: { url: string; nextUrl: { pathname: string; search: string } }, staff: boolean) => {
  const u = new URL('/partners/portal/sign-in', req.url)
  if (staff) u.searchParams.set('staff', '1')
  u.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  return u
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth?.user
  if (pathname.startsWith('/partners/portal')) {
    if (/^\/partners\/portal\/(sign-in|verify)(\/|$)/.test(pathname)) return NextResponse.next()
    if (pathname.startsWith('/partners/portal/k7')) {
      if (session?.kind !== 'agent') return NextResponse.redirect(partnerSignInUrl(req, true))
      return NextResponse.next()
    }
    if (session?.kind === 'agent') return NextResponse.redirect(new URL('/partners/portal/k7', req.url))
    if (session?.kind !== 'partner') return NextResponse.redirect(partnerSignInUrl(req, false))
    return NextResponse.next()
  }
  const user = session && session.kind !== 'partner' ? session : undefined
  if (pathname.startsWith('/support/workspace') || pathname.startsWith('/support/product')) {
    if (user?.kind !== 'agent') return NextResponse.redirect(signInUrl(req, true))
    return NextResponse.next()
  }
  if (/^\/support\/(cases|profile)(\/|$)/.test(pathname)) {
    if (!user) return NextResponse.redirect(signInUrl(req, false))
    if (user.kind === 'agent') return NextResponse.redirect(new URL('/support/workspace', req.url))
  }
  return NextResponse.next()
})

export const config = { matcher: ['/support/:path*', '/partners/portal/:path*'] }
