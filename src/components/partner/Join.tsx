import Link from 'next/link'
import React from 'react'

import { JOIN } from '@/lib/partner/registration'
import { SIZE_BANDS, TURNOVER_BANDS, type Application } from '@/lib/partner/registration-model'
import { PARTNER_TYPE_LABEL } from '@/lib/partner/settings-model'
import { dmy, dmyHm } from '@/lib/support/format'

import { MobileVerifiedTag } from './Parts'

/* Section 10 · Partners, the join parts (P7 the join steps, P9 the application summary): the public application is four steps
   on one strip, and the application reads back as filed facts wherever it is shown (terms step, status page, the K7 sheet). */

export const JOIN_STEPS = [
  { key: 'type', label: 'Partner type', href: JOIN },
  { key: 'company', label: 'Company and contact', href: `${JOIN}/company` },
  { key: 'verify', label: 'Verify', href: `${JOIN}/verify` },
  { key: 'terms', label: 'Terms and submit', href: `${JOIN}/terms` },
] as const
export type JoinStep = (typeof JOIN_STEPS)[number]['key']

/** P7 The join steps: four cells on the track's bars, the current one on signal, the done ones in ink and linked back. */
export const JoinSteps: React.FC<{ current: JoinStep; done?: boolean }> = ({ current, done }) => {
  const i = JOIN_STEPS.findIndex((s) => s.key === current)
  return (
    <ol className="jsteps" aria-label="Application steps">
      {JOIN_STEPS.map((s, n) => {
        const state = done || n < i ? 'is-done' : n === i ? 'is-now' : undefined
        return (
          <li key={s.key} className={state} {...(n === i && !done ? { 'aria-current': 'step' as const } : {})}>
            <i aria-hidden="true" />
            <span className="label">
              <span className="jsteps-n">{String(n + 1).padStart(2, '0')}</span> {n < i && !done ? <Link href={s.href}>{s.label}</Link> : s.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const band = (list: readonly { key: string; label: string }[], key: string) => list.find((b) => b.key === key)?.label ?? '—'

const Row: React.FC<{ k: string; v: React.ReactNode; sans?: boolean }> = ({ k, v, sans = true }) => (
  <>
    <dt>{k}</dt>
    <dd className={sans ? 'sans' : undefined}>{v || '—'}</dd>
  </>
)

/** P9 The application as filed facts: three groups of meta-rows, the same on the applicant's and the K7 side. `regions` are names. */
export const ApplicationSummary: React.FC<{ app: Application; regions: string[]; edit?: boolean; k7?: boolean }> = ({ app, regions, edit, k7 }) => {
  const c = app.company
  const p = app.contact
  return (
    <div className="app-summary">
      <div>
        <h2 className="sub-head">
          Company{edit && <Link className="label link-u" href={`${JOIN}/company`}>Edit</Link>}
        </h2>
        <dl className="meta-rows label">
          <Row k="Applying as" v={PARTNER_TYPE_LABEL[app.type]} />
          <Row k="Legal name" v={c.legalName} />
          <Row k="Trade name" v={c.tradeName} />
          <Row k="Registered address" v={c.address ? `${c.address}, ${c.city}, ${c.state} ${c.pin}, ${c.country}` : ''} />
          <Row k="Website" v={c.website ? <a href={c.website} rel="noreferrer" target="_blank">{c.website.replace(/^https?:\/\//, '')}</a> : ''} />
          <Row k="Incorporated" v={c.yearOfIncorporation ? String(c.yearOfIncorporation) : ''} sans={false} />
          <Row k="Company size" v={band(SIZE_BANDS, c.size)} />
          <Row k="Annual turnover" v={band(TURNOVER_BANDS, c.turnover)} />
          <Row k="GSTIN" v={c.gstin} sans={false} />
          <Row k="PAN" v={c.pan} sans={false} />
          <Row k="K7 regions" v={regions.join(', ')} />
        </dl>
      </div>
      <div>
        <h2 className="sub-head">
          Primary contact{edit && <Link className="label link-u" href={`${JOIN}/company`}>Edit</Link>}
        </h2>
        <dl className="meta-rows label">
          <Row k="Name" v={p.name} />
          <Row k="Designation" v={p.designation} />
          <Row k="Email" v={p.email ? <>{p.email} {p.emailVerifiedAt ? <span className="tag tag-solid">Verified</span> : <span className="tag tag-quiet">Not verified</span>}</> : ''} />
          <Row k="Mobile" v={p.mobile ? <>{p.mobile} <MobileVerifiedTag contact={p} /></> : ''} />
          {k7 && app.terms.acceptedAt && <Row k="Terms" v={`Version ${app.terms.version}, accepted ${dmyHm(app.terms.acceptedAt)}`} />}
          {k7 && app.submittedAt && <Row k="Submitted" v={dmy(app.submittedAt)} sans={false} />}
        </dl>
      </div>
    </div>
  )
}
