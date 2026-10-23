import { loadCollateralFor, recordDownload, serveCollateralFile } from '@/lib/partner/collateral'
import { tryPartner } from '@/lib/partner/session'

/* The only way to a collateral file for a partner: a signed-in partner user whose organisation may read the item (published,
   with a file, the visibility rule holding), the newest version, one audit row per download. `?inline=1` opens a PDF, an
   image or a video in the browser; a Range request gets the range (video, resumed downloads). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await tryPartner()
  if (!me) return new Response('Sign in first', { status: 401 })
  const { id } = await params
  const item = await loadCollateralFor(me, id)
  if (!item || !item.file) return new Response('Not found', { status: 404 })
  const inline = new URL(req.url).searchParams.get('inline') === '1'
  // A Range request past the first is the same download continuing; count it once.
  if (!req.headers.get('range') || req.headers.get('range')?.startsWith('bytes=0-')) await recordDownload(me, item, item.file)
  return serveCollateralFile(item.file, req, { inline })
}
