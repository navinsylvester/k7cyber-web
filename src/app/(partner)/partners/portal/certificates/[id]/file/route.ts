import { certificateBytes, loadCertificateFor, servePdf } from '@/lib/partner/certificates'
import { tryPartner } from '@/lib/partner/session'

/* The certificate PDF for the partner (FR-TRN-08, FR-CRT-04): the signed-in user's own, the organisation's, or any of the
   organisation's for a Partner Admin, through the scope; drawn again if the stored file is gone. Anything else is 401 or 404
   without a hint. */
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await tryPartner()
  if (!me) return new Response('Sign in', { status: 401 })
  const { id } = await params
  const c = await loadCertificateFor(me, id)
  if (!c) return new Response('No certificate', { status: 404 })
  const file = await certificateBytes(c)
  if (!file) return new Response('No file', { status: 404 })
  return servePdf(file, { inline: new URL(req.url).searchParams.get('download') !== '1' })
}
