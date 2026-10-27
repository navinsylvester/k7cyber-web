import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { Field, Flash } from '@/components/partner/Parts'
import { DeliveryTag, Placeholders, Preview, TemplateLedger, TemplateStateTag, UpdatedLine } from '@/components/partner/Templates'
import { Crumbs } from '@/components/support/Parts'
import { digestQueueCount, templateMap } from '@/lib/partner/notify'
import { AUDIENCE_LABEL, DELIVERIES, DELIVERY_HINT, DELIVERY_LABEL, eventDef, EVENTS, isEventKey, renderTemplate, SAMPLE_VARS } from '@/lib/partner/notify-model'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'

import { resetTemplateAction, runDigestAction, saveTemplateAction, sendTestAction } from './actions'

export const metadata: Metadata = { title: 'Notification templates' }

const PATH = '/partners/portal/k7/notifications/templates'
type SP = { event?: string; ok?: string; error?: string }

/* The editable templates (FR-NTF-01 "templates K7 can edit", M8): every event the portal sends, with the text K7 wrote for
   it or the code's own, the delivery rule (at once, in the daily digest, bell only), the placeholders it may use, a preview on
   sample values and a test to the editor's own address. The digest runs from here by hand as well as from the scheduler. */
export default async function K7TemplatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireK7Role(['channelManager'], PATH)
  const [templates, settings, queued] = await Promise.all([templateMap(), getPartnerSettings(), digestQueueCount()])
  const selected = isEventKey(sp.event) ? sp.event : EVENTS[0]!.key
  const def = eventDef(selected)!
  const t = templates.get(selected) ?? null
  const preview = renderTemplate(t ?? { event: selected, enabled: true, delivery: def.delivery, subject: '', body: '', updatedAt: null, updatedBy: '' }, { subject: SAMPLE_VARS.subject!, body: SAMPLE_VARS.body! }, { ...SAMPLE_VARS, recipient: me.name || me.email || SAMPLE_VARS.recipient! })
  const edited = [...templates.values()].filter((x) => x.enabled).length
  return (
    <>
      <K7Nav active="notifications" roles={me.roles} />
      <section className="sheet ws g-paper">
        <Crumbs items={[{ label: 'Partner desk', href: '/partners/portal/k7' }, { label: 'Notifications', href: '/partners/portal/k7/notifications' }, { label: 'Templates' }]} />
        <div className="ws-head" style={{ marginTop: 16 }}>
          <div className="ws-head-main">
            <span className="label muted">
              {String(EVENTS.length).padStart(2, '0')} events · {String(edited).padStart(2, '0')} with K7’s own text · {String(queued).padStart(2, '0')} waiting for the digest
            </span>
            <h1 className="h-util">What the portal writes to people.</h1>
            <p className="lede">
              Every event the portal sends, by email and on the bell. Without a template the code’s own words go out; write one and it is used from the next event on. Mail leaves as {settings.notify.mailFrom}
              {settings.notify.emailEnabled ? '' : ' (email is off in the settings: bell rows only)'}; digests go out once a day.
            </p>
          </div>
          <form action={runDigestAction} className="ws-actions">
            <input type="hidden" name="event" value={selected} />
            <button className="btn btn-line btn-sm" type="submit" title="Send everything that waits for the digest now, and remove old read rows">
              Run the digest
            </button>
          </form>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="tpl-layout">
          <TemplateLedger templates={templates} selected={selected} />

          <aside className="tpl-side">
            <div className="decide">
              <span className="label muted">{def.key}</span>
              <h2 style={{ marginTop: 6 }}>{def.label}</h2>
              <p className="hint" style={{ margin: '0 0 14px' }}>
                {def.hint} To {AUDIENCE_LABEL[def.audience].toLowerCase()}; the catalogue delivers it <DeliveryTag delivery={def.delivery} />.
              </p>
              <p style={{ margin: '0 0 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <TemplateStateTag t={t} />
                <UpdatedLine t={t} />
              </p>
              <form action={saveTemplateAction} className="form-grid tpl-form">
                <input type="hidden" name="event" value={selected} />
                <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="label" style={{ marginBottom: 10 }}>
                    Delivery
                  </legend>
                  <div className="choice">
                    {DELIVERIES.map((d) => (
                      <label key={d}>
                        <input type="radio" name="delivery" value={d} defaultChecked={(t ? t.delivery : def.delivery) === d} />
                        <span className="t">{DELIVERY_LABEL[d]}</span>
                        <span className="hint">{DELIVERY_HINT[d]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field id="subject" label="Subject" span hint="Blank keeps the code’s subject.">
                  <input id="subject" name="subject" defaultValue={t?.subject ?? ''} placeholder={`e.g. ${SAMPLE_VARS.subject}`} maxLength={200} />
                </Field>
                <Field id="body" label="Body" span hint="Blank keeps the code’s body. Paragraphs are kept; the link to the portal is added beneath, then the signature from the settings.">
                  <textarea id="body" name="body" rows={9} defaultValue={t?.body ?? ''} maxLength={4000} />
                </Field>
                <div className="span-2">
                  <span className="label" style={{ color: 'var(--mu)' }}>
                    Placeholders this event fills
                  </span>
                  <Placeholders def={def} />
                </div>
                <label className="check span-2">
                  <input type="checkbox" name="enabled" value="1" defaultChecked={t ? t.enabled : true} />
                  <span>
                    Use this template <span className="hint">· off keeps the delivery rule and sends the code’s text</span>
                  </span>
                </label>
                <div className="form-actions span-2">
                  <button className="btn btn-primary" type="submit">
                    Save template →
                  </button>
                </div>
              </form>
              <div className="tpl-actions">
                <form action={sendTestAction}>
                  <input type="hidden" name="event" value={selected} />
                  <button className="btn btn-line btn-sm" type="submit" title={`Send this event with sample values to ${me.email || 'you'}`}>
                    Send me a test
                  </button>
                </form>
                {t && (
                  <form action={resetTemplateAction}>
                    <input type="hidden" name="event" value={selected} />
                    <button className="link-u textbtn" type="submit">
                      Back to the code’s text
                    </button>
                  </form>
                )}
              </div>
            </div>
            <Preview subject={preview.subject} body={preview.body} label={t?.enabled ? 'Preview on sample values' : 'What the code sends, on sample values'} />
            <p className="hint">
              <Link className="link-u" href="/partners/portal/k7/settings?tab=notifications">
                The sender, the signature and the digest’s retention are in the settings
              </Link>
              .
            </p>
          </aside>
        </div>
      </section>
    </>
  )
}
