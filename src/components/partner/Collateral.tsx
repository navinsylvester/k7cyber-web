import Link from 'next/link'
import React from 'react'

import { COLLATERAL_CATEGORY_LABEL, COLLATERAL_KIND_LABEL, COLLATERAL_STATUS_LABEL, fileExt, type CollateralItem, type CollateralStatus, type LibraryGroup } from '@/lib/partner/collateral-model'
import { bytes, dmy } from '@/lib/support/format'

/* The collateral library's parts (design system section 10, P20–P21): the file kind tag, the item's state for K7, and the
   library itself, grouped by product and category, each item one row with the download as its action. */

/** P21 The file tag: the extension in mono with the size, the way the deal thread shows an attachment. */
export const FileTag: React.FC<{ name: string; size: number; kind: string }> = ({ name, size, kind }) => (
  <span className="tag ftag" title={COLLATERAL_KIND_LABEL[kind as keyof typeof COLLATERAL_KIND_LABEL] ?? 'File'}>
    {fileExt(name) || 'FILE'}
    {size ? <span className="muted">{bytes(size)}</span> : null}
  </span>
)

/** The item's state on the K7 ledger: Published solid, Draft dashed, Retired closed. Never signal: nobody must act on it. */
export const CollateralStateTag: React.FC<{ status: CollateralStatus }> = ({ status }) => <span className={status === 'published' ? 'tag tag-solid' : status === 'retired' ? 'tag tag-closed' : 'tag tag-dashed'}>{COLLATERAL_STATUS_LABEL[status]}</span>

export const CategoryTag: React.FC<{ category: CollateralItem['category'] }> = ({ category }) => <span className="tag tag-state">{COLLATERAL_CATEGORY_LABEL[category]}</span>

/** P20 The library: one filed ledger per product, the categories as bands inside it, each item a row: title and description,
    version, the file, when it changed, Download. */
export const Library: React.FC<{ groups: LibraryGroup[]; href: (item: CollateralItem) => string; download: (item: CollateralItem) => string }> = ({ groups, href, download }) => (
  <div className="library">
    {groups.map((g) => (
      <section className="filed ledger lib-group" key={g.key || 'programme'} aria-labelledby={`lib-${g.key || 'programme'}`}>
        <span className="ftab label" id={`lib-${g.key || 'programme'}`}>
          {g.product}
          {g.family ? <span className="muted"> · {g.family}</span> : null}
        </span>
        <div className="table-wrap">
          <table className="dtable lib-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Version</th>
                <th scope="col">File</th>
                <th scope="col">Updated</th>
                <th scope="col" className="num">
                  <span className="sr-only">Download</span>
                </th>
              </tr>
            </thead>
            {g.categories.map((c) => (
              <tbody key={c.category}>
                <tr className="lib-band">
                  <th scope="rowgroup" colSpan={5}>
                    <span className="pixel" aria-hidden="true" /> {COLLATERAL_CATEGORY_LABEL[c.category]}
                    <span className="muted"> · {String(c.items.length).padStart(2, '0')}</span>
                  </th>
                </tr>
                {c.items.map((i) => (
                  <tr className="row" key={i.id}>
                    <td className="title">
                      <Link href={href(i)}>{i.title}</Link>
                      {i.description ? <div className="muted lib-desc">{i.description}</div> : null}
                      {i.tags.length ? <div className="lib-tags">{i.tags.map((t) => `#${t}`).join(' ')}</div> : null}
                    </td>
                    <td className="num">v{i.file?.version ?? '—'}</td>
                    <td className="text">{i.file ? <FileTag name={i.file.name} size={i.file.size} kind={i.file.kind} /> : <span className="muted">—</span>}</td>
                    <td className="num" title={i.file?.at ?? ''}>
                      {i.file ? dmy(i.file.at) : '—'}
                    </td>
                    <td className="num lib-act">
                      <a className="btn btn-line btn-sm" href={download(i)}>
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    ))}
  </div>
)
