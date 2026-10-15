import { createReadStream, existsSync, statSync } from 'fs'
import path from 'path'
import { Readable } from 'stream'

import { evidenceById } from '@/lib/support/product'
import { tryAgent } from '@/lib/support/session'

const DIR = path.resolve(process.cwd(), 'uploads/product')

/* Evidence files are stored outside public/ and served only to a signed-in agent (10-product-desk.md §3.4). Phase C adds the signed,
   expiring link for engineers without a portal session. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await tryAgent()
  if (!me) return new Response('Sign in first', { status: 401 })
  const { id } = await params
  const file = await evidenceById(id)
  if (!file?.name) return new Response('Not found', { status: 404 })
  const full = path.join(DIR, file.name)
  if (!full.startsWith(DIR) || !existsSync(full)) return new Response('No file', { status: 404 })
  const inline = /^image\//.test(file.mime) || file.mime === 'application/pdf' || /^text\//.test(file.mime)
  return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, {
    headers: {
      'Content-Type': file.mime || 'application/octet-stream',
      'Content-Length': String(statSync(full).size),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${file.name.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
