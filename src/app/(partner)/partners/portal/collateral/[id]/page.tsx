import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { CategoryTag, FileTag } from '@/components/partner/Collateral'
import { Strip } from '@/components/partner/Parts'
import { loadCollateralFor, PARTNER_COLLATERAL } from '@/lib/partner/collateral'
import { COLLATERAL_KIND_LABEL } from '@/lib/partner/collateral-model'
import { requirePartner } from '@/lib/partner/session'
import { dmy } from '@/lib/support/format'

export const metadata: Metadata = { title: 'Collateral' }

/* One item of the library: what it is, the current version and its note, the file, the download. Reached only for an item the
   organisation may read (the same rule as the list); anything else is a 404, never a hint that it exists. */
export default async function CollateralItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await requirePartner(`${PARTNER_COLLATERAL}/${id}`)
  const item = await loadCollateralFor(me, id)
  if (!item || !item.file) notFound()
  const f = item.file
  const inline = /^image\//.test(f.mime) || f.mime === 'application/pdf' || /^video\//.test(f.mime)
  const download = `${PARTNER_COLLATERAL}/${item.id}/download`
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">
            <Link className="link-u" href={PARTNER_COLLATERAL}>
              Collateral
            </Link>{' '}
            · {item.productId ? item.productName : 'K7 and the programme'}
          </span>
          <h1 className="h-util">{item.title}.</h1>
          {item.description ? <p className="lede">{item.description}</p> : null}
        </div>
        <div className="ws-actions">
          <a className="btn btn-primary" href={download}>
            Download {COLLATERAL_KIND_LABEL[f.kind]} →
          </a>
          {inline ? (
            <a className="link-u" href={`${download}?inline=1`} target="_blank" rel="noopener">
              Open in the browser
            </a>
          ) : null}
        </div>
      </div>
      <Strip
        items={[
          { label: 'Category', value: <CategoryTag category={item.category} /> },
          { label: 'Version', value: `v${f.version}${item.versions > 1 ? ` · ${item.versions} so far` : ''}` },
          { label: 'File', value: <FileTag name={f.name} size={f.size} kind={f.kind} /> },
          { label: 'Updated', value: dmy(f.at) },
        ]}
      />
      <div className="phome">
        <div>
          {f.note ? (
            <>
              <h2>What changed in v{f.version}</h2>
              <p className="lede" style={{ fontSize: 17 }}>
                {f.note}
              </p>
            </>
          ) : (
            <>
              <h2>Using it</h2>
              <p className="lede" style={{ fontSize: 17 }}>
                This is the current version; earlier copies you downloaded are superseded. K7 marketing keeps the item here as long as it is valid and retires it when it is not.
              </p>
            </>
          )}
        </div>
        <aside className="ws-side">
          <div>
            <h2>Filed under</h2>
            <dl className="meta-rows">
              <dt>Product</dt>
              <dd className="sans">{item.productId ? `${item.productName}${item.productFamily ? ` · ${item.productFamily}` : ''}` : 'K7 and the programme'}</dd>
              <dt>Category</dt>
              <dd className="sans">
                <CategoryTag category={item.category} />
              </dd>
              {item.tags.length ? (
                <>
                  <dt>Tags</dt>
                  <dd className="sans">{item.tags.join(', ')}</dd>
                </>
              ) : null}
              <dt>File name</dt>
              <dd>{f.name}</dd>
              {item.publishedAt ? (
                <>
                  <dt>Published</dt>
                  <dd className="sans">{dmy(item.publishedAt)}</dd>
                </>
              ) : null}
            </dl>
            <p className="more">
              <Link className="link-u" href={`${PARTNER_COLLATERAL}${item.productId ? `?product=${item.productId}` : '?product=none'}`}>
                More for this product →
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
