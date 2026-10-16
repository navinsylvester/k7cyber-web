'use client'
import Link from 'next/link'
import React, { useState } from 'react'

import type { Tally } from './Tiles.client'

type Item = { id?: string | null; name: string; line: string; on?: boolean | null; url?: string | null; icon: React.ReactNode }
type Group = { id?: string | null; label?: string | null; note?: string | null; items: Item[] }

const pad = (n: number) => String(n).padStart(2, '0')

/* Switchboard (design-system/components/Switchboard): the platform on one rail. The core cells sit above the rail, each marked
   On; the add-on cells sit below it, each with an Off | On switch. Every cell is plugged into the rail by a tick, and a module
   that is on has an ink plug on it; the rail is labelled with the note (1 agent · 1 console). The sum line closes the board and
   the request carries the modules that are on. Nothing inverts on hover but the switch. */
export const Switchboard: React.FC<{ groups: Group[]; tally?: Tally | null }> = ({ groups, tally }) => {
  const [pressed, setPressed] = useState<Record<string, boolean>>({})
  const core = groups[0]
  const addons = groups.slice(1).flatMap((g, k) => g.items.map((it, i) => ({ it, key: `${k + 1}.${i}` })))
  const all = groups.flatMap((g, gi) => g.items.map((it, i) => ({ it, key: `${gi}.${i}` })))
  const isOn = (it: Item, key: string) => Boolean(it.on) || Boolean(pressed[key])
  const active = all.filter(({ it, key }) => isOn(it, key)).map(({ it }) => it.name)
  const picked = all.filter(({ it, key }) => !it.on && isOn(it, key)).map(({ it }) => it.name)
  const [railLeft, railRight] = (tally?.note || '1 agent · 1 console').split('·').map((s) => s.trim())

  const cell = (it: Item, key: string, isCore: boolean) => {
    const on = isOn(it, key)
    return (
      <li className={`sw-cell${on ? ' is-on' : ''}`} key={it.id ?? key}>
        {it.icon}
        <span className="name">{it.url ? <Link href={it.url}>{it.name}</Link> : it.name}</span>
        <span className="line">{it.line}</span>
        {isCore ? (
          <span className="state sw-on">On</span>
        ) : (
          <span className="state seg" role="group" aria-label={it.name}>
            <button type="button" aria-pressed={!on} onClick={() => setPressed((p) => ({ ...p, [key]: false }))}>
              Off
            </button>
            <button type="button" aria-pressed={on} onClick={() => setPressed((p) => ({ ...p, [key]: true }))}>
              On
            </button>
          </span>
        )}
      </li>
    )
  }

  return (
    <div className="switchboard" style={{ marginTop: 'clamp(40px, 5cqw, 72px)' }}>
      {core && (
        <>
          <div className="sw-head">
            <span className="label">{core.label}</span>
            {core.note && <span className="label muted">{core.note}</span>}
          </div>
          <ul className="sw-tier is-core">{core.items.map((it, i) => cell(it, `0.${i}`, true))}</ul>
        </>
      )}
      <div className="sw-rail" aria-hidden="true">
        <span className="label">{railLeft}</span>
        <span className="label">{railRight}</span>
      </div>
      {addons.length > 0 && (
        <>
          <ul className="sw-tier is-addons">{addons.map(({ it, key }) => cell(it, key, false))}</ul>
          <div className="sw-head is-foot">
            <span className="label">{groups[1]?.label}</span>
            {groups[1]?.note && <span className="label muted">{groups[1].note}</span>}
          </div>
        </>
      )}
      {tally && (
        <div className="module-tally" aria-live="polite">
          <span className="count num">{pad(active.length)} of {pad(all.length)} modules on</span>
          <span className="body-s muted">{picked.length ? `Core + ${picked.join(', ')}` : 'Switch an add-on on to include it in your request.'}</span>
          <Link className="link-u" href={`${tally.requestUrl}?modules=${encodeURIComponent(active.join(','))}`}>
            {picked.length ? `Request demo with ${picked.length} add-on${picked.length === 1 ? '' : 's'} →` : 'Request demo of the core platform →'}
          </Link>
        </div>
      )}
    </div>
  )
}
