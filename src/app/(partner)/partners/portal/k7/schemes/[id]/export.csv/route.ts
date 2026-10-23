import { financeRows, loadScheme } from '@/lib/partner/schemes'
import { financeCsv } from '@/lib/partner/schemes-model'
import { tryK7 } from '@/lib/partner/session'

/* The Finance export (FR-ELG-07): every result of a scheme with the partner, scheme and benefit fields, as CSV, to a Scheme
   Admin only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await tryK7()
  if (!me) return new Response('Sign in first', { status: 401 })
  if (!me.roles.includes('schemeAdmin')) return new Response('Scheme Admins only', { status: 403 })
  const { id } = await params
  const sc = await loadScheme(id)
  if (!sc) return new Response('Not found', { status: 404 })
  const csv = financeCsv(await financeRows(sc))
  const name = `${sc.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'scheme'}-results.csv`
  return new Response(`﻿${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'private, no-store' } })
}
