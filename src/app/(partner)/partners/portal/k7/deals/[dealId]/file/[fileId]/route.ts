import { serveDealFile } from '@/lib/partner/deal-files'
import { dealFileById, findDealByNumber } from '@/lib/partner/deals'
import { tryK7 } from '@/lib/partner/session'

/* A deal's file for the K7 side: a signed-in K7 person holding the Deal Desk Approver or Channel Manager role, for the deal the
   file belongs to. */
export async function GET(_req: Request, { params }: { params: Promise<{ dealId: string; fileId: string }> }) {
  const me = await tryK7()
  if (!me) return new Response('Sign in first', { status: 401 })
  if (!me.roles.includes('dealDeskApprover') && !me.roles.includes('channelManager')) return new Response('No access', { status: 403 })
  const { dealId, fileId } = await params
  const [deal, file] = await Promise.all([findDealByNumber(dealId), dealFileById(fileId)])
  if (!deal || !file?.name || file.dealRowId !== deal.id) return new Response('Not found', { status: 404 })
  return serveDealFile(file)
}
