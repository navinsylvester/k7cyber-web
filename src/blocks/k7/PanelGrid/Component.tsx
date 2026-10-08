import Link from 'next/link'
import React from 'react'

import type { PanelGridBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { Sheet, SheetHead, type SheetMeta, bodyGap, withBold } from '@/components/k7/Sheet'

const cellStyle: React.CSSProperties = { background: 'var(--bg)', padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }
const plainList: React.CSSProperties = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15 }

export const PanelGrid: React.FC<PanelGridBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, cells, minWidth, actions }) => (
  <Sheet meta={meta} tabLabel={tabLabel} id={tabLabel?.toLowerCase().replace(/\W+/g, '-')}>
    <SheetHead headline={headline} dimClause={dimClause} lede={lede} />
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minWidth || 280}px), 1fr))`,
        gap: 1,
        background: 'var(--ln)',
        boxShadow: 'inset 0 0 0 1px var(--ln)',
        ...bodyGap,
      }}
    >
      {cells.map((c, i) => {
        const list = c.list ?? []
        const groups = c.tagGroups ?? []
        return (
          <div key={c.id ?? i} style={cellStyle}>
            <span className="label label-acc">{c.label}</span>
            {c.title && (
              <h3 className="h-block" style={{ fontSize: 24 }}>
                {c.title}
              </h3>
            )}
            {c.text && <p style={{ margin: 0, fontSize: c.listStyle === 'steps' ? 17 : 15, lineHeight: 1.5, color: c.listStyle === 'steps' ? undefined : 'var(--mu)' }}>{withBold(c.text)}</p>}
            {list.length > 0 &&
              (c.listStyle === 'steps' ? (
                <ol className="steps" style={{ fontSize: 15 }}>
                  {list.map((l, j) => (
                    <li key={l.id ?? j}>{l.text}</li>
                  ))}
                </ol>
              ) : (
                <ul style={plainList}>
                  {list.map((l, j) => (
                    <li key={l.id ?? j}>{l.text}</li>
                  ))}
                </ul>
              ))}
            {groups.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {groups.map((g, j) => (
                  <div key={g.id ?? j}>
                    {g.label && <span className="label muted">{g.label}</span>}
                    <div className="tags" style={{ marginTop: g.label ? 6 : 0 }}>
                      {(g.tags ?? []).map((t, k) => (
                        <span className="tag" key={t.id ?? k}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {c.linkLabel && c.linkUrl && (
              <Link className="link-u" href={c.linkUrl} style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>
                {c.linkLabel}
              </Link>
            )}
          </div>
        )
      })}
    </div>
    <Actions items={actions} style={{ marginTop: 32 }} />
  </Sheet>
)
