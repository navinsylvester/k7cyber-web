import React from 'react'

import { GeoPicker } from '@/components/support/CasePickers.client'
import { Field, Options } from '@/components/support/Parts'
import type { DataverseAuth } from '@/lib/dataverse/types'
import { ACCOUNT_TYPE, VERTICAL } from '@/lib/support/options'
import { getCities, getRegions, getStates, type City, type Region, type State } from '@/lib/support/reference'

/* The contact and account forms, shared by "new" and "edit" so the two never drift. Geography is the state → city cascade. */

export type Geo = { states: State[]; regions: Region[]; cities: City[] }

export const loadGeo = async (auth: DataverseAuth, stateId?: string | null): Promise<Geo> => {
  const [states, regions, cities] = await Promise.all([getStates(auth).catch(() => []), getRegions(auth).catch(() => []), stateId ? getCities(auth, stateId).catch(() => []) : Promise.resolve([] as City[])])
  return { states, regions, cities }
}

export type ContactValues = { firstName?: string; lastName?: string; email?: string; mobile?: string; phone?: string; jobTitle?: string; vertical?: number | null; stateId?: string | null; cityId?: string | null }

export const ContactFields: React.FC<{ v: ContactValues; geo: Geo; emailRequired?: boolean }> = ({ v, geo, emailRequired = true }) => (
  <>
    <Field id="firstName" label="First name" required>
      <input id="firstName" name="firstName" autoComplete="off" required defaultValue={v.firstName ?? ''} placeholder="Priya" />
    </Field>
    <Field id="lastName" label="Last name">
      <input id="lastName" name="lastName" autoComplete="off" defaultValue={v.lastName ?? ''} placeholder="Raman" />
    </Field>
    <Field id="email" label="Email address" required={emailRequired} hint="Customers sign in to the portal with this address.">
      <input id="email" name="email" type="email" inputMode="email" autoComplete="off" required={emailRequired} defaultValue={v.email ?? ''} placeholder="priya@example.com" />
    </Field>
    <Field id="mobile" label="Mobile">
      <input id="mobile" name="mobile" type="tel" inputMode="tel" autoComplete="off" defaultValue={v.mobile ?? ''} placeholder="98400 00000" />
    </Field>
    <Field id="phone" label="Phone">
      <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={v.phone ?? ''} placeholder="044 2222 2222" />
    </Field>
    <Field id="jobTitle" label="Job title">
      <input id="jobTitle" name="jobTitle" autoComplete="off" defaultValue={v.jobTitle ?? ''} placeholder="IT manager" />
    </Field>
    <Field id="vertical" label="Vertical" select>
      <select id="vertical" name="vertical" defaultValue={v.vertical ?? ''}>
        <Options items={VERTICAL} empty="Not set" />
      </select>
    </Field>
    <GeoPicker states={geo.states} regions={geo.regions} initialState={v.stateId ?? ''} initialCity={v.cityId ?? ''} cities={geo.cities} />
  </>
)

export type AccountValues = { name?: string; phone?: string; email?: string; website?: string; type?: number | null; vertical?: number | null; licenceKey?: string; stateId?: string | null; cityId?: string | null }

export const AccountFields: React.FC<{ v: AccountValues; geo: Geo }> = ({ v, geo }) => (
  <>
    <Field id="name" label="Organisation name" required span>
      <input id="name" name="name" autoComplete="off" required defaultValue={v.name ?? ''} placeholder="Example Industries Pvt Ltd" />
    </Field>
    <Field id="phone" label="Phone">
      <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={v.phone ?? ''} placeholder="044 2222 2222" />
    </Field>
    <Field id="email" label="Email address">
      <input id="email" name="email" type="email" inputMode="email" autoComplete="off" defaultValue={v.email ?? ''} placeholder="it@example.com" />
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
    <GeoPicker states={geo.states} regions={geo.regions} initialState={v.stateId ?? ''} initialCity={v.cityId ?? ''} cities={geo.cities} />
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
  if (v.firstName.length < 1) errors.push('First name is required.')
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errors.push('The email address is not valid.')
  if (v.mobile && !/^\+?[0-9 ]{10,15}$/.test(v.mobile)) errors.push('The mobile number should have 10 to 15 digits.')
  return { v, errors }
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
  if (v.name.length < 2) errors.push('The organisation name is required.')
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errors.push('The email address is not valid.')
  return { v, errors }
}
