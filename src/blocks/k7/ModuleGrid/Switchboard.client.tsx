'use client'
import Link from 'next/link'
import React, { useState } from 'react'

import type { Tally } from './Tiles.client'

type Item = { id?: string | null; name: string; line: string; on?: boolean | null; url?: string | null }
type Group = { id?: string | null; label?: string | null; note?: string | null; items: Item[] }

const pad = (n: number) => String(n).padStart(2, '0')

/* Switchboard (design-system/components/Switchboard): the platform in two columns. The core is one filed block on paper whose
   tab reads Core · Always on: the four names set large on hairlines, each with its mono gloss, and the base line 1 agent ·
   1 console. The add-ons are a ledger of seven rows, each its index, its name and gloss, and an Off | On switch; a row that is
   on has its index stamped as a block. Under both, the sum on a double rule, and the request carries the modules that are on.
   No icons and no descriptions: the detail is the Platform page's. Nothing inverts on hover but the switch. */
export const Switchboard: React.FC<{ groups: Group[]; tally?: Tally | null }> = ({ groups, tally }) => {
  const [pressed, setPressed] = useState<Record<string, boolean>>({})
  const core = groups[0]
  const addons = groups.slice(1).flatMap((g, k) => g.items.map((it, i) => ({ it, key: `${k + 1}.${i}` })))
  const all = groups.flatMap((g, gi) => g.items.map((it, i) => ({ it, key: `${gi}.${i}` })))
  const isOn = (it: Item, key: string) => Boolean(it.on) || Boolean(pressed[key])
  const active = all.filter(({ it, key }) => isOn(it, key)).map(({ it }) => it.name)
  const picked = all.filter(({ it, key }) => !it.on && isOn(it, key)).map(({ it }) => it.name)
  const [baseLeft, baseRight] = (tally?.note || '1 agent · 1 console').split('·').map((s) => s.trim())

  const name = (it: Item) => <span className="sw-name">{it.url ? <Link href={it.url}>{it.name}</Link> : it.name}</span>

  return (
    <div className="switchboard" style={{ marginTop: 'clamp(40px, 5cqw, 72px)' }}>
      {core && (
        <div className="sw-core filed">
          <div className="ftab">
            <span className="label">{core.label}</span>
            {core.note && <span className="label muted">{core.note}</span>}
          </div>
          <ul className="sw-names">
            {core.items.map((it, i) => (
              <li key={it.id ?? i}>
                {name(it)}
                <span className="sw-gloss">{it.line}</span>
              </li>
            ))}
          </ul>
          <div className="sw-base">
            <span className="label">{baseLeft}</span>
            <span className="label">{baseRight}</span>
          </div>
        </div>
      )}
      {addons.length > 0 && (
        <div className="sw-addons">
          <div className="sw-head">
            <span className="label">{groups[1]?.label}</span>
            {groups[1]?.note && <span className="label muted">{groups[1].note}</span>}
          </div>
          <ol className="sw-ledger">
            {addons.map(({ it, key }, i) => {
              const on = isOn(it, key)
              return (
                <li className={`sw-row${on ? ' is-on' : ''}`} key={it.id ?? key}>
                  <span className="k">{pad(i + 1)}</span>
                  <span className="name">
                    {name(it)}
                    <span className="sw-gloss">{it.line}</span>
                  </span>
                  <span className="seg" role="group" aria-label={it.name}>
                    <button type="button" aria-pressed={!on} onClick={() => setPressed((p) => ({ ...p, [key]: false }))}>
                      Off
                    </button>
                    <button type="button" aria-pressed={on} onClick={() => setPressed((p) => ({ ...p, [key]: true }))}>
                      On
                    </button>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      )}
      {tally && (
        <div className="module-tally" aria-live="polite">
          <span className="count num">
            {pad(active.length)} of {pad(all.length)} modules on
          </span>
          <span className="body-s muted">{picked.length ? `Core + ${picked.join(', ')}` : 'Switch an add-on on to include it in your request.'}</span>
          <Link className="link-u" href={`${tally.requestUrl}?modules=${encodeURIComponent(active.join(','))}`}>
            {picked.length ? `Request demo with ${picked.length} add-on${picked.length === 1 ? '' : 's'} →` : 'Request demo of the core platform →'}
          </Link>
        </div>
      )}
    </div>
  )
}
