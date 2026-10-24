import React from 'react'

import { GeoPicker } from '@/components/support/CasePickers.client'
import { Field, Options } from '@/components/support/Parts'
import type { DataverseAuth } from '@/lib/dataverse/types'
import { ACCOUNT_TYPE, VERTICAL } from '@/lib/support/options'
import { getCities, getRegions, getStates, type City, type Region, type State } from '@/lib/support/reference'

/* The contact and account forms, shared by "new" and "edit" so the two never drift. Geography is the state → city cascade.
   The format rules live here once: the readers apply them on the server and the inputs carry the same rules as HTML
   patterns, so the common mistakes are stopped in the browser before the form leaves (13-tester-round-1.md, TR-03/TR-04). */

export type Geo = { states: State[]; regions: Region[]; cities: City[] }

export const loadGeo = async (auth: DataverseAuth, stateId?: string | null): Promise<Geo> => {
  const [states, regions, cities] = await Promise.all([getStates(auth).catch(() => []), getRegions(auth).catch(() => []), stateId ? getCities(auth, stateId).catch(() => []) : Promise.resolve([] as City[])])
  return { states, regions, cities }
}

/** Mobile: 10 to 15 digits and spaces, an optional leading +. */
const MOBILE = /^\+?[0-9 ]{10,15}$/
/** Landline: digits, spaces, + - ( ), with 6 to 15 digits; the desk often keeps two numbers, separated by / , or &. */
const PHONE_ONE = /^(?=(?:[^0-9]*[0-9]){6,15}[^0-9]*$)[0-9 +()-]+$/
const phoneOk = (v: string) => v.split(/[\/,&]/).every((part) => PHONE_ONE.test(part.trim()))
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/* The browser half of the same rules, as HTML `pattern` attributes (matched whole, with the v flag, so the punctuation in
   a class is escaped). The phone pattern only refuses letters; the digit count per number is the server's. */
const MOBILE_PATTERN = '\\+?[0-9 ]{10,15}'
const PHONE_PATTERN = '[0-9 +\\(\\)\\-\\/,&]*[0-9][0-9 +\\(\\)\\-\\/,&]*'
const EMAIL_PATTERN = '[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}'
const MOBILE_HINT = '10 to 15 digits, spaces allowed, an optional + in front.'
const PHONE_HINT = 'Digits with spaces, +, - or brackets; separate two numbers with / or a comma.'
const EMAIL_HINT = 'A full address, such as priya@example.com.'

/* An edit panel opens on what the CRM holds, and some of it predates these rules ("9416147411, 8397922011" is fine, a
   mobile of eight digits is not). A stored value the agent leaves as it is must not block an unrelated change, so the
   edit panels pass the record's values as `stored`: a stored value that breaks the rule drops the browser pattern and is
   sent as `keep_<name>`, and the readers skip the format check while the field still equals it. */
type Stored = { mobile?: string; phone?: string }
const Keep: React.FC<{ name: string; value?: string; ok: (v: string) => boolean }> = ({ name, value, ok }) => (value && !ok(value) ? <input type="hidden" name={`keep_${name}`} value={value} /> : null)
const patternFor = (stored: string | undefined, ok: (v: string) => boolean, pattern: string) => (stored && !ok(stored) ? undefined : pattern)
const kept = (form: FormData, k: string, v: string) => v !== '' && str(form, `keep_${k}`) === v

export type ContactValues = { firstName?: string; lastName?: string; email?: string; mobile?: string; phone?: string; jobTitle?: string; vertical?: number | null; stateId?: string | null; cityId?: string | null }

export const ContactFields: React.FC<{ v: ContactValues; geo: Geo; emailRequired?: boolean; stored?: Stored; bad?: string[] }> = ({ v, geo, emailRequired = true, stored = {}, bad = [] }) => (
  <>
    <Field id="firstName" label="First name" required error={bad.includes('firstName') ? 'Enter the first name.' : undefined}>
      <input id="firstName" name="firstName" autoComplete="off" required defaultValue={v.firstName ?? ''} placeholder="Priya" />
    </Field>
    <Field id="lastName" label="Last name">
      <input id="lastName" name="lastName" autoComplete="off" defaultValue={v.lastName ?? ''} placeholder="Raman" />
    </Field>
    <Field id="email" label="Email address" required={emailRequired} hint="Customers sign in to the portal with this address." error={bad.includes('email') ? EMAIL_HINT : undefined}>
      <input id="email" name="email" type="email" inputMode="email" autoComplete="off" required={emailRequired} defaultValue={v.email ?? ''} placeholder="priya@example.com" pattern={EMAIL_PATTERN} title={EMAIL_HINT} />
    </Field>
    <Field id="mobile" label="Mobile" error={bad.includes('mobile') ? MOBILE_HINT : undefined}>
      <input id="mobile" name="mobile" type="tel" inputMode="tel" autoComplete="off" defaultValue={v.mobile ?? ''} placeholder="98400 00000" pattern={patternFor(stored.mobile, (x) => MOBILE.test(x), MOBILE_PATTERN)} title={MOBILE_HINT} />
      <Keep name="mobile" value={stored.mobile} ok={(x) => MOBILE.test(x)} />
    </Field>
    <Field id="phone" label="Phone" error={bad.includes('phone') ? PHONE_HINT : undefined}>
      <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={v.phone ?? ''} placeholder="044 2222 2222" pattern={patternFor(stored.phone, phoneOk, PHONE_PATTERN)} title={PHONE_HINT} />
      <Keep name="phone" value={stored.phone} ok={phoneOk} />
    </Field>
    <Field id="jobTitle" label="Job title">
      <input id="jobTitle" name="jobTitle" autoComplete="off" defaultValue={v.jobTitle ?? ''} placeholder="IT manager" />
    </Field>
    <Field id="vertical" label="Vertical" select>
      <select id="vertical" name="vertical" defaultValue={v.vertical ?? ''}>
        <Options items={VERTICAL} empty="Not set" />
      </select>
    </Field>
    <GeoPicker states={geo.states} regions={geo.regions} initialState={v.stateId ?? ''} initialCity={v.cityId ?? ''} cities={geo.cities} bad={bad} />
  </>
)

export type AccountValues = { name?: string; phone?: string; email?: string; website?: string; type?: number | null; vertical?: number | null; licenceKey?: string; stateId?: string | null; cityId?: string | null }

export const AccountFields: React.FC<{ v: AccountValues; geo: Geo; stored?: Stored; bad?: string[] }> = ({ v, geo, stored = {}, bad = [] }) => (
  <>
    <Field id="name" label="Organisation name" required span error={bad.includes('name') ? 'Enter the organisation name, at least two characters.' : undefined}>
      <input id="name" name="name" autoComplete="off" required defaultValue={v.name ?? ''} placeholder="Example Industries Pvt Ltd" />
    </Field>
    <Field id="phone" label="Phone" error={bad.includes('phone') ? PHONE_HINT : undefined}>
      <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={v.phone ?? ''} placeholder="044 2222 2222" pattern={patternFor(stored.phone, phoneOk, PHONE_PATTERN)} title={PHONE_HINT} />
      <Keep name="phone" value={stored.phone} ok={phoneOk} />
    </Field>
    <Field id="email" label="Email address" error={bad.includes('email') ? EMAIL_HINT : undefined}>
      <input id="email" name="email" type="email" inputMode="email" autoComplete="off" defaultValue={v.email ?? ''} placeholder="it@example.com" pattern={EMAIL_PATTERN} title={EMAIL_HINT} />
    </Field>
    <Field id="website" label="Website">
      <input id="website" name="website" type="url" inputMode="url" autoComplete="off" defaultValue={v.website ?? ''} placeholder="https://example.com" />
    </Field>
    <Field id="type" label="Account type" select>
      <select id="type" name="type" defaultValue={v.type ?? ''}>
        <Options items={ACCOUNT_TYPE} empty="Not set" />
      </select>
    </Field>
    <Field id="vertical" label="Vertical" select>
      <select id="vertical" name="vertical" defaultValue={v.vertical ?? ''}>
        <Options items={VERTICAL} empty="Not set" />
      </select>
    </Field>
    <Field id="licenceKey" label="Licence key" hint="Stored in the account's description field, as the desk does today.">
      <input id="licenceKey" name="licenceKey" autoComplete="off" defaultValue={v.licenceKey ?? ''} spellCheck={false} />
    </Field>
    <GeoPicker states={geo.states} regions={geo.regions} initialState={v.stateId ?? ''} initialCity={v.cityId ?? ''} cities={geo.cities} bad={bad} />
  </>
)

const str = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const num = (form: FormData, k: string): number | undefined => {
  const v = str(form, k)
  return v === '' ? undefined : Number(v)
}
const id = (form: FormData, k: string): string | null => {
  const v = str(form, k)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null
}

/** Reads the contact form; `errors` lists what to fix. */
export const readContactForm = (form: FormData) => {
  const v = {
    firstName: str(form, 'firstName'),
    lastName: str(form, 'lastName'),
    email: str(form, 'email').toLowerCase(),
    mobile: str(form, 'mobile'),
    phone: str(form, 'phone'),
    jobTitle: str(form, 'jobTitle'),
    vertical: num(form, 'vertical'),
    stateId: id(form, 'stateId'),
    cityId: id(form, 'cityId'),
    regionId: id(form, 'regionId'),
  }
  const errors: string[] = []
  const bad: string[] = []
  const fail = (field: string, message: string) => (errors.push(message), bad.push(field))
  if (v.firstName.length < 1) fail('firstName', 'First name is required.')
  if (v.email && !EMAIL.test(v.email)) fail('email', 'The email address is not valid.')
  if (v.mobile && !kept(form, 'mobile', v.mobile) && !MOBILE.test(v.mobile)) fail('mobile', 'The mobile number should have 10 to 15 digits.')
  if (v.phone && !kept(form, 'phone', v.phone) && !phoneOk(v.phone)) fail('phone', 'The phone number should have 6 to 15 digits per number, with only spaces, +, - or brackets between them.')
  return { v, errors, bad }
}

export const readAccountForm = (form: FormData) => {
  const v = {
    name: str(form, 'name'),
    phone: str(form, 'phone'),
    email: str(form, 'email'),
    website: str(form, 'website'),
    type: num(form, 'type'),
    vertical: num(form, 'vertical'),
    licenceKey: str(form, 'licenceKey'),
    stateId: id(form, 'stateId'),
    cityId: id(form, 'cityId'),
    regionId: id(form, 'regionId'),
  }
  const errors: string[] = []
  const bad: string[] = []
  const fail = (field: string, message: string) => (errors.push(message), bad.push(field))
  if (v.name.length < 2) fail('name', 'The organisation name is required.')
  if (v.phone && !kept(form, 'phone', v.phone) && !phoneOk(v.phone)) fail('phone', 'The phone number should have 6 to 15 digits per number, with only spaces, +, - or brackets between them.')
  if (v.email && !EMAIL.test(v.email)) fail('email', 'The email address is not valid.')
  return { v, errors, bad }
}

/* ---------- Carrying a submitted form back after an error (TR-03) ----------
   A server-side error redirects to the form with every submitted value in the query, and the page reads them back, so
   the vertical, the state, the city and the organisation are still chosen when the agent fixes the one field. */

type Submitted = { [k: string]: string | number | null | undefined }

/** The submitted values as query parameters, empty ones left out. */
export const carry = (values: Submitted, extra: Record<string, string | null | undefined> = {}): URLSearchParams => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...values, ...extra })) if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  return q
}

type Query = { [k: string]: string | string[] | undefined }
const one = (sp: Query, k: string): string | undefined => {
  const v = sp[k]
  return Array.isArray(v) ? v[0] : v
}
const oneNum = (sp: Query, k: string): number | null => {
  const v = one(sp, k)
  return v && /^[0-9]+$/.test(v) ? Number(v) : null
}
const oneId = (sp: Query, k: string): string | null => {
  const v = one(sp, k) ?? ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null
}

/** Contact values read back from the query `carry` wrote. */
export const contactFromQuery = (sp: Query): ContactValues => ({
  firstName: one(sp, 'firstName') ?? '',
  lastName: one(sp, 'lastName') ?? '',
  email: one(sp, 'email') ?? '',
  mobile: one(sp, 'mobile') ?? '',
  phone: one(sp, 'phone') ?? '',
  jobTitle: one(sp, 'jobTitle') ?? '',
  vertical: oneNum(sp, 'vertical'),
  stateId: oneId(sp, 'stateId'),
  cityId: oneId(sp, 'cityId'),
})

/** Account values read back from the query `carry` wrote. */
export const accountFromQuery = (sp: Query): AccountValues => ({
  name: one(sp, 'name') ?? '',
  phone: one(sp, 'phone') ?? '',
  email: one(sp, 'email') ?? '',
  website: one(sp, 'website') ?? '',
  type: oneNum(sp, 'type'),
  vertical: oneNum(sp, 'vertical'),
  licenceKey: one(sp, 'licenceKey') ?? '',
  stateId: oneId(sp, 'stateId'),
  cityId: oneId(sp, 'cityId'),
})

/** The city must belong to the chosen state, and a city without a state is refused (TR-05). */
export const checkGeo = async (auth: DataverseAuth, v: { stateId: string | null; cityId: string | null }, errors: string[], bad: string[]): Promise<void> => {
  if (!v.cityId) return
  if (!v.stateId) {
    errors.push('Choose the state before the city.')
    bad.push('stateId')
    return
  }
  const cities = await getCities(auth, v.stateId).catch(() => null)
  if (cities && !cities.some((c) => c.id.toLowerCase() === v.cityId!.toLowerCase())) {
    errors.push('That city is not in the chosen state; choose the city again.')
    bad.push('cityId')
  }
}

/** The fields a refused submit marks, read back from the `bad` parameter (TR-14). */
export const badFromQuery = (sp: Query): string[] => (one(sp, 'bad') ?? '').split(',').filter(Boolean)
