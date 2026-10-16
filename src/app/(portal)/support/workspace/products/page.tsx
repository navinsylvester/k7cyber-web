import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Field, PageHead } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getProducts } from '@/lib/support/reference'
import { requireAgent } from '@/lib/support/session'

export const metadata: Metadata = { title: 'Products' }

const PATH = `${WS}/products`

/* The catalogue, read-only (01-requirements.md §4.5): active SKUs grouped by family, the marketing name beside the CRM name. */
export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const q = sp.q?.trim() ?? ''
  const all = await getProducts(me.auth)
  const needle = q.toLowerCase()
  const rows = needle ? all.filter((p) => p.name.toLowerCase().includes(needle) || p.marketingName.toLowerCase().includes(needle) || p.number.toLowerCase().includes(needle) || p.family.toLowerCase().includes(needle)) : all
  const sorted = [...rows].sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name))
  const families = new Map<string, number>()
  sorted.forEach((p) => families.set(p.family, (families.get(p.family) ?? 0) + 1))
  return (
    <>
      <WorkspaceBar active="products" />
      <section className="sheet ws g-paper">
        <PageHead above={<span className="label muted">Products · {all.length} active · {families.size} families</span>} title="Product catalogue." lede="Every active SKU the desk can put on a case, grouped by product family. The catalogue itself is maintained in Dynamics." />
        <form className="filters-inline" action={PATH} method="get" role="search">
          <Field id="q" label="Name, marketing name, family or number">
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Total Security" autoComplete="off" />
          </Field>
          <div className="filters-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Filter
            </button>
            {q && (
              <Link className="link-u" href={PATH}>
                Clear
              </Link>
            )}
          </div>
        </form>
        <div className="ledger filed">
          <div className="ftab label">
            Showing {sorted.length} of {all.length} · grouped by family
          </div>
        <div className="table-wrap">
          <table className="dtable" style={{ minWidth: 760 }} data-grouped="">
            <caption className="sr-only">Products</caption>
            <thead>
              <tr>
                <th scope="col">Product name (CRM)</th>
                <th scope="col">Marketing name</th>
                <th scope="col">Number</th>
                <th scope="col">Users</th>
                <th scope="col">Years</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr className="empty">
                  <td colSpan={5}>No products match.</td>
                </tr>
              )}
              {sorted.map((p, i) => {
                const head = i === 0 || sorted[i - 1]!.family !== p.family
                return (
                  <React.Fragment key={p.id}>
                    {head && (
                      <tr className="batch">
                        <th colSpan={5} scope="colgroup" className="label">
                          <span>
                            {p.family}
                            <em>
                              {families.get(p.family)} {families.get(p.family) === 1 ? 'SKU' : 'SKUs'}
                            </em>
                          </span>
                        </th>
                      </tr>
                    )}
                    <tr className="row">
                      <td className="title">{p.name}</td>
                      <td className="text">{p.marketingName !== p.name ? p.marketingName : <span className="muted">same</span>}</td>
                      <td className="ver">{p.number}</td>
                      <td className="num">{p.users || '—'}</td>
                      <td className="num">{p.years || '—'}</td>
                    </tr>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        </div>
      </section>
    </>
  )
}
