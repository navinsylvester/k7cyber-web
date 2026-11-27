import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { markRead } from '@/lib/support/notify'
import { tryAgent } from '@/lib/support/session'

/* Opening a notification (09-portal-guide.md §4g): marks the reader's own row read and goes where it points. Only workspace
   paths are followed; anything else lands on the list. The redirect is relative: behind the tunnel the request's own URL names
   the server's host, not the one the browser used. */

const to = (path: string) => new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store' } })

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params
  const me = await tryAgent()
  if (!me) return to(`/support/sign-in?agent=1&next=${encodeURIComponent(`/support/workspace/notifications/go/${id}`)}`)
  let href = ''
  try {
    const payload = await getPayload({ config: configPromise })
    const r = await payload.find({ collection: 'support-notifications', where: { and: [{ id: { equals: id } }, { agentId: { equals: me.userId.toLowerCase() } }] }, limit: 1, depth: 0, overrideAccess: true })
    const row = r.docs[0] as { href?: string | null } | undefined
    if (row) {
      await markRead(me.userId, id)
      href = row.href ?? ''
    }
  } catch {
    /* the list then */
  }
  return to(/^\/support\/[^/]/.test(href) ? href : '/support/workspace/notifications')
}
