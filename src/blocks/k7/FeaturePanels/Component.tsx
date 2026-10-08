import Link from 'next/link'
import React from 'react'

import type { FeaturePanelsBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { Icon } from '@/components/k7/Icon'
import { Sheet, SheetHead, type SheetMeta, bodyGap, withBold } from '@/components/k7/Sheet'

type Panel = FeaturePanelsBlock['panels'][number]

const Cover: React.FC<{ c: Panel['cover'] }> = ({ c }) => (
  <div className="cover" style={{ alignSelf: 'start', maxWidth: 260 }}>
    <div className="cover-top">
      <Icon name="archive" className="licon" />
      {c?.brand}
    </div>
    <div className="cover-series">{c?.series}</div>
    <div className="cover-period">
      <span className="yr">{c?.period}</span>
      {c?.year}
      <span className="sig" />
    </div>
    <div className="cover-foot">
      <span>{c?.footLeft}</span>
      <span>{c?.footRight}</span>
    </div>
  </div>
)

const Body: React.FC<{ p: Panel }> = ({ p }) => (
  <div className="feature-body">
    {p.label && <span className="label label-acc">{p.label}</span>}
    <h3 className="h-title">{p.title}</h3>
    {p.text && <p>{withBold(p.text)}</p>}
    {(p.bullets?.length ?? 0) > 0 && (
      <ul>
        {p.bullets!.map((b, i) => (
          <li key={b.id ?? i}>{b.text}</li>
        ))}
      </ul>
    )}
    <Actions items={p.links} />
  </div>
)

const Aside: React.FC<{ p: Panel }> = ({ p }) => {
  const a = p.aside
  const list = a?.list ?? []
  const tags = a?.tags ?? []
  if (!list.length && !tags.length) return null
  return (
    <div className="feature-body" style={{ gap: 24 }}>
      {list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {a?.listLabel && <span className="label muted">{a.listLabel}</span>}
          <ul style={{ margin: 0 }}>
            {list.map((l, i) => (
              <li key={l.id ?? i}>{l.text}</li>
            ))}
          </ul>
        </div>
      )}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {a?.tagsLabel && <span className="label muted">{a.tagsLabel}</span>}
          <div className="tags">
            {tags.map((t, i) => (
              <span className="tag" key={t.id ?? i}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const FeaturePanels: React.FC<FeaturePanelsBlock & { meta: SheetMeta }> = (b) => {
  const many = b.panels.length > 1
  return (
    <Sheet meta={b.meta} tabLabel={b.tabLabel} id={b.tabLabel?.toLowerCase().replace(/\W+/g, '-')}>
      <SheetHead headline={b.headline} dimClause={b.dimClause} lede={b.lede} />
      <div style={many ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 24, ...bodyGap } : bodyGap}>
        {b.panels.map((p, i) => (
          <article
            className={`feature two${p.onPanel ? ' on-panel' : ''}`}
            key={p.id ?? i}
            style={p.onPanel ? undefined : ({ '--t-bg': 'var(--paper)', '--t-fg': 'var(--ink)' } as React.CSSProperties)}
          >
            {p.media === 'placeholder' && (
              <figure className="ph" style={{ '--ar': p.ratio || '4/3' } as React.CSSProperties}>
                <figcaption>{p.caption}</figcaption>
              </figure>
            )}
            {p.media === 'cover' && <Cover c={p.cover} />}
            <Body p={p} />
            {p.media === 'none' && <Aside p={p} />}
          </article>
        ))}
      </div>
      {(b.stats?.length ?? 0) > 0 && (
        <div className="conf-list" style={bodyGap}>
          {b.stats!.map((s, i) => (
            <div key={s.id ?? i}>
              <span className="n num">{s.n}</span>
              <span className="d">{s.d}</span>
            </div>
          ))}
        </div>
      )}
      {(b.rows?.length ?? 0) > 0 && (
        <div className="ilist" style={{ marginTop: 24 }}>
          {b.rows!.map((r, i) => (
            <Link className="irow irow-grid" href={r.url} key={r.id ?? i}>
              <span className="n">{String(i + b.panels.length + 1).padStart(2, '0')}</span>
              <span className="irow-title">{r.title}</span>
              <span className="desc">{r.description}</span>
              <span className="arrow">{b.rowArrow || '→'}</span>
            </Link>
          ))}
        </div>
      )}
      <Actions items={b.actions} style={{ marginTop: 32 }} />
    </Sheet>
  )
}
