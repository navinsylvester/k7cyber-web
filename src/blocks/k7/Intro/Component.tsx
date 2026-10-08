import React from 'react'

import type { IntroBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { Sheet, SheetHead, type SheetMeta, bodyGap, withBold } from '@/components/k7/Sheet'

const cell: React.CSSProperties = { background: 'var(--bg)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }
const list: React.CSSProperties = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15 }

export const Intro: React.FC<IntroBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, paragraphs, figure, coverage, actions }) => {
  const cells = figure?.cells ?? []
  const tags = coverage?.tags ?? []
  return (
    <Sheet meta={meta} tabLabel={tabLabel} id="overview">
      <SheetHead headline={headline} dimClause={dimClause} lede={lede} />

      {(paragraphs?.length ?? 0) > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px clamp(32px, 5cqw, 80px)', alignItems: 'flex-start', ...bodyGap }}>
          {paragraphs!.map((p, i) => (
            <p className="body-l" key={p.id ?? i} style={{ margin: 0, flex: '1 1 420px', maxWidth: '60ch' }}>
              {withBold(p.text)}
            </p>
          ))}
        </div>
      )}

      {cells.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--fg)', ...bodyGap }}>
            <span className="label">{figure?.label}</span>
            <span className="label muted">{figure?.caption}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 1, background: 'var(--ln)', boxShadow: 'inset 0 0 0 1px var(--ln)' }}>
            {cells.map((c, i) =>
              c.highlight ? (
                <div key={c.id ?? i} style={{ ...cell, background: 'var(--fg)', color: 'var(--bg)', justifyContent: 'space-between' }}>
                  <span className="label">
                    <i className="pixel" style={{ marginRight: 8 }} />
                    {c.label}
                  </span>
                  <span style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.15 }}>{c.title}</span>
                </div>
              ) : (
                <div key={c.id ?? i} style={cell}>
                  <span className="label muted">{c.label}</span>
                  <ul style={list}>
                    {(c.items ?? []).map((it, j) => (
                      <li key={it.id ?? j}>{it.name}</li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        </>
      )}

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          {coverage?.label && <span className="label muted">{coverage.label}</span>}
          <div className="tags">
            {tags.map((t, i) => (
              <span className="tag" key={t.id ?? i}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <Actions items={actions} style={{ marginTop: 32 }} />
    </Sheet>
  )
}
