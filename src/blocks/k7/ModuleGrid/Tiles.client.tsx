'use client'
import Link from 'next/link'
import React, { useState } from 'react'

type Item = { id?: string | null; name: string; line: string; on?: boolean | null; url?: string | null; icon: React.ReactNode }
type Group = { id?: string | null; label?: string | null; note?: string | null; compact?: boolean | null; items: Item[] }

export type Tally = { note?: string | null; requestUrl: string }

const pad = (n: number) => String(n).padStart(2, '0')
const head: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--fg)' }

/* The groups of module tiles share one state, so the tally counts across core and add-ons. A tile that is on is
   inverted; pressing a + tile turns it on (ModuleChips). Tiles with a URL are links. */
export const ModuleGroups: React.FC<{ groups: Group[]; legend?: { link?: { label: string; url: string } | null } | null; tally?: Tally | null; top: string | number }> = ({
  groups,
  legend,
  tally,
  top,
}) => {
  const [pressed, setPressed] = useState<Record<string, boolean>>({})
  const isOn = (it: Item, key: string) => Boolean(it.on) || Boolean(pressed[key])

  const all = groups.flatMap((g, gi) => g.items.map((it, i) => ({ it, key: `${gi}.${i}` })))
  const active = all.filter(({ it, key }) => isOn(it, key)).map(({ it }) => it.name)
  const picked = all.filter(({ it, key }) => !it.on && isOn(it, key)).map(({ it }) => it.name)

  const legendCell = legend && (
    <div className="module-legend">
      <div className="tags" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
        <span className="tag tag-solid">
          <span className="tick">✓</span> Core solution
        </span>
        <span className="tag tag-quiet">+ Add-on, when needed</span>
      </div>
      {legend.link && (
        <Link className="link-u" href={legend.link.url} style={{ alignSelf: 'flex-start' }}>
          {legend.link.label}
        </Link>
      )}
    </div>
  )

  /* The tally bar under the grid: the count steps as add-ons are pressed; the request carries the modules that are on. */
  const tallyBar = tally && (
    <div className="module-tally" aria-live="polite">
      <span className="count num">{pad(active.length)} modules active</span>
      {tally.note && <span className="label muted">{tally.note}</span>}
      <span className="body-s muted">{picked.length ? `Core + ${picked.join(', ')}` : 'Press an add-on to include it in your request.'}</span>
      <Link className="link-u" href={`${tally.requestUrl}?modules=${encodeURIComponent(active.join(','))}`}>
        {picked.length ? `Request demo with ${picked.length} add-on${picked.length === 1 ? '' : 's'} →` : 'Request demo of the core platform →'}
      </Link>
    </div>
  )

  return (
    <>
      {groups.map((g, gi) => (
        <React.Fragment key={g.id ?? gi}>
          {g.label && (
            <div style={{ ...head, marginTop: gi === 0 ? top : 40 }}>
              <span className="label">{g.label}</span>
              {g.note && <span className="label muted">{g.note}</span>}
            </div>
          )}
          <div
            className="modules"
            role="group"
            aria-label={g.label ?? undefined}
            style={{ marginTop: g.label ? 1 : gi === 0 ? top : 40, gridTemplateColumns: g.compact ? 'repeat(auto-fit, minmax(min(100%, 176px), 1fr))' : undefined }}
          >
            {g.items.map((it, i) => {
              const key = `${gi}.${i}`
              const on = isOn(it, key)
              const inner = (
                <>
                  <span className="top">
                    {it.icon}
                    <span className="state">{on ? '✓' : '+'}</span>
                  </span>
                  <h3>{it.name}</h3>
                  <p>{it.line}</p>
                </>
              )
              return it.url ? (
                <Link className={`module${on ? ' is-on' : ''}`} href={it.url} key={it.id ?? i}>
                  {inner}
                </Link>
              ) : (
                <button
                  className={`module${on ? ' is-on' : ''}`}
                  type="button"
                  aria-pressed={on}
                  key={it.id ?? i}
                  onClick={() => setPressed((p) => ({ ...p, [key]: !p[key] }))}
                >
                  {inner}
                </button>
              )
            })}
            {gi === groups.length - 1 && legendCell}
          </div>
          {gi === groups.length - 1 && tallyBar}
        </React.Fragment>
      ))}
    </>
  )
}
