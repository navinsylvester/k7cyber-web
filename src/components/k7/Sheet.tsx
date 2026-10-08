import React from 'react'

export type Ground = 'paper' | 'panel' | 'contrast' | 'signal'

export type SheetMeta = {
  index: number // 1-based sheet number on the page (the banner is 01)
  count: number // sheets on the page
  k: number // tab position, 1 = right edge … 0 = left edge (S1, the tab walk)
  ground: Ground
}

const pad = (n: number) => String(n).padStart(2, '0')

/* A sheet: one section on one ground, raising its tab into the sheet above (SheetTab). */
export const Sheet: React.FC<{
  meta: SheetMeta
  tabLabel?: string | null
  id?: string
  className?: string
  children: React.ReactNode
}> = ({ meta, tabLabel, id, className, children }) => (
  <section className={['sheet', `g-${meta.ground}`, className].filter(Boolean).join(' ')} id={id}>
    {tabLabel && (
      <div className="sheet-tab" style={{ '--k': meta.k } as React.CSSProperties}>
        <span>
          <i className="pixel" />
          <span className="label">
            {pad(meta.index)}/{pad(meta.count)}
          </span>
        </span>
        <span className="label">{tabLabel}</span>
      </div>
    )}
    {children}
  </section>
)

/* SheetHead: headline left, lede right, bottoms aligned. */
export const SheetHead: React.FC<{ headline: string; dimClause?: string | null; lede?: string | null; as?: 'h2' | 'h1' }> = ({
  headline,
  dimClause,
  lede,
  as: H = 'h2',
}) => (
  <div className="sheet-head">
    <H className="h-sheet">
      {headline} {dimClause && <span className="dim">{dimClause}</span>}
    </H>
    {lede && <p className="lede">{lede}</p>}
  </div>
)

/** Space between the head and the body of a sheet, as the artboards set it. */
export const bodyGap: React.CSSProperties = { marginTop: 'clamp(40px, 5cqw, 72px)' }

/** Renders **bold** spans in a plain string (benefit phrases keep one bold term). */
export const withBold = (text: string): React.ReactNode =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
