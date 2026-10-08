import React from 'react'

import type { LocationsBlock } from '@/payload-types'

import { Sheet, SheetHead, type SheetMeta, bodyGap } from '@/components/k7/Sheet'

const isMono = (v: string) => /^[+\d][\d\s()+-]*$/.test(v)

export const Locations: React.FC<LocationsBlock & { meta: SheetMeta }> = ({ meta, tabLabel, headline, dimClause, lede, offices }) => (
  <Sheet meta={meta} tabLabel={tabLabel} id="offices">
    <SheetHead headline={headline} dimClause={dimClause} lede={lede} />
    <div className="locations" style={bodyGap}>
      {offices.map((o, i) => (
        <div className="location" key={o.id ?? i}>
          <h3 className="h-block">{o.name}</h3>
          <address>
            {o.company}
            <br />
            {o.address}
          </address>
          {(o.rows?.length ?? 0) > 0 && (
            <dl className="meta-rows">
              {o.rows!.map((r, j) => (
                <React.Fragment key={r.id ?? j}>
                  <dt className="label">{r.label}</dt>
                  <dd className={isMono(r.value) ? undefined : 'sans'}>{r.href ? <a href={r.href}>{r.value}</a> : r.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
          {o.mapCaption && (
            <figure className="ph" style={{ '--ar': '16/7' } as React.CSSProperties}>
              <figcaption>{o.mapCaption}</figcaption>
            </figure>
          )}
        </div>
      ))}
    </div>
  </Sheet>
)
