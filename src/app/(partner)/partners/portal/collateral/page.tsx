import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Library } from '@/components/partner/Collateral'
import { Empty, Field, Options } from '@/components/partner/Parts'
import { libraryFor, PARTNER_COLLATERAL } from '@/lib/partner/collateral'
import { COLLATERAL_CATEGORIES, COLLATERAL_CATEGORY_LABEL, COLLATERAL_KIND_LABEL, COLLATERAL_KINDS, groupLibrary } from '@/lib/partner/collateral-model'
import { requirePartner } from '@/lib/partner/session'

export const metadata: Metadata = { title: 'Collateral' }

type SP = { q?: string; product?: string; category?: string; kind?: string }

/* The collateral library for a partner (01-requirements.md §6): everything the organisation may read, by product and within
   that by category (FR-MKT-01), with a search and three filters. The rule of FR-MKT-03 is applied before the page sees an
   item and again on the download route. Every user of the organisation reads it; nobody uploads here. */
export default async function CollateralPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requirePartner(PARTNER_COLLATERAL)
  const filter = { q: sp.q?.trim() || undefined, productId: sp.product || undefined, category: COLLATERAL_CATEGORIES.includes(sp.category as never) ? sp.category : undefined, kind: COLLATERAL_KINDS.includes(sp.kind as never) ? sp.kind : undefined }
  const { all, items } = await libraryFor(me, filter)
  const filtered = Boolean(filter.q || filter.productId || filter.category || filter.kind)
  const groups = groupLibrary(items)
  const products = new Map<string, string>()
  for (const i of all) if (i.productId) products.set(i.productId, i.productName)
  const categories = COLLATERAL_CATEGORIES.filter((c) => all.some((i) => i.category === c))
  const kinds = COLLATERAL_KINDS.filter((k) => all.some((i) => i.file?.kind === k))
  const total = all.length
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">{me.org.tradeName || me.org.name} · collateral</span>
          <h1 className="h-util">Sales and brand material.</h1>
          <p className="lede">Brochures, datasheets, decks, case studies, logos and creatives from K7 marketing, by product and kind, always the current version. What you see follows your partner type, your country and regions{me.org.certificate.status === 'valid' ? ' and your certification' : ''}.</p>
        </div>
        <div className="ws-actions">
          <span className="hint">
            {String(total).padStart(2, '0')} item{total === 1 ? '' : 's'} for your organisation
          </span>
        </div>
      </div>

      <form className="lib-filters" action={PARTNER_COLLATERAL} method="get" role="search">
        <span className="control">
          <input name="q" type="search" placeholder="Title, product, tag, file name" defaultValue={sp.q ?? ''} aria-label="Search the library" />
          <button type="submit" aria-label="Search">
            →
          </button>
        </span>
        <div className="form-grid filters-grid">
          <Field id="product" label="Product" select>
            <select id="product" name="product" defaultValue={sp.product ?? ''}>
              <Options items={[{ value: 'none', label: 'K7 and the programme' }, ...[...products.entries()].map(([value, label]) => ({ value, label }))]} empty="Any" />
            </select>
          </Field>
          <Field id="category" label="Category" select>
            <select id="category" name="category" defaultValue={sp.category ?? ''}>
              <Options items={categories.map((c) => ({ value: c, label: COLLATERAL_CATEGORY_LABEL[c] }))} empty="Any" />
            </select>
          </Field>
          <Field id="kind" label="File type" select>
            <select id="kind" name="kind" defaultValue={sp.kind ?? ''}>
              <Options items={kinds.map((k) => ({ value: k, label: COLLATERAL_KIND_LABEL[k] }))} empty="Any" />
            </select>
          </Field>
          <div className="form-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Apply
            </button>
            {filtered && (
              <Link className="link-u" href={PARTNER_COLLATERAL}>
                Clear
              </Link>
            )}
          </div>
        </div>
      </form>

      {groups.length === 0 ? (
        <Empty label="Collateral">{filtered ? 'Nothing matches these filters.' : total === 0 ? 'Nothing has been published for your organisation yet. K7 marketing adds material here as the programme opens; you will find it under your products.' : 'Nothing in this view.'}</Empty>
      ) : (
        <Library groups={groups} href={(i) => `${PARTNER_COLLATERAL}/${i.id}`} download={(i) => `${PARTNER_COLLATERAL}/${i.id}/download`} />
      )}
    </section>
  )
}
