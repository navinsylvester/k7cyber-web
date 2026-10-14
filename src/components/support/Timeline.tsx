import React from 'react'

import { bytes, dmyHm, relative } from '@/lib/support/format'
import type { TimelineEntry } from '@/lib/support/timeline'

import { Avatar } from './Parts'

/* Conversation (customer) and timeline (agent): rows, not cards. The newest entry is first. */

const KIND_LABEL: Record<TimelineEntry['kind'], string> = { email: 'Email', note: 'Note', phonecall: 'Call', task: 'Task', appointment: 'Meeting', other: 'Activity', csat: 'Rating' }

export const Conversation: React.FC<{ entries: TimelineEntry[]; attachmentHref: (a: { id: string; kind: 'note' | 'email' }) => string }> = ({ entries, attachmentHref }) => {
  if (!entries.length) return null
  return (
    <div className="convo">
      {entries.map((e) => {
        const you = e.fromCustomer
        const name = you ? 'You' : e.kind === 'email' && e.direction === 'out' ? 'K7 Support' : e.by.name || 'K7 Support'
        return (
          <article className={`msg${you ? ' is-you' : ''}`} key={e.id} aria-label={`${name}, ${dmyHm(e.when)}`}>
            <Avatar name={you ? 'You' : name === 'K7 Support' ? 'K7' : name} />
            <div className="msg-head">
              <span className="name">{name}</span>
              <time className="when" dateTime={e.when} title={dmyHm(e.when)}>
                {relative(e.when)}
              </time>
            </div>
            {e.kind === 'email' && e.subject && <div className="msg-sub">{e.subject}</div>}
            {e.html ? <div className="msg-body" dangerouslySetInnerHTML={{ __html: e.html }} /> : e.text ? <div className="msg-body">{e.text}</div> : null}
            {e.attachments.length > 0 && (
              <div className="msg-att">
                {e.attachments.map((a) => (
                  <a className="tag" href={attachmentHref(a)} key={a.id}>
                    {a.name}
                    {a.size ? ` · ${bytes(a.size)}` : ''}
                  </a>
                ))}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

export const AgentTimeline: React.FC<{ entries: TimelineEntry[]; attachmentHref: (a: { id: string; kind: 'note' | 'email' }) => string; openFirst?: boolean }> = ({ entries, attachmentHref, openFirst = true }) => {
  if (!entries.length) return null
  return (
    <div className="tl">
      {entries.map((e, i) => {
        const internal = e.kind === 'note' && !e.customerVisible
        const dirLabel = e.kind === 'email' ? (e.direction === 'in' ? 'Incoming' : 'Outgoing') : null
        return (
          <div className={`tl-row${internal ? ' is-internal' : ''}`} key={e.id}>
            <time className="tl-when" dateTime={e.when} title={relative(e.when)}>
              {dmyHm(e.when)}
            </time>
            <div>
              <div className="tl-meta">
                <span className={`tag${e.kind === 'csat' && e.statusLabel === 'low' ? ' tag-signal' : ''}`}>{internal ? 'Internal note' : e.kind === 'note' ? 'Portal note' : KIND_LABEL[e.kind]}</span>
                {dirLabel && <span className="label muted">{dirLabel}</span>}
                <span className="tl-by">{e.fromCustomer ? (e.from || 'Customer') : e.by.name}</span>
                {e.statusLabel && e.kind !== 'note' && e.kind !== 'csat' && <span className="label muted">{e.statusLabel}</span>}
              </div>
              {e.subject && <div className="tl-sub" style={{ marginTop: 6 }}>{e.subject}</div>}
              {(e.html || e.text) && (
                <details open={openFirst && i === 0}>
                  <summary>
                    <span className="tl-prev">{e.preview || 'Show'}</span>
                    <span className="tl-hide">Hide</span>
                  </summary>
                  {e.html ? <div className="tl-body" dangerouslySetInnerHTML={{ __html: e.html }} /> : <div className="tl-body">{e.text}</div>}
                </details>
              )}
              {e.kind === 'email' && (e.from || e.to) && (
                <div className="hint" style={{ marginTop: 6 }}>
                  {e.from && <>From {e.from} </>}
                  {e.to && <>· To {e.to}</>}
                </div>
              )}
              {e.attachments.length > 0 && (
                <div className="msg-att" style={{ marginTop: 10 }}>
                  {e.attachments.map((a) => (
                    <a className="tag" href={attachmentHref(a)} key={a.id}>
                      {a.name}
                      {a.size ? ` · ${bytes(a.size)}` : ''}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
