'use client'
import Link from 'next/link'
import React, { useState } from 'react'

type Item = { id?: string | null; name: string; line: string; on?: boolean | null; url?: string | null; icon: React.ReactNode }

/* A tile that is on is inverted; pressing a + tile turns it on (ModuleChips). Tiles with a URL are links. */
export const ModuleTiles: React.FC<{ items: Item[]; compact: boolean; legend?: React.ReactNode; style?: React.CSSProperties }> = ({ items, compact, legend, style }) => {
  const [pressed, setPressed] = useState<Record<number, boolean>>({})
  return (
    <div className="modules" role="group" style={{ ...style, gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(min(100%, 176px), 1fr))' : undefined }}>
      {items.map((it, i) => {
        const on = Boolean(it.on) || Boolean(pressed[i])
        const inner = (
          <>
            <span className="top">
              {it.icon}
              <span className="state">{on ? '✓' : '+'}</span>
            </span>
            <h4>{it.name}</h4>
            <p>{it.line}</p>
          </>
        )
        return it.url ? (
          <Link className={`module${on ? ' is-on' : ''}`} href={it.url} key={it.id ?? i}>
            {inner}
          </Link>
        ) : (
          <button className={`module${on ? ' is-on' : ''}`} type="button" aria-pressed={on} key={it.id ?? i} onClick={() => setPressed((p) => ({ ...p, [i]: !p[i] }))}>
            {inner}
          </button>
        )
      })}
      {legend}
    </div>
  )
}
