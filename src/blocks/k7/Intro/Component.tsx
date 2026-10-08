import React from 'react'

import type { IntroBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { Sheet, SheetHead, type SheetMeta, bodyGap, withBold } from '@/components/k7/Sheet'

const cell: React.CSSProperties = { background: 'var(--bg)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }
const list: React.CSSProperties = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15 }

export const Intro: React.FC<IntroBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, notice, specs, facts, paragraphs, figure, coverage, actions }) => {
  const cells = figure?.cells ?? []
  const tags = coverage?.tags ?? []
  const specList = specs ?? []
  const factList = facts ?? []
  const single = (paragraphs?.length ?? 0) === 1 && !specList.length && !factList.length
  return (
    <Sheet meta={meta} tabLabel={tabLabel} id="overview">
      <SheetHead headline={headline} dimClause={dimClause} lede={lede} />

      {notice && (
        <div className="notice" style={{ marginTop: 'clamp(32px, 4cqw, 56px)', maxWidth: '62ch' }}>
          <i className="pixel" style={{ marginTop: 7 }} />
          <p>{withBold(notice)}</p>
        </div>
      )}

      {single && (
        <p className="body-l" style={{ margin: 'clamp(32px, 4cqw, 56px) 0 0', maxWidth: '62ch' }}>
          {withBold(paragraphs![0]!.text)}
        </p>
      )}

      {!single && ((paragraphs?.length ?? 0) > 0 || specList.length > 0 || factList.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px clamp(32px, 5cqw, 80px)', alignItems: 'flex-start', ...bodyGap }}>
          {factList.length > 0 && (
            <div className="facts" style={{ flex: '0 1 360px' }}>
              {factList.map((f, i) => (
                <div key={f.id ?? i}>
                  <span className="k">{f.k}</span>
                  <span className="v">{f.v}</span>
                </div>
              ))}
            </div>
          )}
          {factList.length > 0 ? (
            <div style={{ flex: '1 1 440px', maxWidth: '60ch', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {(paragraphs ?? []).map((p, i) => (
                <p className="body-l" key={p.id ?? i} style={{ margin: 0 }}>
                  {withBold(p.text)}
                </p>
              ))}
              <Actions items={actions} style={{ marginTop: 10 }} />
            </div>
          ) : (
            (paragraphs ?? []).map((p, i) => (
              <p className="body-l" key={p.id ?? i} style={{ margin: 0, flex: '1 1 420px', maxWidth: specList.length ? '58ch' : '60ch' }}>
                {withBold(p.text)}
              </p>
            ))
          )}
          {specList.length > 0 && (
            <div className="spec-strip" style={{ flex: '1 1 380px' }}>
              {specList.map((sp, i) => (
                <div key={sp.id ?? i}>
                  <span className="label muted">{sp.label}</span>
                  <span className="v">{sp.value}</span>
                </div>
              ))}
            </div>
          )}
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

      {!factList.length && <Actions items={actions} style={{ marginTop: 32 }} />}
    </Sheet>
  )
}
