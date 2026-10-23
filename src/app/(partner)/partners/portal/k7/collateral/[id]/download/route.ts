import { collateralFileById, loadCollateralK7, serveCollateralFile } from '@/lib/partner/collateral'
import { tryK7 } from '@/lib/partner/session'

/* A collateral file for the Marketing Admin: any state, the newest version or `?file=<id>` for an earlier one, so what a
   partner would get can be checked before publishing. Not counted as a download. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await tryK7()
  if (!me) return new Response('Sign in first', { status: 401 })
  if (!me.roles.includes('marketingAdmin')) return new Response('Marketing Admins only', { status: 403 })
  const { id } = await params
  const item = await loadCollateralK7(id)
  if (!item) return new Response('Not found', { status: 404 })
  const url = new URL(req.url)
  const wanted = url.searchParams.get('file')
  const file = wanted ? await collateralFileById(item, wanted) : item.file
  if (!file) return new Response('Not found', { status: 404 })
  return serveCollateralFile(file, req, { inline: url.searchParams.get('inline') === '1' })
}
