import configPromise from '@payload-config'
import { createReadStream, existsSync, statSync } from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import { Readable } from 'stream'

import type { ReportFile } from '@/payload-types'

import { leadToken } from '../../lead/route'

const REPORT_DIR = path.resolve(process.cwd(), 'uploads/reports')

/* FR-TR-03: PDFs are served from the site through this route. A gated report needs a valid lead token. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const url = new URL(req.url)
  const payload = await getPayload({ config: configPromise })
  const report = await payload.findByID({ collection: 'threat-reports', id, depth: 1 }).catch(() => null)
  if (!report || report._status !== 'published') return new Response('Not found', { status: 404 })

  if (report.gated) {
    const lead = Number(url.searchParams.get('lead'))
    const exp = Number(url.searchParams.get('exp'))
    const t = url.searchParams.get('t') ?? ''
    if (!lead || !exp || exp < Date.now() || t !== leadToken(id, lead, exp)) {
      return Response.redirect(new URL('/research/threat-reports', url.origin), 303)
    }
  }

  const file = report.pdf as ReportFile
  if (!file?.filename) return new Response('No file', { status: 404 })
  const full = path.join(REPORT_DIR, file.filename)
  if (!full.startsWith(REPORT_DIR) || !existsSync(full)) return new Response('No file', { status: 404 })

  await payload.update({ collection: 'threat-reports', id, data: { downloads: (report.downloads ?? 0) + 1 }, overrideAccess: true, context: { disableRevalidate: true } }).catch(() => null)
  const name = `${report.title}-${report.period}`.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pdf'
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(statSync(full).size),
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
