import { loadSchemeFor, serveSchemeFile } from '@/lib/partner/schemes'
import { tryPartner } from '@/lib/partner/session'

/* The scheme's PDF for the partner side: only to a signed-in partner user whose organisation may see the scheme (the same rule
   as the list), inline. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await tryPartner()
  if (!me) return new Response('Sign in first', { status: 401 })
  const { id } = await params
  const view = await loadSchemeFor(me, id)
  if (!view?.scheme.attachment) return new Response('Not found', { status: 404 })
  return serveSchemeFile(view.scheme.attachment)
}
