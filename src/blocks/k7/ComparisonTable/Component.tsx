import React from 'react'

import type { ComparisonTableBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { Sheet, SheetHead, type SheetMeta, bodyGap } from '@/components/k7/Sheet'

const Points: React.FC<{ text?: string | null }> = ({ text }) => {
  const lines = (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return null
  return (
    <ul>
      {lines.map((l, i) => {
        const gap = /^(x|✖)\s+/i.test(l)
        return (
          <li className={gap ? 'no' : undefined} key={i}>
            {l.replace(/^(x|✖)\s+/i, '')}
          </li>
        )
      })}
    </ul>
  )
}

export const ComparisonTable: React.FC<ComparisonTableBlock & { meta: SheetMeta }> = (p) => {
  // Criteria are numbered continuously across sections.
  const offsets = p.sections.reduce<number[]>((acc, s, i) => [...acc, (acc[i - 1] ?? 0) + (i > 0 ? p.sections[i - 1]!.rows.length : 0)], [])
  return (
    <Sheet meta={p.meta} tabLabel={p.tabLabel} id="comparison">
      <SheetHead headline={p.headline} dimClause={p.dimClause} lede={p.lede} />
      <div className="table-wrap" style={bodyGap}>
        <table className="dtable" style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th style={{ width: '22%' }}>{p.criterionHead}</th>
              <th style={{ width: '26%' }}>{p.competitorHead}</th>
              <th className="is-k7" style={{ width: '26%' }}>
                {p.k7Head}
              </th>
              <th>{p.advantageHead}</th>
            </tr>
          </thead>
          <tbody>
            {p.sections.map((s, i) => (
              <React.Fragment key={s.id ?? i}>
                <tr className="batch">
                  <th colSpan={4}>
                    <span>
                      {s.title} {s.subtitle && <em>{s.subtitle}</em>}
                    </span>
                  </th>
                </tr>
                {s.rows.map((r, j) => {
                  return (
                    <tr className="row" key={r.id ?? j}>
                      <td className="crit">
                        <span className="label muted">{(offsets[i] ?? 0) + j + 1}</span>
                        <br />
                        {r.title}
                      </td>
                      <td>
                        <Points text={r.competitor} />
                      </td>
                      <td>
                        <Points text={r.k7} />
                      </td>
                      <td>
                        <Points text={r.advantage} />
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <Actions items={p.actions} style={{ marginTop: 32 }} />
    </Sheet>
  )
}
