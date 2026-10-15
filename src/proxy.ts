import { NextResponse } from 'next/server'

import { auth } from '@/auth'

/* Request interception for the portal (08-implementation-plan.md §2): the workspace needs an agent, the customer's own pages need a
   session, everything else under /support is public. Running Auth.js here also keeps the session cookie refreshed. */

const signInUrl = (req: { url: string; nextUrl: { pathname: string; search: string } }, agent: boolean) => {
  const u = new URL('/support/sign-in', req.url)
  if (agent) u.searchParams.set('agent', '1')
  u.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  return u
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const user = req.auth?.user
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

export const config = { matcher: ['/support/:path*'] }
