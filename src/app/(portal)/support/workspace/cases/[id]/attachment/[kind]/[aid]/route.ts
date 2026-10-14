import { isGuid } from '@/lib/dataverse/odata'
import { requireAgent } from '@/lib/support/session'
import { emailRegarding, getEmailAttachment, getNoteAttachment } from '@/lib/support/timeline'

/* Attachment download for the agent: the body is fetched only here, and only when the attachment belongs to this case. */

const notFound = () => new Response('Not found', { status: 404 })

const safeName = (name: string) => name.replace(/[^\w.\- ()]+/g, '_').slice(0, 150) || 'attachment'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; kind: string; aid: string }> }) {
  const { id, kind, aid } = await params
  const me = await requireAgent()
  if (!isGuid(id) || !isGuid(aid)) return notFound()
  let file: { name: string; mime: string; base64: string } | null = null
  try {
    if (kind === 'note') {
      const a = await getNoteAttachment(me.auth, aid)
      if (a && a.objectId.toLowerCase() === id.toLowerCase()) file = a
    } else if (kind === 'email') {
      const a = await getEmailAttachment(me.auth, aid)
      if (a) {
        const regarding = await emailRegarding(me.auth, a.activityId)
        if (regarding && regarding.toLowerCase() === id.toLowerCase()) file = a
      }
    }
  } catch {
    return notFound()
  }
  if (!file) return notFound()
  const bytes = Buffer.from(file.base64, 'base64')
  return new Response(bytes, {
    headers: {
      'Content-Type': file.mime || 'application/octet-stream',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${safeName(file.name)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
