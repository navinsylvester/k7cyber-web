import { ISO_COUNTRIES, ISO_SUBDIVISIONS } from './iso-data'

/* Countries and their first-level subdivisions for every form that asks where someone is (the website's enquiry forms, the partner
   join and organisation pages). Client-safe: the lists ship to the browser so the state follows the country without a round trip.
   A country with a list gets a State select; any other country gets a free-text "State / province" that may stay blank.

   India's list is written to match K7's CRM (k7_states on Dynamics) and carries the CRM's region per state, which the Channel Manager
   is offered as the suggestion when assigning a partner's region (docs/partner-portal/04-portal-guide.md). The CRM's country and
   state rows are spelled differently in places; `crmCountryName` / `crmStateName` give the CRM's spelling for the lookups. */

export const DEFAULT_COUNTRY = 'India'
export const COUNTRIES: readonly string[] = ISO_COUNTRIES

/** India: state or union territory → [the CRM's k7_state spelling, the CRM's region for it]. */
const INDIA: Record<string, [crm: string, region: string]> = {
  'Andaman and Nicobar Islands': ['Andaman & Nicobar (UT)', 'East'],
  'Andhra Pradesh': ['Andhra Pradesh', 'South'],
  'Arunachal Pradesh': ['Arunachal Pradesh', 'East'],
  Assam: ['Assam', 'East'],
  Bihar: ['Bihar', 'East'],
  Chandigarh: ['Chandigarh (UT)', 'North'],
  Chhattisgarh: ['Chhattisgarh', 'Central'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Dadra and Nagar (UT)', 'West'],
  Delhi: ['Delhi (UT)', 'North'],
  Goa: ['Goa', 'West'],
  Gujarat: ['Gujarat', 'West'],
  Haryana: ['Haryana', 'North'],
  'Himachal Pradesh': ['Himachal Pradesh', 'North'],
  'Jammu and Kashmir': ['Jammu and Kashmir', 'North'],
  Jharkhand: ['Jharkhand', 'East'],
  Karnataka: ['Karnataka', 'South'],
  Kerala: ['Kerala', 'South'],
  Ladakh: ['Ladakh', 'North'],
  Lakshadweep: ['Lakshadweep (UT)', 'West'],
  'Madhya Pradesh': ['Madhya Pradesh', 'North'],
  Maharashtra: ['Maharashtra', 'West'],
  Manipur: ['Manipur', 'East'],
  Meghalaya: ['Meghalaya', 'East'],
  Mizoram: ['Mizoram', 'East'],
  Nagaland: ['Nagaland', 'East'],
  Odisha: ['Odisha', 'East'],
  Puducherry: ['Pudhucherry (UT)', 'South'],
  Punjab: ['Punjab', 'North'],
  Rajasthan: ['Rajasthan', 'North'],
  Sikkim: ['Sikkim', 'East'],
  'Tamil Nadu': ['Tamil Nadu', 'South'],
  Telangana: ['Telangana', 'South'],
  Tripura: ['Tripura', 'East'],
  'Uttar Pradesh': ['Uttar Pradesh', 'North'],
  Uttarakhand: ['Uttarakhand', 'North'],
  'West Bengal': ['West Bengal', 'East'],
}

const WRITTEN: Record<string, readonly string[]> = {
  India: Object.keys(INDIA),
  'United Arab Emirates': ['Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain'],
  'Saudi Arabia': ['Al Bahah', 'Al Jawf', 'Asir', 'Eastern Province', 'Hail', 'Jazan', 'Madinah', 'Makkah', 'Najran', 'Northern Borders', 'Qassim', 'Riyadh', 'Tabuk'],
  Malaysia: ['Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis', 'Putrajaya', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu'],
  'United Kingdom': ['England', 'Northern Ireland', 'Scotland', 'Wales'],
}

const SUBDIVISIONS: Readonly<Record<string, readonly string[]>> = { ...ISO_SUBDIVISIONS, ...WRITTEN }

/** The CRM spells some countries its own way (alletec_countries). */
const CRM_COUNTRY: Record<string, string> = { 'United Arab Emirates': 'United Arab Emirates (UAE)', Czechia: 'Czech Republic' }

/** Older free-text values that should read as one of the listed countries (applications filed before the list). */
const COUNTRY_ALIASES: Record<string, string> = { uae: 'United Arab Emirates', 'united arab emirates (uae)': 'United Arab Emirates', usa: 'United States', us: 'United States', uk: 'United Kingdom', ksa: 'Saudi Arabia', 'czech republic': 'Czechia', turkey: 'Türkiye' }

const norm = (s: string) => s.trim().toLowerCase()
/** States compare loosely: "tamilnadu", "Tamil Nadu" and "Tamil-Nadu" are one state. */
const loose = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '')

/** The listed country a typed value means, or '' when it is none of them. */
export const canonicalCountry = (value: string): string => {
  const n = norm(value)
  if (!n) return ''
  return COUNTRIES.find((c) => norm(c) === n) ?? COUNTRY_ALIASES[n] ?? ''
}

export const isIndia = (country: string): boolean => canonicalCountry(country) === 'India'

/** The states to pick from, or an empty list when the country takes free text. */
export const statesOf = (country: string): readonly string[] => SUBDIVISIONS[canonicalCountry(country)] ?? []

/** The listed state a typed value means within its country ('' when the country has a list and it is not on it). */
export const canonicalState = (country: string, value: string): string => {
  const list = statesOf(country)
  if (!list.length) return value.trim()
  const n = loose(value)
  if (!n) return ''
  return list.find((s) => loose(s) === n) ?? (isIndia(country) ? (Object.keys(INDIA).find((k) => loose(INDIA[k][0]) === n) ?? '') : '')
}

export const crmCountryName = (country: string): string => {
  const c = canonicalCountry(country) || country.trim()
  return CRM_COUNTRY[c] ?? c
}

export const crmStateName = (country: string, state: string): string => (isIndia(country) ? (INDIA[canonicalState(country, state)]?.[0] ?? state.trim()) : state.trim())

/** The CRM's region word for an Indian state (North, South, East, West, Central), or '' outside India. */
export const crmRegionOfState = (country: string, state: string): string => (isIndia(country) ? (INDIA[canonicalState(country, state)]?.[1] ?? '') : '')

/** Amounts are asked in rupees in India and in US dollars everywhere else. */
export type Currency = 'INR' | 'USD'
export const currencyOf = (country: string): Currency => (!country.trim() || isIndia(country) ? 'INR' : 'USD')
