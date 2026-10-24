import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import React from 'react'

import { Field } from '@/components/partner/Parts'
import { parseCertificateNumber } from '@/lib/partner/certificates-model'

export const metadata: Metadata = { title: 'Verify a certificate', robots: { index: true, follow: false } }

/* The public verification door (FR-TRN-09, FR-CRT-03): type or paste a certificate number; the QR on a certificate leads
   straight to its page. Nothing here needs a session, and nothing here lists certificates. */
export default async function VerifyIndexPage({ searchParams }: { searchParams: Promise<{ id?: string; error?: string }> }) {
  const sp = await searchParams
  if (sp.id) {
    const n = parseCertificateNumber(sp.id)
    if (n) redirect(`/partners/verify/${n}`)
  }
  const bad = Boolean(sp.id) || sp.error === 'shape'
  return (
    <section className="sheet ws g-paper verify">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">K7 Partner Programme · verification</span>
          <h1 className="h-util">Verify a certificate.</h1>
          <p className="lede">Every K7 partner certificate and individual training certificate carries a number and a QR code. Enter the number to confirm the certificate is genuine and still valid.</p>
        </div>
      </div>
      <form className="form-grid verify-form" action="/partners/verify" method="get">
        <Field id="id" label="Certificate number" hint="K7P-C-… for an individual, K7P-O-… for an organisation." span>
          <input id="id" name="id" type="text" inputMode="text" autoComplete="off" placeholder="K7P-C-7KQ2MX" defaultValue={sp.id ?? ''} required pattern="[Kk]?7?[Pp]?-?[CcOo]-?[A-Za-z0-9]{6}" />
        </Field>
        {bad ? (
          <p className="field-error span-2" role="alert">
            That is not a certificate number. It reads K7P-C- or K7P-O- followed by six letters and digits.
          </p>
        ) : null}
        <div className="form-actions span-2">
          <button className="btn btn-primary" type="submit">
            Verify →
          </button>
        </div>
      </form>
    </section>
  )
}
