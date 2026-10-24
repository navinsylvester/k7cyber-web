import { certificateBytes, loadCertificate, servePdf } from '@/lib/partner/certificates'
import { tryK7 } from '@/lib/partner/session'

/* The certificate PDF for K7 (Channel Managers and Training Admins): any organisation's, drawn again if the stored file is gone. */
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await tryK7()
  if (!me || !me.roles.some((r) => r === 'channelManager' || r === 'trainingAdmin')) return new Response('Sign in', { status: 401 })
  const { id } = await params
  const c = await loadCertificate(id)
  if (!c) return new Response('No certificate', { status: 404 })
  const file = await certificateBytes(c)
  if (!file) return new Response('No file', { status: 404 })
  return servePdf(file, { inline: new URL(req.url).searchParams.get('download') !== '1' })
}
