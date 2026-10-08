import React from 'react'

import type { FeatureMatrixBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { Sheet, SheetHead, type SheetMeta, bodyGap } from '@/components/k7/Sheet'

const count: React.CSSProperties = { font: '400 13px/1.4 var(--font-sans)', textTransform: 'none', letterSpacing: 0, marginLeft: 14, color: 'var(--mu)' }

export const FeatureMatrix: React.FC<FeatureMatrixBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, columnLabel, groups, actions }) => (
  <Sheet meta={meta} tabLabel={tabLabel} id="modules">
    <SheetHead headline={headline} dimClause={dimClause} lede={lede} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '0 clamp(32px, 5cqw, 80px)', ...bodyGap }}>
      {groups.map((g, i) => (
        <div className="table-wrap" key={g.id ?? i}>
          <table className="dtable">
            <thead>
              <tr>
                <th>
                  {g.title}
                  <em style={count}>{g.rows.length}</em>
                </th>
                <th className="is-k7" style={{ width: '1%' }}>
                  {columnLabel || 'Included'}
                </th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r, j) => (
                <tr className="row" key={r.id ?? j}>
                  <td className="title">{r.name}</td>
                  <td className="tick">{r.included ? <i className="pixel" /> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
    <Actions items={actions} style={{ marginTop: 32 }} />
  </Sheet>
)
