import { tryPartner } from '@/lib/partner/session'
import { serveTrainingFile, trainingFileFor } from '@/lib/partner/training'

/* The only way to a training file (a module's uploaded video or document) for a partner: a signed-in user whose roles open
   the course, the file referenced by a published module. `?inline=1` opens it in the browser; a Range request gets the range
   (the video element asks for ranges). Anything else is a 404 without a hint. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await tryPartner()
  if (!me) return new Response('Sign in first', { status: 401 })
  const { id } = await params
  const file = await trainingFileFor(me, id)
  if (!file) return new Response('Not found', { status: 404 })
  const inline = new URL(req.url).searchParams.get('inline') === '1' || /^video\//.test(file.mime)
  return serveTrainingFile(file, req, { inline })
}
