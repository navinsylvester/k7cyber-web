import { describe, expect, it } from 'vitest'

import { filterOptions, normalise, settle, uniqueByName } from '@/lib/support/filter-options'

/* The type-to-filter field's matching (filter-options.ts; the State and City fields, testers' note of 2026-11-26). */

const o = (name: string) => ({ id: name.toLowerCase().replace(/\W+/g, '-'), name })
const CITIES = ['Ambattur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Kanchipuram', 'Madurai', 'Old Chennai Road', 'Pallikaranai', 'Tiruchirappalli'].map(o)
const STATES = ['Andhra Pradesh', 'Madhya Pradesh', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh'].map(o)

describe('filterOptions', () => {
  it('keeps everything for an empty query', () => {
    expect(filterOptions(CITIES, '  ')).toHaveLength(CITIES.length)
  })

  it('narrows to the entries that contain the text, the ones that start with it first', () => {
    expect(filterOptions(CITIES, 'chen').map((c) => c.name)).toEqual(['Chengalpattu', 'Chennai', 'Old Chennai Road'])
    expect(filterOptions(CITIES, 'chenn').map((c) => c.name)).toEqual(['Chennai', 'Old Chennai Road'])
    expect(filterOptions(CITIES, 'pura').map((c) => c.name)).toEqual(['Kanchipuram'])
  })

  it('ranks a word that starts with the text before a match inside a word', () => {
    expect(filterOptions(STATES, 'prad').map((s) => s.name)).toEqual(['Andhra Pradesh', 'Madhya Pradesh', 'Uttar Pradesh'])
    expect(filterOptions(STATES, 'nadu').map((s) => s.name)).toEqual(['Tamil Nadu'])
    expect(filterOptions(STATES, 'an').map((s) => s.name)).toEqual(['Andhra Pradesh', 'Telangana'])
  })

  it('ignores case, accents and extra spaces', () => {
    expect(normalise('  Tamil   NADU ')).toBe('tamil nadu')
    expect(filterOptions([o('Pondichéry')], 'pondiche')).toHaveLength(1)
  })
})

describe('settle', () => {
  it('takes an exact name, or the only match, or nothing', () => {
    expect(settle(CITIES, 'chennai')?.name).toBe('Chennai')
    expect(settle(CITIES, 'madu')?.name).toBe('Madurai')
    expect(settle(CITIES, 'chen')).toBeNull()
    expect(settle(CITIES, 'xyz')).toBeNull()
    expect(settle(CITIES, '')).toBeNull()
  })
})

describe('uniqueByName', () => {
  // UAT's two city sets: the production copy (listed first, newest) and UAT's own.
  const TWICE = [
    { id: 'prod-chennai', name: 'Chennai' },
    { id: 'uat-chennai', name: 'Chennai' },
    { id: 'prod-madurai', name: 'Madurai' },
    { id: 'uat-madurai', name: 'madurai ' },
  ]

  it('shows each name once, the first listed', () => {
    expect(uniqueByName(TWICE).map((c) => c.id)).toEqual(['prod-chennai', 'prod-madurai'])
  })

  it('keeps the record’s own choice for its name', () => {
    expect(uniqueByName(TWICE, 'UAT-CHENNAI').map((c) => c.id)).toEqual(['uat-chennai', 'prod-madurai'])
    expect(uniqueByName(TWICE, 'unknown').map((c) => c.id)).toEqual(['prod-chennai', 'prod-madurai'])
  })

  it('lets a single match settle once the twin is gone', () => {
    expect(settle(TWICE, 'madu')).toBeNull()
    expect(settle(uniqueByName(TWICE), 'madu')?.id).toBe('prod-madurai')
  })
})
