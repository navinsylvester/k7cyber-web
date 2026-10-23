'use client'

import Link from 'next/link'
import React, { useActionState } from 'react'

import { DEAL_SOURCES, type DealInput, type Product } from '@/lib/partner/deals-model'
import type { PartnerType } from '@/lib/partner/settings-model'

/* P14 The registration form (FR-DEAL-02, FR-DEAL-03): the end customer, up to six product lines as a select and a quantity each
   (blank rows are dropped), the value and the dates, the source, the competitor, the notes and the files. One post. The server
   validates and either redirects to the deal or returns the errors with what was typed, which this component renders again, so
   nothing is lost on a refusal. The only client component on the partner side; it imports pure modules only. */

export type DealFormState = { n: number; input: DealInput; errors: Record<string, string> }
export type DealFormAction = (prev: DealFormState, form: FormData) => Promise<DealFormState>

const ROWS = 6
const today = () => new Date().toISOString().slice(0, 10)

const Field: React.FC<{ id: string; label: string; required?: boolean; hint?: string; error?: string; span?: boolean; select?: boolean; children: React.ReactNode }> = ({ id, label, required, hint, error, span, select, children }) => (
  <div className={`field${span ? ' span-2' : ''}${error ? ' is-invalid' : ''}`}>
    <label className="label" htmlFor={id}>
      {label}
      {required ? ' *' : ''}
    </label>
    <span className={`control${select ? ' is-select' : ''}`}>{children}</span>
    {hint && !error && <span className="hint">{hint}</span>}
    {error && <span className="field-error">{error}</span>}
  </div>
)

export const DealForm: React.FC<{ action: DealFormAction; initial: DealFormState; products: Product[]; orgType: PartnerType; submitLabel: string; dealId?: string; reply?: boolean; cancelHref: string }> = ({ action, initial, products, orgType, submitLabel, dealId, reply, cancelHref }) => {
  const [state, formAction, pending] = useActionState(action, initial)
  const v = state.input
  const e = state.errors
  const c = v.customer
  const lines = [...v.lines.slice(0, ROWS)]
  while (lines.length < Math.min(ROWS, Math.max(2, v.lines.length + 1))) lines.push({ productId: '', quantity: 0 })
  const families = [...new Set(products.map((p) => p.family).filter(Boolean))]
  const grouped = families.length > 1
  return (
    <form action={formAction} className="form-grid deal-form" key={state.n}>
      {dealId && <input type="hidden" name="dealId" value={dealId} />}
      {(e.gate || e.status || e.files) && (
        <div className="flash is-error span-2" role="alert">
          <i className="pixel" aria-hidden="true" />
          <p>{e.gate || e.status || e.files}</p>
        </div>
      )}
      <div className="span-2">
        <h2 className="sub-head">The end customer</h2>
      </div>
      <Field id="customerName" label="Customer" required span error={e.customerName} hint="The organisation buying; the conflict check uses it.">
        <input id="customerName" name="customerName" type="text" defaultValue={c.name} required />
      </Field>
      <Field id="industry" label="Industry" required error={e.industry}>
        <input id="industry" name="industry" type="text" defaultValue={c.industry} required placeholder="Banking, manufacturing, education…" />
      </Field>
      <Field id="city" label="City" required error={e.city}>
        <input id="city" name="city" type="text" defaultValue={c.city} required />
      </Field>
      <Field id="state" label="State" error={e.state}>
        <input id="state" name="state" type="text" defaultValue={c.state} />
      </Field>
      <Field id="contactName" label="Contact name" required error={e.contactName}>
        <input id="contactName" name="contactName" type="text" defaultValue={c.contactName} required />
      </Field>
      <Field id="designation" label="Designation" required error={e.designation}>
        <input id="designation" name="designation" type="text" defaultValue={c.designation} required />
      </Field>
      <Field id="email" label="Contact email" required error={e.email}>
        <input id="email" name="email" type="email" defaultValue={c.email} required />
      </Field>
      <Field id="phone" label="Contact phone" required error={e.phone}>
        <input id="phone" name="phone" type="tel" defaultValue={c.phone} required />
      </Field>
      {orgType === 'distributor' && (
        <Field id="resellerName" label="Reseller the deal is for" required span error={e.resellerName} hint="A Distributor registers on a reseller’s behalf. If the reseller is a K7 partner, name it as registered.">
          <input id="resellerName" name="resellerName" type="text" defaultValue={v.resellerName} required />
        </Field>
      )}

      <div className="span-2" style={{ marginTop: 16 }}>
        <h2 className="sub-head">What is sold</h2>
        {e.products && (
          <p className="field-error" style={{ display: 'block', marginBottom: 10 }}>
            {e.products}
          </p>
        )}
        <div className="table-wrap">
          <table className="dtable lines-table">
            <thead>
              <tr>
                <th scope="col">Product and SKU</th>
                <th scope="col" className="num">
                  Quantity
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <span className="control is-select">
                      <select name={`product_${i}`} defaultValue={l.productId} aria-label={`Line ${i + 1} product`}>
                        <option value="">—</option>
                        {grouped
                          ? families.map((f) => (
                              <optgroup key={f} label={f}>
                                {products
                                  .filter((p) => p.family === f)
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} · {p.sku}
                                    </option>
                                  ))}
                              </optgroup>
                            ))
                          : products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {p.sku}
                              </option>
                            ))}
                      </select>
                    </span>
                  </td>
                  <td className="num">
                    <span className="control">
                      <input name={`qty_${i}`} type="number" min={1} step={1} inputMode="numeric" defaultValue={l.quantity || ''} aria-label={`Line ${i + 1} quantity`} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          Licences, nodes or seats per product. Leave a row blank to skip it.
        </p>
      </div>

      <Field id="expectedValue" label="Expected deal value (₹)" required error={e.expectedValue}>
        <input id="expectedValue" name="expectedValue" type="number" min={1} step={1} inputMode="numeric" defaultValue={v.expectedValue ?? ''} required />
      </Field>
      <Field id="closeDate" label="Expected closure" required error={e.closeDate}>
        <input id="closeDate" name="closeDate" type="date" defaultValue={v.closeDate.slice(0, 10)} required min={today()} />
      </Field>
      <Field id="source" label="Source of the lead" required select error={e.source}>
        <select id="source" name="source" defaultValue={v.source} required>
          <option value="">—</option>
          {DEAL_SOURCES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="competitor" label="Competing vendor" error={e.competitor} hint="Optional.">
        <input id="competitor" name="competitor" type="text" defaultValue={v.competitor} />
      </Field>
      <Field id="notes" label={reply ? 'Your reply and notes' : 'Notes'} span hint={reply ? 'Answer K7’s request here; it goes into the thread.' : 'Anything the approver should know: the requirement, the timeline, who else is involved.'}>
        <textarea id="notes" name="notes" rows={4} defaultValue={v.notes} />
      </Field>
      <Field id="files" label="Attachments" span hint="A quote, an RFP or a purchase intent: PDF, images, Word, Excel, text or zip, up to 10 MB each. Files already attached stay on the deal.">
        <input id="files" name="files" type="file" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
      </Field>
      <div className="form-actions span-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Sending…' : submitLabel}
        </button>
        <Link className="link-u" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
