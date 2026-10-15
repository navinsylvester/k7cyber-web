import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'

/* The RFE and defect lists live under the product desk since the merge of 2026-10-14 (09-portal-guide.md §4f); old links land there. */
export default async function RfeRedirect({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const sp = await searchParams
  const view = sp.kind === 'defects' ? 'defects' : 'rfes'
  redirect(`${WS}/product?view=${view}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`)
}
