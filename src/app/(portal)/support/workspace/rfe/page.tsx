import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Ledger } from '@/components/support/Ledger'
import { Field, PageHead } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv, lookup } from '@/lib/dataverse/types'
import { dmy } from '@/lib/support/format'
import { listDefects, listRfes } from '@/lib/support/rfe'
import { requireAgent } from '@/lib/support/session'

export const metadata: Metadata = { title: 'RFEs' }

const PATH = `${WS}/rfe`

/* Requests for enhancement, live; defects, dormant since 2020 and read-only (01-requirements.md §4.5). */
export default async function RfePage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const q = sp.q?.trim() ?? ''
  const kind = sp.kind === 'defects' ? 'defects' : 'rfes'
  const href = (k: string) => `${PATH}?kind=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  const rows = kind === 'rfes' ? await listRfes(me.auth, { q, top: 50 }) : await listDefects(me.auth, { q, top: 50 })
  return (
    <>
      <WorkspaceBar active="rfe" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">{kind === 'rfes' ? 'RFEs' : 'Defects'} · {rows.length} shown</span>}
          title={kind === 'rfes' ? 'Requests for enhancement.' : 'Defects.'}
          lede={kind === 'rfes' ? 'What customers and the desk have asked the product teams for, with the YODIZ reference where one exists.' : 'Product defects raised from cases. The list has been dormant since 2020 and is read-only here.'}
          actions={
            kind === 'rfes' ? (
              <Link className="btn btn-primary btn-sm" href={`${PATH}/new`}>
                New RFE →
              </Link>
            ) : undefined
          }
        />
        <form className="filters-inline" action={PATH} method="get" role="search">
          <input type="hidden" name="kind" value={kind} />
          <Field id="q" label={kind === 'rfes' ? 'Title, number or YODIZ id' : 'Title or number'}>
            <input id="q" name="q" type="search" defaultValue={q} placeholder={kind === 'rfes' ? 'RFE-' : 'DEF-'} autoComplete="off" />
          </Field>
          <div className="seg seg-l" role="group" aria-label="Kind">
            <Link href={href('rfes')} aria-pressed={kind === 'rfes'}>
              RFEs
            </Link>
            <Link href={href('defects')} aria-pressed={kind === 'defects'}>
              Defects
            </Link>
          </div>
          <div className="filters-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Search
            </button>
            {q && (
              <Link className="link-u" href={href(kind)}>
                Clear
              </Link>
            )}
          </div>
        </form>
        {kind === 'rfes' ? (
          <Ledger caption="Requests for enhancement" heads={[{ label: 'Number' }, { label: 'Title' }, { label: 'Status' }, { label: 'Type' }, { label: 'Case' }, { label: 'YODIZ' }, { label: 'Modified' }]} minWidth={900}>
            {rows.length === 0 && (
              <tr className="empty">
                <td colSpan={7}>No RFEs match.</td>
              </tr>
            )}
            {rows.map((r) => {
              const id = String(r.k7_rfeid)
              const c = lookup(r, 'k7_case') ?? lookup(r, 'k7_associatedcaseno')
              return (
                <tr className="row" key={id}>
                  <td className="id">
                    <Link className="lid" href={`${PATH}/${id}`}>
                      {String(r.k7_rfeno ?? '') || '—'}
                    </Link>
                  </td>
                  <td className="title">
                    <Link href={`${PATH}/${id}`}>{String(r.k7_rfetitle ?? '')}</Link>
                  </td>
                  <td className="status">
                    <span className={`tag${/^open|in-progress/i.test(fv(r, 'k7_rfestatus')) ? ' tag-solid' : ''}`}>{fv(r, 'k7_rfestatus') || '—'}</span>
                  </td>
                  <td className="text">{fv(r, 'k7_rfetype')}</td>
                  <td className="text">{c ? <Link href={`${WS}/cases/${c.id}`}>{c.name}</Link> : ''}</td>
                  <td className="ver">{String(r.k7_yodizid ?? '')}</td>
                  <td className="date">{dmy(String(r.modifiedon ?? ''))}</td>
                </tr>
              )
            })}
          </Ledger>
        ) : (
          <Ledger caption="Defects" heads={[{ label: 'Number' }, { label: 'Title' }, { label: 'Status' }, { label: 'Priority' }, { label: 'Case' }, { label: 'YODIZ' }, { label: 'Modified' }]} minWidth={900}>
            {rows.length === 0 && (
              <tr className="empty">
                <td colSpan={7}>No defects match.</td>
              </tr>
            )}
            {rows.map((d) => {
              const c = lookup(d, 'k7_associatedcaseno')
              return (
                <tr className="row" key={String(d.k7_defectid)}>
                  <td className="id">
                    <span className="lid">{String(d.k7_defectno ?? '') || '—'}</span>
                  </td>
                  <td className="title">{String(d.k7_defecttitle ?? '')}</td>
                  <td className="status">
                    <span className="tag">{fv(d, 'k7_defectstatus') || '—'}</span>
                  </td>
                  <td className="text">{fv(d, 'k7_priority')}</td>
                  <td className="text">{c ? <Link href={`${WS}/cases/${c.id}`}>{c.name}</Link> : ''}</td>
                  <td className="ver">{String(d.k7_yodizid ?? '')}</td>
                  <td className="date">{dmy(String(d.modifiedon ?? ''))}</td>
                </tr>
              )
            })}
          </Ledger>
        )}
      </section>
    </>
  )
}
