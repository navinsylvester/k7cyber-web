import { describe, expect, it } from 'vitest'

import { canonicalCountry, canonicalState, COUNTRIES, crmCountryName, crmRegionOfState, crmStateName, currencyOf, isIndia, statesOf } from '@/lib/geo'

describe('countries and states (tester round, partner enquiry and join forms)', () => {
  it('lists every country once, India among them', () => {
    expect(COUNTRIES.length).toBeGreaterThan(240)
    expect(new Set(COUNTRIES).size).toBe(COUNTRIES.length)
    expect([...COUNTRIES].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))).toEqual(COUNTRIES)
    for (const c of ['India', 'Singapore', 'United Arab Emirates', 'Saudi Arabia', 'United States', 'South Korea', 'Vietnam', 'Russia']) expect(COUNTRIES).toContain(c)
  })
  it('reads older free-text countries as listed ones', () => {
    expect(canonicalCountry(' india ')).toBe('India')
    expect(canonicalCountry('UAE')).toBe('United Arab Emirates')
    expect(canonicalCountry('Narnia')).toBe('')
    expect(isIndia('INDIA')).toBe(true)
  })
  it('gives the states of a country with a list and nothing for one without', () => {
    expect(statesOf('India')).toContain('Tamil Nadu')
    expect(statesOf('India')).toHaveLength(36)
    expect(statesOf('United Arab Emirates')).toContain('Dubai')
    expect(statesOf('Singapore')).toEqual([])
    expect(canonicalState('India', 'tamil nadu')).toBe('Tamil Nadu')
    expect(canonicalState('India', 'tamilnadu')).toBe('Tamil Nadu')
    expect(canonicalState('India', 'Pudhucherry (UT)')).toBe('Puducherry')
    expect(canonicalState('India', 'Narnia')).toBe('')
    expect(crmRegionOfState('India', 'tamilnadu')).toBe('South')
    expect(canonicalState('India', 'Delhi (UT)')).toBe('Delhi')
    expect(canonicalState('Singapore', ' Central ')).toBe('Central')
  })
  it('spells countries and states the CRM way and suggests the CRM region', () => {
    expect(crmCountryName('United Arab Emirates')).toBe('United Arab Emirates (UAE)')
    expect(crmCountryName('India')).toBe('India')
    expect(crmStateName('India', 'Puducherry')).toBe('Pudhucherry (UT)')
    expect(crmStateName('Malaysia', 'Johor')).toBe('Johor')
    expect(crmRegionOfState('India', 'Karnataka')).toBe('South')
    expect(crmRegionOfState('Malaysia', 'Johor')).toBe('')
  })
  it('asks amounts in rupees for India and US dollars elsewhere', () => {
    expect(currencyOf('India')).toBe('INR')
    expect(currencyOf('')).toBe('INR')
    expect(currencyOf('Singapore')).toBe('USD')
  })
})
