'use client'
import React, { useState } from 'react'

import { Field } from '@/components/support/Parts'
import { canonicalCountry, canonicalState, COUNTRIES, DEFAULT_COUNTRY, isIndia, statesOf } from '@/lib/geo'
import { turnoverOptions } from '@/lib/partner/registration-model'

type Errors = Record<string, string | undefined>

/** The country, and the state that follows it: a select where the country has a list, free text (optional) where it does not.
    Used by the join step and the organisation page; `children` render between the address and what depends on the country. */
export const CountryState: React.FC<{ country: string; state: string; errors: Errors; onCountry?: (c: string) => void }> = ({ country: initialCountry, state: initialState, errors, onCountry }) => {
  const start = canonicalCountry(initialCountry) || initialCountry || DEFAULT_COUNTRY
  const [country, setCountry] = useState(start)
  const [state, setState] = useState(canonicalState(start, initialState) || initialState)
  const states = statesOf(country)
  const listed = COUNTRIES.includes(country)
  const pick = (c: string) => {
    setCountry(c)
    setState((s) => (statesOf(c).length ? canonicalState(c, s) : statesOf(country).length ? '' : s))
    onCountry?.(c)
  }
  return (
    <>
      <Field id="country" label="Country" required select error={errors.country}>
        <select id="country" name="country" required value={country} onChange={(e) => pick(e.target.value)} autoComplete="country-name">
          {!listed && <option value={country}>{country}</option>}
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      {states.length ? (
        <Field id="state" label="State" required select error={errors.state}>
          <select id="state" name="state" required value={state} onChange={(e) => setState(e.target.value)} autoComplete="address-level1">
            <option value="">Choose…</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field id="state" label="State / province" error={errors.state} hint="If your address has one.">
          <input id="state" name="state" value={state} onChange={(e) => setState(e.target.value)} autoComplete="address-level1" />
        </Field>
      )}
    </>
  )
}

/** Join step 2's address block and what follows the country: the turnover bands in rupees for India and US dollars elsewhere,
    GSTIN and PAN only for an Indian company. `middle` is the server-rendered fields between them (website, year, size). */
export const CompanyFields: React.FC<{
  company: { country: string; state: string; city: string; pin: string; turnover: string; gstin: string; pan: string }
  errors: Errors
  middle: React.ReactNode
}> = ({ company: c, errors, middle }) => {
  const [country, setCountry] = useState(canonicalCountry(c.country) || c.country || DEFAULT_COUNTRY)
  const [turnover, setTurnover] = useState(c.turnover)
  const india = isIndia(country)
  return (
    <>
      <CountryState country={c.country} state={c.state} errors={errors} onCountry={setCountry} />
      <Field id="city" label="City" required error={errors.city}>
        <input id="city" name="city" required defaultValue={c.city} autoComplete="address-level2" />
      </Field>
      <Field id="pin" label={india ? 'PIN code' : 'Postal code'} required error={errors.pin}>
        <input id="pin" name="pin" required defaultValue={c.pin} autoComplete="postal-code" inputMode={india ? 'numeric' : 'text'} />
      </Field>
      {middle}
      <Field id="turnover" label="Annual turnover" required select error={errors.turnover} hint={india ? undefined : 'In US dollars.'}>
        <select id="turnover" name="turnover" required value={turnover} onChange={(e) => setTurnover(e.target.value)}>
          <option value="">Choose…</option>
          {turnoverOptions(country).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      {india && (
        <>
          <Field id="gstin" label="GSTIN" hint="Optional. 15 characters." error={errors.gstin}>
            <input id="gstin" name="gstin" defaultValue={c.gstin} maxLength={15} style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field id="pan" label="PAN" hint="Optional. 10 characters." error={errors.pan}>
            <input id="pan" name="pan" defaultValue={c.pan} maxLength={10} style={{ textTransform: 'uppercase' }} />
          </Field>
        </>
      )}
    </>
  )
}
