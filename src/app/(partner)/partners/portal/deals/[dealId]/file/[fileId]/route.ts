import { serveDealFile } from '@/lib/partner/deal-files'
import { dealFileById, loadDeal } from '@/lib/partner/deals'
import { tryPartner } from '@/lib/partner/session'

/* A deal's file for the partner side: only to a signed-in partner user whose scope owns the deal the file belongs to (the file row
   carries the deal and the organisation; both are checked). */
export async function GET(_req: Request, { params }: { params: Promise<{ dealId: string; fileId: string }> }) {
  const me = await tryPartner()
  if (!me) return new Response('Sign in first', { status: 401 })
  const { dealId, fileId } = await params
  const [deal, file] = await Promise.all([loadDeal(me.scope, dealId), dealFileById(fileId)])
  if (!deal || !file?.name || file.dealRowId !== deal.id || file.orgId !== me.scope.orgId) return new Response('Not found', { status: 404 })
  return serveDealFile(file)
}
