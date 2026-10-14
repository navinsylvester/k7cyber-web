import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { CategoryPicker } from '@/components/support/CasePickers.client'
import { Field, Flash } from '@/components/support/Parts'
import { getCustomerCategories, getProductFamilies, getSubcategories } from '@/lib/support/reference'
import { requireCustomer } from '@/lib/support/session'

import { openCase } from './actions'

export const metadata: Metadata = { title: 'Open a case' }

const ERRORS: Record<string, string> = {
  title: 'Give the case a short title, at least a few words.',
  description: 'Tell us a little more: twenty characters is the minimum, and the more you say the faster we can help.',
  product: 'Pick a product from the list.',
  category: 'Pick a topic from the list.',
  'file-size': 'The file is larger than 5 MB. Try a smaller screenshot or zip the log.',
  'file-type': 'We accept images, PDF, text and log files, and zip archives.',
  failed: 'We could not open the case.',
}

type SP = { error?: string; message?: string; title?: string; description?: string; productId?: string; categoryId?: string; subcategoryId?: string; productVersion?: string; serial?: string }

/* The guided form: which product, what it is about, what happened. Everything else is optional and explained. */
export default async function NewCasePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const ctx = await requireCustomer('/support/cases/new')
  const [families, categories, subcategories] = await Promise.all([getProductFamilies(ctx.auth), getCustomerCategories(ctx.auth), getSubcategories(ctx.auth)])
  const error = sp.error ? `${ERRORS[sp.error] ?? 'Check the form and try again.'}${sp.error === 'failed' && sp.message ? ` ${sp.message}` : ''}` : null
  const customerCats = categories.map((c) => ({ id: c.id, name: c.name, label: c.label }))

  return (
    <section className="sheet ws g-paper">
      <div className="form-sheet">
        <span className="label muted">
          <Link href="/support/cases" style={{ textDecoration: 'none' }}>
            My cases
          </Link>{' '}
          / New case
        </span>
        <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
          Tell us what is wrong.
        </h1>
        <p className="form-intro">Three questions and a description. A K7 engineer reads every case; the better the description, the fewer questions we have to ask back.</p>
        {error && <Flash kind="error">{error}</Flash>}

        <form action={openCase} className="form-grid" id="new-case">
          <Field id="productId" label="Which K7 product?" hint="Pick the closest product; the exact edition does not matter." select>
            <select id="productId" name="productId" defaultValue={sp.productId ?? ''}>
              <option value="">I am not sure</option>
              {families.map((f) => (
                <option value={f.representativeId} key={f.representativeId}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="productVersion" label="Product version" hint="Optional. Found under About in the product.">
            <input id="productVersion" name="productVersion" defaultValue={sp.productVersion ?? ''} placeholder="16.0.1234" autoComplete="off" />
          </Field>

          <CategoryPicker categories={customerCats} subcategories={subcategories} initialCategory={sp.categoryId ?? ''} initialSubcategory={sp.subcategoryId ?? ''} mode="tiles" subLabel="More specifically (optional)" />

          <Field id="title" label="Title" required span hint="One line, the way you would say it to a colleague.">
            <input id="title" name="title" required minLength={4} maxLength={200} defaultValue={sp.title ?? ''} placeholder="Activation fails after reinstalling Windows" />
          </Field>
          <Field id="description" label="What happened?" required span hint="What you did, what you expected, what you saw instead, when it started, and any error text word for word.">
            <textarea id="description" name="description" required minLength={20} maxLength={8000} rows={7} defaultValue={sp.description ?? ''} placeholder="I reinstalled Windows yesterday and K7 says my key is already in use…" />
          </Field>
          <Field id="serial" label="Serial number or licence key" hint="Optional. Helps us find your licence faster.">
            <input id="serial" name="serial" defaultValue={sp.serial ?? ''} placeholder="K7XX-XXXX-XXXX-XXXX" autoComplete="off" />
          </Field>
          <Field id="file" label="Screenshot or log" hint="Optional. Up to 5 MB: images, PDF, text, logs or a zip.">
            <input id="file" name="file" type="file" accept="image/*,.pdf,.txt,.log,.csv,.zip" />
          </Field>

          <div className="form-actions span-2">
            <button className="btn btn-primary" type="submit">
              Open the case →
            </button>
            <Link className="link-u" href="/support/cases">
              Cancel
            </Link>
          </div>
          <p className="hint span-2">We will email {ctx.scope.email} the case number straight away and every time it moves.</p>
        </form>
      </div>
    </section>
  )
}
