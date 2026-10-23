import Link from 'next/link'
import React from 'react'

import { AUDIENCE_LABEL, COMMON_VARS, DELIVERY_LABEL, EVENT_GROUP_LABEL, EVENT_GROUPS, EVENTS, type Delivery, type EventDef, type Template } from '@/lib/partner/notify-model'
import { dmyHm } from '@/lib/support/format'

/* P25 The templates (design-system/components/PartnerParts/README.md): the catalogue of events as one filed ledger per
   group, each row the event, who reads it, how it is delivered (a quiet tag) and whether K7 wrote its own text; the chosen
   event's form beside it with the placeholders as mono chips and the rendered preview as a filed box. */

const PATH = '/partners/portal/k7/notifications/templates'

export const DeliveryTag: React.FC<{ delivery: Delivery }> = ({ delivery }) => <span className={delivery === 'bell' ? 'tag tag-dashed' : delivery === 'digest' ? 'tag tag-quiet' : 'tag tag-state'}>{DELIVERY_LABEL[delivery]}</span>

export const TemplateStateTag: React.FC<{ t: Template | null }> = ({ t }) => (t ? (t.enabled ? <span className="tag tag-solid">Edited</span> : <span className="tag tag-closed">Edit off</span>) : <span className="tag tag-dashed">The code’s text</span>)

export const TemplateLedger: React.FC<{ templates: Map<string, Template>; selected: string }> = ({ templates, selected }) => (
  <div className="tpl-groups">
    {EVENT_GROUPS.map((g) => {
      const rows = EVENTS.filter((e) => e.group === g)
      if (!rows.length) return null
      return (
        <div className="filed ledger tpl" key={g}>
          <span className="ftab label">{EVENT_GROUP_LABEL[g]}</span>
          <div className="table-wrap">
            <table className="dtable tpl-table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">To</th>
                  <th scope="col">Delivery</th>
                  <th scope="col">Text</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const t = templates.get(e.key) ?? null
                  return (
                    <tr className={`row${e.key === selected ? ' is-on' : ''}`} key={e.key}>
                      <td className="title">
                        <Link href={`${PATH}?event=${encodeURIComponent(e.key)}`} {...(e.key === selected ? { 'aria-current': 'true' as const } : {})}>
                          {e.label}
                        </Link>
                        <div className="muted mono">{e.key}</div>
                      </td>
                      <td className="text">{AUDIENCE_LABEL[e.audience]}</td>
                      <td className="status">
                        <DeliveryTag delivery={t ? t.delivery : e.delivery} />
                      </td>
                      <td className="status">
                        <TemplateStateTag t={t} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )
    })}
  </div>
)

export const Placeholders: React.FC<{ def: EventDef }> = ({ def }) => (
  <p className="tpl-vars">
    {[...def.vars, ...COMMON_VARS].map((v) => (
      <code key={v}>{`{{${v}}}`}</code>
    ))}
  </p>
)

export const Preview: React.FC<{ subject: string; body: string; label: string }> = ({ subject, body, label }) => (
  <div className="pending tpl-preview">
    <div className="pending-head">
      <i className="pixel" aria-hidden="true" />
      <span className="label">{label}</span>
    </div>
    <strong>{subject}</strong>
    <pre>{body}</pre>
  </div>
)

export const UpdatedLine: React.FC<{ t: Template | null }> = ({ t }) => (t?.updatedAt ? <span className="label muted">Edited {dmyHm(t.updatedAt)}{t.updatedBy ? ` by ${t.updatedBy}` : ''}</span> : null)
