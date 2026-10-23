import 'server-only'
import { createReadStream, existsSync, statSync } from 'fs'
import path from 'path'
import { Readable } from 'stream'

import { parseRange } from './collateral-model'

/* One way to serve a stored file after the caller's session check (M6 collateral, M7 scheme documents, M10 training files):
   whole, or the one range the request asked for (206), so a 200 MB video plays and a download resumes. Images, PDFs and video
   open inline when asked; everything else downloads. The directory is outside public/; a name that escapes it is a 404. */

const INLINE = (mime: string): boolean => /^image\//.test(mime) || mime === 'application/pdf' || /^video\//.test(mime)

export const serveStoredFile = (dir: string, file: { name: string; mime: string }, req: Request, o: { inline?: boolean } = {}): Response => {
  const full = path.join(dir, file.name)
  if (!full.startsWith(dir + path.sep) || !existsSync(full)) return new Response('No file', { status: 404 })
  const size = statSync(full).size
  const mime = file.mime || 'application/octet-stream'
  const range = parseRange(req.headers.get('range'), size)
  if (range === 'invalid') return new Response('Range not satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' } })
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Content-Disposition': `${o.inline && INLINE(mime) ? 'inline' : 'attachment'}; filename="${file.name.replace(/"/g, '')}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  }
  if (range) {
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`
    headers['Content-Length'] = String(range.end - range.start + 1)
    return new Response(Readable.toWeb(createReadStream(full, { start: range.start, end: range.end })) as ReadableStream, { status: 206, headers })
  }
  headers['Content-Length'] = String(size)
  return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, { status: 200, headers })
}
