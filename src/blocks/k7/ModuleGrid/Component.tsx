import React from 'react'

import type { ModuleGridBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { Icon } from '@/components/k7/Icon'
import { Sheet, SheetHead, type SheetMeta, bodyGap } from '@/components/k7/Sheet'
import { ModuleTiles } from './Tiles.client'

const head: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--fg)' }

export const ModuleGrid: React.FC<ModuleGridBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, groups, legend, legendLinkLabel, legendLinkUrl, actions }) => (
  <Sheet meta={meta} tabLabel={tabLabel} id="modular">
    <SheetHead headline={headline} dimClause={dimClause} lede={lede} />
    {groups.map((g, i) => (
      <React.Fragment key={g.id ?? i}>
        {g.label && (
          <div style={{ ...head, marginTop: i === 0 ? bodyGap.marginTop : 40 }}>
            <span className="label">{g.label}</span>
            {g.note && <span className="label muted">{g.note}</span>}
          </div>
        )}
        <ModuleTiles
          items={g.items.map((it) => ({ ...it, icon: <Icon name={it.icon} /> }))}
          compact={Boolean(g.compact)}
          style={{ marginTop: g.label ? 1 : i === 0 ? bodyGap.marginTop : 40 }}
          legend={
            legend && i === groups.length - 1 ? (
              <div style={{ background: 'var(--bg)', padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
                <div className="tags" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className="tag tag-solid">
                    <span className="tick">✓</span> Core solution
                  </span>
                  <span className="tag tag-quiet">+ Add-on, when needed</span>
                </div>
                {legendLinkLabel && legendLinkUrl && (
                  <a className="link-u" href={legendLinkUrl} style={{ alignSelf: 'flex-start' }}>
                    {legendLinkLabel}
                  </a>
                )}
              </div>
            ) : null
          }
        />
      </React.Fragment>
    ))}
    <Actions items={actions} style={{ marginTop: 28 }} />
  </Sheet>
)
