import configPromise from '@payload-config'
import { createHmac } from 'crypto'
import { getPayload } from 'payload'

export const leadToken = (reportId: number, leadId: number, exp: number) =>
  createHmac('sha256', process.env.PAYLOAD_SECRET ?? '').update(`${reportId}.${leadId}.${exp}`).digest('hex').slice(0, 32)

/* FR-TR-05: records the lead and answers with a short-lived download URL for the gated PDF. */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 })
  }
  const report = Number(body.report)
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const company = String(body.company ?? '').trim()
  const country = String(body.country ?? '').trim()
  const consent = body.consent === true || body.consent === 'on'
  if (!report || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !company || !country || !consent) {
    return Response.json({ error: 'Please complete every field.' }, { status: 422 })
  }
  const payload = await getPayload({ config: configPromise })
  const doc = await payload.findByID({ collection: 'threat-reports', id: report, depth: 0 }).catch(() => null)
  if (!doc || doc._status !== 'published') return Response.json({ error: 'Report not found.' }, { status: 404 })
  const lead = await payload.create({ collection: 'report-leads', data: { name, email, company, country, consent, report }, overrideAccess: true })
  const exp = Date.now() + 15 * 60 * 1000
  const url = `/research/threat-reports/download/${report}?lead=${lead.id}&exp=${exp}&t=${leadToken(report, lead.id, exp)}`
  return Response.json({ url })
}
