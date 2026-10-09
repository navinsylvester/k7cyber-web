'use client'

import Link from 'next/link'
import React, { useState } from 'react'

type Option = { value: string; label: string }

/* The vulnerability filter form. A CVE number is specific enough on its own, so while one is typed the product list is locked. */
export const VulnFilters: React.FC<{
  path: string
  cve?: string
  product?: string
  severity?: string
  sort?: string
  dir?: string
  products: Option[]
  severities: Option[]
  exportHref: string
}> = ({ path, cve = '', product = '', severity = '', sort, dir, products, severities, exportHref }) => {
  const [cveValue, setCveValue] = useState(cve)
  const locked = cveValue.trim().length > 0
  const filtering = Boolean(cve || product || severity)
  return (
    <form className="filters" action={path} method="get" role="search" aria-label="Filter vulnerabilities">
      {sort && <input type="hidden" name="sort" value={sort} />}
      {dir && <input type="hidden" name="dir" value={dir} />}
      <div className="field" style={{ flexBasis: 260 }}>
        <label className="label" htmlFor="f-cve">
          CVE number
        </label>
        <span className="control">
          <input id="f-cve" name="cve" type="search" placeholder="CVE-2026-62820" autoComplete="off" value={cveValue} onChange={(e) => setCveValue(e.target.value)} />
        </span>
      </div>
      <div className="field">
        <label className="label" htmlFor="f-prod">
          Product
        </label>
        <span className="control is-select">
          <select id="f-prod" name="product" defaultValue={product} disabled={locked} aria-describedby={locked ? 'f-prod-note' : undefined}>
            <option value="">{locked ? 'Any product for this CVE' : 'All products'}</option>
            {products.map((p) => (
              <option value={p.value} key={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </span>
        {locked && (
          <span id="f-prod-note" className="sr-only">
            Product is not used while a CVE number is entered.
          </span>
        )}
      </div>
      <div className="field">
        <label className="label" htmlFor="f-sev">
          Severity
        </label>
        <span className="control is-select">
          <select id="f-sev" name="severity" defaultValue={severity}>
            <option value="">All severities</option>
            {severities.map((s) => (
              <option value={s.value} key={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </span>
      </div>
      <div className="filters-actions">
        <button className="btn btn-line btn-sm" type="submit">
          Apply
        </button>
        {filtering && (
          <Link className="link-u" href={path}>
            Clear filters
          </Link>
        )}
        <a className="btn btn-line btn-sm" href={exportHref}>
          Export CSV
        </a>
      </div>
    </form>
  )
}
