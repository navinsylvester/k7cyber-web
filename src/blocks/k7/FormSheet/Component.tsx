import React from 'react'

import type { FormSheetBlock } from '@/payload-types'

import { type SheetMeta } from '@/components/k7/Sheet'
import { K7Form } from './Form.client'

export const FormSheet: React.FC<FormSheetBlock & { meta: SheetMeta }> = ({ meta, tabLabel, tabNote, headline, note, form, privacyUrl, maxWidth }) => {
  if (typeof form !== 'object' || !form) return null
  return (
    <section className={`sheet g-${meta.ground}`} id="enquiry">
      <div className="sheet-tab" style={{ '--k': meta.k } as React.CSSProperties}>
        <span>
          <i className="pixel" />
          <span className="label">{tabNote ? tabLabel : `${String(meta.index).padStart(2, '0')}/${String(meta.count).padStart(2, '0')}`}</span>
        </span>
        <span className="label">{tabNote ?? tabLabel}</span>
      </div>
      <div className="sheet-head">
        <h2 className="h-sheet">{headline}</h2>
        {note && <p className="muted body-s">{note}</p>}
      </div>
      <K7Form form={form} privacyUrl={privacyUrl ?? '/privacy-policy'} maxWidth={maxWidth ?? undefined} />
    </section>
  )
}

