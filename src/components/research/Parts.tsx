import Link from 'next/link'
import React from 'react'

import { Icon, type IconName } from '@/components/k7/Icon'
import { agoLabel, daysAgo, dmy, initials, iso } from '@/lib/research/format'
import type { Media } from '@/payload-types'

/* A1 · Utility header: data pages open compact so the data sits near the fold. */
export const UHead: React.FC<{ icon?: IconName; title: React.ReactNode; lede?: React.ReactNode; side?: React.ReactNode; back?: { href: string; label: string }; children?: React.ReactNode }> = ({ icon, title, lede, side, back, children }) => (
  <section className="sheet uhead g-panel">
    {back && (
      <Link className="backlink label" href={back.href}>
        <span aria-hidden="true">←</span>
        {back.label}
      </Link>
    )}
    {children ?? (
      <div className="uhead-grid">
        <div className="uhead-main">
          <div className="uhead-title">
            {icon && <Icon name={icon} />}
            <h1 className="h-util">{title}</h1>
          </div>
          {lede && <p className="lede">{lede}</p>}
        </div>
        {side && <div className="uhead-side">{side}</div>}
      </div>
    )}
  </section>
)

/* L3 · Freshness stamp: solid pixel within 7 days, blinking within a day. */
export const Fresh: React.FC<{ label?: string; date?: string | Date | null }> = ({ label, date }) => {
  if (!date) return null
  const days = daysAgo(date)
  return (
    <span className={`fresh${days <= 7 ? ' is-fresh' : ''}${days <= 1 ? ' is-live' : ''}`} data-date={iso(date)}>
      <span className="fresh-px" aria-hidden="true" />
      {label ? `${label} ` : ''}
      {dmy(date)}
      <span className="fresh-ago"> · {agoLabel(days)}</span>
    </span>
  )
}

export const StateTab: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="sheet-tab is-state label">{children}</div>

/* L2 · Level meter: severity in five cells, prevalence in two; only the top level is signal. */
const LEVEL: Record<string, number> = { critical: 5, high: 4, important: 4, medium: 3, low: 2, informative: 1 }
const LABEL: Record<string, string> = { critical: 'Critical', high: 'High', important: 'Important', medium: 'Medium', low: 'Low', informative: 'Informative' }
const Meter: React.FC<{ label: string; n: number; of: number; top: boolean }> = ({ label, n, of, top }) => (
  <span className={`sev${top ? ' is-top' : ''}`}>
    <span className="sev-cells" aria-hidden="true">
      {Array.from({ length: of }, (_, i) => (
        <i className={i < n ? 'on' : undefined} key={i} />
      ))}
    </span>
    {label}
    <span className="sr-only">, level {n} of {of}</span>
  </span>
)
export const Sev: React.FC<{ value: string }> = ({ value }) => <Meter label={LABEL[value] ?? value} n={LEVEL[value] ?? 1} of={5} top={value === 'critical'} />
export const Prev: React.FC<{ value: string }> = ({ value }) => <Meter label={value === 'high' ? 'High' : 'Low'} n={value === 'high' ? 2 : 1} of={2} top={value === 'high'} />

/* L1 · Identifiers: the unique part reads first. */
export const LidCve: React.FC<{ id: string }> = ({ id }) => {
  const i = id.lastIndexOf('-')
  if (i < 0) return <span className="lid">{id}</span>
  return (
    <span className="lid">
      <span className="pre">{id.slice(0, i + 1)}</span>
      {id.slice(i + 1)}
    </span>
  )
}
export const LidDet: React.FC<{ name: string; href?: string }> = ({ name, href }) => {
  const m = name.match(/^(.*?)\s*\((.*)\)\s*$/)
  const inner = m ? (
    <>
      {m[1]} <span className="pre">({m[2]!.trim()})</span>
    </>
  ) : (
    name
  )
  return href ? (
    <Link className="lid lid-det" href={href}>
      {inner}
    </Link>
  ) : (
    <span className="lid lid-det">{inner}</span>
  )
}

export const Hash: React.FC<{ value: string; id?: string }> = ({ value, id }) => (
  <span className="hash" id={id} data-hash={value} aria-label={value}>
    {Array.from({ length: Math.ceil(value.length / 4) }, (_, i) => (
      <span key={i}>{value.slice(i * 4, i * 4 + 4)}</span>
    ))}
  </span>
)

export const Avatar: React.FC<{ name: string; photo?: Media | number | null; large?: boolean }> = ({ name, photo, large }) => {
  const url = photo && typeof photo === 'object' ? (photo.sizes?.square?.url ?? photo.url) : null
  return (
    <span className={`avatar${large ? ' avatar-l' : ''}`} aria-hidden="true">
      {url ? <img src={url} alt="" /> : initials(name)}
    </span>
  )
}

export const Placeholder: React.FC<{ caption?: string; ratio?: string; className?: string; image?: Media | number | null; size?: 'small' | 'medium' | 'large' | 'thumbnail' }> = ({ caption, ratio, className = '', image, size = 'medium' }) => {
  const url = image && typeof image === 'object' ? (image.sizes?.[size]?.url ?? image.url) : null
  return (
    <figure className={`ph ${className}`} style={ratio ? ({ '--ar': ratio } as React.CSSProperties) : undefined} aria-hidden={url ? undefined : true}>
      {url ? <img src={url} alt={(image as Media).alt ?? ''} loading="lazy" /> : caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}

/** Query-string pager that keeps the other parameters. */
export const Pager: React.FC<{ page: number; totalPages: number; href: (page: number) => string; label: string; count?: string; newer?: string; older?: string }> = ({ page, totalPages, href, label, count, newer = 'Previous', older = 'Next' }) => {
  if (totalPages <= 1) return null
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages))
  const list = [...pages].sort((a, b) => a - b)
  return (
    <nav className="pager" aria-label={label}>
      {page > 1 ? <Link href={href(page - 1)}>{newer}</Link> : <span className="is-disabled">{newer}</span>}
      {list.map((n, i) => (
        <React.Fragment key={n}>
          {i > 0 && list[i - 1]! < n - 1 && <span className="gap">…</span>}
          {n === page ? <span aria-current="page">{n}</span> : <Link href={href(n)}>{n}</Link>}
        </React.Fragment>
      ))}
      {page < totalPages ? <Link href={href(page + 1)}>{older}</Link> : <span className="is-disabled">{older}</span>}
      {count && <span className="count label">{count}</span>}
    </nav>
  )
}

/** Build a query string from the current filters, overriding some keys. */
export const qs = (base: Record<string, string | number | undefined>, over: Record<string, string | number | undefined> = {}): string => {
  const all = { ...base, ...over }
  const parts = Object.entries(all)
    .filter(([, v]) => v !== undefined && v !== '' && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

/** A sortable column head: a link that flips direction when already sorted. */
export const SortHead: React.FC<{ col: string; label: string; current: string; dir: 'asc' | 'desc'; base: Record<string, string | number | undefined>; path: string }> = ({ col, label, current, dir, base, path }) => {
  const on = current === col
  const next = on ? (dir === 'desc' ? 'asc' : 'desc') : col === 'date' || col === 'seen' ? 'desc' : 'asc'
  return (
    <th scope="col" {...(on ? { 'aria-sort': dir === 'desc' ? 'descending' : 'ascending' } : {})}>
      <Link href={path + qs(base, { sort: col, dir: next, page: undefined })}>{label}</Link>
    </th>
  )
}
