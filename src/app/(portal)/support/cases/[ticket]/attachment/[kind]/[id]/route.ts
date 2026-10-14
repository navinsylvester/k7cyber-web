import { isGuid } from '@/lib/dataverse/odata'
import { getCustomerCase } from '@/lib/support/cases'
import { requireCustomer } from '@/lib/support/session'
import { emailRegarding, getEmailAttachment, getNoteAttachment } from '@/lib/support/timeline'

/* Attachment download for the customer: the case is loaded through their scope, then the file is checked to belong to it.
   Bodies are fetched only here (02-dataverse-integration.md §4b). */

export async function GET(_req: Request, { params }: { params: Promise<{ ticket: string; kind: string; id: string }> }): Promise<Response> {
  const { ticket: raw, kind, id } = await params
  const ticket = decodeURIComponent(raw).toUpperCase()
  if (!isGuid(id) || (kind !== 'note' && kind !== 'email')) return new Response('Not found', { status: 404 })
  const ctx = await requireCustomer(`/support/cases/${encodeURIComponent(ticket)}`)
  const c = await getCustomerCase(ctx.auth, ctx.scope, ticket)
  if (!c) return new Response('Not found', { status: 404 })

  let file: { name: string; mime: string; base64: string } | null = null
  if (kind === 'note') {
    const n = await getNoteAttachment(ctx.auth, id).catch(() => null)
    if (n && n.objectId.toLowerCase() === c.incidentid.toLowerCase()) file = n
  } else {
    const a = await getEmailAttachment(ctx.auth, id).catch(() => null)
    if (a) {
      const regarding = await emailRegarding(ctx.auth, a.activityId).catch(() => null)
      if (regarding && regarding.toLowerCase() === c.incidentid.toLowerCase()) file = a
    }
  }
  if (!file) return new Response('Not found', { status: 404 })

  const bytes = Buffer.from(file.base64, 'base64')
  const safeName = file.name.replace(/[^\w.\- ]+/g, '_')
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': file.mime || 'application/octet-stream',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
