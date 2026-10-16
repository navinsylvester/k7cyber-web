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

/* Stair lines (S4): one word per line, three lines at most; the tail of a long headline shares the last line. */
const stairLines = (text: string): string[] => {
  const words = text.trim().split(/\s+/)
  return words.length <= 3 ? words : [words[0]!, words[1]!, words.slice(2).join(' ')]
}

/* SheetHead: headline left, lede right, bottoms aligned. A `kicker` is a lede-sized line above the headline instead
   (the puzzle sheet: the problem over the statement, the answer on the right). With `stair` the headline steps onto the 7
   and with `redact` its last word is hidden under a signal bar until hovered or tapped (S3, home page only). */
export const SheetHead: React.FC<{
  headline: string
  dimClause?: string | null
  lede?: string | null
  /** A lede-sized line above the headline, in the left column. */
  kicker?: string | null
  as?: 'h2' | 'h1'
  stair?: boolean
  redact?: boolean
  redactNote?: string | null
  /** Content stacked under the lede in the right column, filling the height a stair headline leaves beside it. */
  aside?: React.ReactNode
}> = ({ headline, dimClause, lede, kicker, as: H = 'h2', stair, redact, redactNote, aside }) => {
  const right = aside ? (
    <div className="head-aside">
      {lede && <p className="lede">{lede}</p>}
      {aside}
    </div>
  ) : (
    lede && <p className="lede">{lede}</p>
  )
  const above = kicker && <p className="lede kicker">{kicker}</p>
  if (!stair && !redact) {
    const h = (
      <H className="h-sheet">
        {headline} {dimClause && <span className="dim">{dimClause}</span>}
      </H>
    )
    return (
      <div className="sheet-head">
        {above ? (
          <div className="h-wrap">
            {above}
            {h}
          </div>
        ) : (
          h
        )}
        {right}
      </div>
    )
  }
  const lines = stair ? stairLines(headline) : [headline.trim()]
  const last = lines[lines.length - 1]!
  const punct = /[.!?]$/.test(last) ? last.slice(-1) : ''
  const lastWords = last.replace(/[.!?]$/, '').split(' ')
  const hidden = lastWords.pop() ?? ''
  return (
    <div className="sheet-head">
      <div className="h-wrap">
        {above}
        <H className={stair ? 'h-sheet stair' : 'h-sheet'}>
          {lines.slice(0, -1).map((l, i) => (
            <span key={i}>{l}</span>
          ))}
          <span>
            {redact ? (
              <>
                {lastWords.length > 0 && `${lastWords.join(' ')} `}
                <span className="redact" tabIndex={0}>
                  {hidden}
                </span>
                {punct}
              </>
            ) : (
              last
            )}
            {dimClause && <> <span className="dim">{dimClause}</span></>}
          </span>
        </H>
        {redact && redactNote && <p className="redact-note label">{redactNote}</p>}
      </div>
      {right}
    </div>
  )
}

/** Space between the head and the body of a sheet, as the artboards set it. */
export const bodyGap: React.CSSProperties = { marginTop: 'clamp(40px, 5cqw, 72px)' }

/** Renders **bold** spans in a plain string (benefit phrases keep one bold term). With `className` 'term' the spans are
    inverted blocks, ink on ground, the words a paragraph wants seen. */
export const withBold = (text: string, className?: 'term'): React.ReactNode =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className={className}>
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  )
