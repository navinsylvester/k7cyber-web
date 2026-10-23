import { loadScheme, serveSchemeFile } from '@/lib/partner/schemes'
import { tryK7 } from '@/lib/partner/session'

/* The scheme's PDF for the desk: a Scheme Admin, any state. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await tryK7()
  if (!me) return new Response('Sign in first', { status: 401 })
  if (!me.roles.includes('schemeAdmin')) return new Response('Scheme Admins only', { status: 403 })
  const { id } = await params
  const sc = await loadScheme(id)
  if (!sc?.attachment) return new Response('Not found', { status: 404 })
  return serveSchemeFile(sc.attachment)
}
