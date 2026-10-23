import React from 'react'

import { slaText, type SlaReading, type SlaSettings } from '@/lib/partner/sla-model'
import { dmyHm } from '@/lib/support/format'

/* P26 The SLA reading (design-system/components/PartnerParts/README.md): where a queue row's decision clock stands, as a Tag:
   quiet while there is time, state once the warning share is passed, signal when the target is breached. The words carry
   the working time left or the overrun; the title the due instant. */

export const SlaTag: React.FC<{ reading: SlaReading | null; sla: SlaSettings }> = ({ reading, sla }) => {
  if (!reading) return <span className="muted">—</span>
  const cls = reading.state === 'breached' ? 'tag tag-signal' : reading.state === 'at-risk' ? 'tag tag-state' : 'tag tag-quiet'
  return (
    <span className={`${cls} sla-tag`} title={`Due ${dmyHm(reading.dueAt)} · waiting since ${dmyHm(reading.startedAt)}`}>
      {slaText(reading, sla)}
    </span>
  )
}

/** The same reading as a strip value: the tag, then the due instant in mono. */
export const SlaValue: React.FC<{ reading: SlaReading | null; sla: SlaSettings; hours: number }> = ({ reading, sla, hours }) =>
  reading ? (
    <span className="sla-value">
      <SlaTag reading={reading} sla={sla} />
      <span className="sla-due">
        due {dmyHm(reading.dueAt)} · {hours} working h
      </span>
    </span>
  ) : (
    <span className="muted">Not on the clock</span>
  )
