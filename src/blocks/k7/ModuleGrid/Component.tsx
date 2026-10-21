import React from 'react'

import type { ModuleGridBlock } from '@/payload-types'

import { Actions } from '@/components/k7/Actions'
import { Icon } from '@/components/k7/Icon'
import { Sheet, SheetHead, type SheetMeta, bodyGap } from '@/components/k7/Sheet'
import { Switchboard } from './Switchboard.client'
import { ModuleGroups } from './Tiles.client'

export const ModuleGrid: React.FC<ModuleGridBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, layout, groups, legend, legendLinkLabel, legendLinkUrl, tally, tallyNote, requestUrl, actions }) => (
  <Sheet meta={meta} tabLabel={tabLabel} id="modular">
    <SheetHead headline={headline} dimClause={dimClause} lede={lede} />
    {layout === 'switchboard' ? (
      <Switchboard groups={groups} tally={tally ? { note: tallyNote, requestUrl: requestUrl || '/contact-us' } : null} />
    ) : (
      <ModuleGroups
        groups={groups.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, icon: <Icon name={it.icon} /> })) }))}
        legend={legend ? { link: legendLinkLabel && legendLinkUrl ? { label: legendLinkLabel, url: legendLinkUrl } : null } : null}
        tally={tally ? { note: tallyNote, requestUrl: requestUrl || '/contact-us' } : null}
        top={bodyGap.marginTop as string}
      />
    )}
    <Actions items={actions} style={{ marginTop: 28 }} />
  </Sheet>
)
