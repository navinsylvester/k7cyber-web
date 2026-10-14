import Link from 'next/link'
import React from 'react'

import { fv, type Row } from '@/lib/dataverse/types'
import type { Care } from '@/lib/support/csat-model'
import { dmy, dmyHm } from '@/lib/support/format'
import type { ViewResult } from '@/lib/support/views'
import { cellValue } from '@/lib/support/views'

import { CareTag } from './Csat'
import { Pager, qs, SortHead, StatusTag, Tid } from './Parts'

/* The workspace ledger (DataTable): a saved view's columns as mono heads, the case number as the row link,
   dates DD-MM-YYYY in mono, status as a tag, Critical as the one signal mark. */

export const ViewTable: React.FC<{ result: ViewResult; path: string; base: Record<string, string | number | undefined>; caseHref: (id: string) => string; minWidth?: number; care?: Map<string, Care> }> = ({ result, path, base, caseHref, minWidth = 960, care }) => {
  const cols = result.columns
  const sortCol = result.sort ?? ''
  return (
    <>
      <div className="table-wrap">
        <table className="dtable" style={{ minWidth }}>
          <caption className="sr-only">Cases</caption>
          <thead>
            <tr>
              {cols.map((c) => (
                <SortHead key={c.name} col={c.name} label={c.label} current={sortCol} dir={result.dir} base={base} path={path} />
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 && (
              <tr className="empty">
                <td colSpan={cols.length}>No cases match.</td>
              </tr>
            )}
            {result.rows.map((row) => {
              const id = String(row.incidentid)
              return (
                <tr className="row" key={id}>
                  {cols.map((c, i) => (
                    <Cell key={c.name} row={row} name={c.name} kind={c.kind} href={i === 0 || c.name === 'ticketnumber' ? caseHref(id) : undefined} care={c.name === 'customerid' ? care?.get(String(row._customerid_value ?? '')) : undefined} />
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="ledger-foot label">
        <span>
          Page {result.page}
          {result.total !== undefined ? ` · ${result.total.toLocaleString('en-IN')}${result.totalLimitExceeded ? '+' : ''} cases` : ''}
        </span>
        <Pager page={result.page} totalPages={result.more ? result.page + 1 : result.page} href={(p) => path + qs(base, { page: p > 1 ? p : undefined })} label="Cases" newer="Previous" older="Next" />
      </div>
    </>
  )
}

const Cell: React.FC<{ row: Row; name: string; kind: ViewResult['columns'][number]['kind']; href?: string; care?: Care }> = ({ row, name, kind, href, care }) => {
  if (name === 'ticketnumber') {
    return (
      <td className="id">
        <Tid ticket={String(row.ticketnumber ?? '')} href={href} />
      </td>
    )
  }
  if (name === 'title') {
    return (
      <td className="title">
        {row.prioritycode === 696720000 && <i className="crit" aria-label="Critical" />}
        {href ? <Link href={href}>{String(row.title ?? '')}</Link> : String(row.title ?? '')}
      </td>
    )
  }
  if (kind === 'status') {
    return (
      <td className="status">
        <StatusTag row={row} />
      </td>
    )
  }
  if (kind === 'date') {
    const v = row[name]
    return (
      <td className="date" title={typeof v === 'string' ? dmyHm(v) : undefined}>
        {typeof v === 'string' ? dmy(v) : ''}
      </td>
    )
  }
  const v = cellValue(row, name)
  return (
    <td className="text">
      {care && <CareTag care={care} mark />}
      {href && v ? <Link href={href} style={{ textDecoration: 'none' }}>{v}</Link> : v}
    </td>
  )
}

/** Generic ledger for the other lists (contacts, accounts, RFEs...). */
export const Ledger: React.FC<{ heads: { label: string; k7?: boolean }[]; children: React.ReactNode; minWidth?: number; caption: string }> = ({ heads, children, minWidth = 720, caption }) => (
  <div className="table-wrap">
    <table className="dtable" style={{ minWidth }}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {heads.map((h) => (
            <th scope="col" key={h.label} className={h.k7 ? 'is-k7' : undefined}>
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
)

export const Formatted: React.FC<{ row: Row; field: string }> = ({ row, field }) => <>{fv(row, field)}</>
