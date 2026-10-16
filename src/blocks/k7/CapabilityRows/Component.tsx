import React from 'react'

import type { CapabilityRowsBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { Icon } from '@/components/k7/Icon'
import { Sheet, SheetHead, type SheetMeta, bodyGap, withBold } from '@/components/k7/Sheet'

export const CapabilityRows: React.FC<CapabilityRowsBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, numbered, rows, actions }) => (
  <Sheet meta={meta} tabLabel={tabLabel} id={tabLabel?.toLowerCase().replace(/\W+/g, '-')}>
    <SheetHead headline={headline} dimClause={dimClause} lede={lede} />
    {numbered ? (
      /* The numbered ledger (CapabilityRow README, "Numbered"): index, icon, title and sentence, and the scope list. */
      <div className="cap-ledger" style={bodyGap}>
        {rows.map((r, i) => (
          <article className="cap" key={r.id ?? i}>
            <div className="cap-n">
              <span className="num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <Icon name={r.icon} />
            </div>
            <div className="cap-body">
              <h3 className="h-title">{r.title}</h3>
              <p>{withBold(r.text)}</p>
            </div>
            {(r.tags?.length ?? 0) > 0 && (
              <div className="scope">
                <div className="scope-head">
                  <span className="label">{r.scopeLabel || 'Scope'}</span>
                  <span className="label muted">{String(r.tags!.length).padStart(2, '0')}</span>
                </div>
                <ul className="tags">
                  {r.tags!.map((t, j) => (
                    <li className="tag" key={t.id ?? j}>
                      {t.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    ) : (
    <div className="cap-list" style={bodyGap}>
      {rows.map((r, i) => (
        <div key={r.id ?? i}>
          <Icon name={r.icon} />
          <div>
            <h3>{r.title}</h3>
            <p>{withBold(r.text)}</p>
            {(r.tags?.length ?? 0) > 0 && (
              <div className="tags" style={{ marginTop: 14 }}>
                {r.tags!.map((t, j) => (
                  <span className="tag" key={t.id ?? j}>
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
    )}
    <Actions items={actions} style={{ marginTop: 32 }} />
  </Sheet>
)
