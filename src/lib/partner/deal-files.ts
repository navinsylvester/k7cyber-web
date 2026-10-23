import 'server-only'
import { createReadStream, existsSync, statSync } from 'fs'
import path from 'path'
import { Readable } from 'stream'

/* Serving a deal's file (M4): the rows live in `partner-deal-files`, the bytes under uploads/partner-deals outside public/, and
   the two routes (the partner's, checked through the scope; the K7 side's, checked through the approver role) call this once
   their check has passed. Images, PDFs and text open inline; anything else downloads. */

export const DEAL_FILE_DIR = path.resolve(process.cwd(), 'uploads/partner-deals')

export const serveDealFile = (file: { name: string; mime: string }): Response => {
  const full = path.join(DEAL_FILE_DIR, file.name)
  if (!full.startsWith(DEAL_FILE_DIR) || !existsSync(full)) return new Response('No file', { status: 404 })
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
