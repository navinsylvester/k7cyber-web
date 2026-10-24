import { describe, expect, it } from 'vitest'

import { accountFromQuery, carry, contactFromQuery, readAccountForm, readContactForm } from '@/app/(portal)/support/workspace/customers/forms'

/* The contact and account form readers and the round trip after a refused submit (13-tester-round-1.md, TR-03, TR-04).
   No tenant needed. */

const STATE = '822edf82-c659-e811-8154-c4346bdcbf71'
const CITY = 'e0b8e571-b2f9-e911-a811-000d3af270e5'
const REGION = '97dc1861-c259-e811-814e-5065f38c8461'

const fd = (o: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}

describe('contact form', () => {
  const ok = { firstName: 'Priya', email: 'priya@example.com', mobile: '98400 00000', phone: '044 2222 2222' }

  it('accepts a well-formed contact', () => {
    expect(readContactForm(fd(ok)).errors).toEqual([])
  })

  it('refuses letters in the phone', () => {
    expect(readContactForm(fd({ ...ok, phone: 'abc' })).errors.join(' ')).toMatch(/phone number/)
    expect(readContactForm(fd({ ...ok, phone: '044 22ab 2222' })).errors.join(' ')).toMatch(/phone number/)
  })

  it('accepts the landline shapes the desk uses, two numbers included', () => {
    for (const phone of ['+91 (44) 2222-2222', '04422222222', '9416147411, 8397922011', '9911597599/ 8687218130', '8851074090 & 9597273787']) expect(readContactForm(fd({ ...ok, phone })).errors).toEqual([])
  })

  it('refuses a phone with too few or too many digits', () => {
    expect(readContactForm(fd({ ...ok, phone: '12345' })).errors).toHaveLength(1)
    expect(readContactForm(fd({ ...ok, phone: '1234567890123456' })).errors).toHaveLength(1)
    expect(readContactForm(fd({ ...ok, phone: 'sssabari1986@gmail.com' })).errors).toHaveLength(1)
  })

  it('refuses a bad mobile and a bad email', () => {
    expect(readContactForm(fd({ ...ok, mobile: '98400abc00' })).errors.join(' ')).toMatch(/mobile/)
    expect(readContactForm(fd({ ...ok, email: 'priya@example' })).errors.join(' ')).toMatch(/email/)
  })

  it('lets a stored value the agent left alone through, and only that value', () => {
    expect(readContactForm(fd({ ...ok, mobile: '12312489', keep_mobile: '12312489' })).errors).toEqual([])
    expect(readContactForm(fd({ ...ok, mobile: '1231248', keep_mobile: '12312489' })).errors.join(' ')).toMatch(/mobile/)
    expect(readContactForm(fd({ ...ok, phone: '60', keep_phone: '60' })).errors).toEqual([])
  })

  it('reads empty geography as null, so an update clears it', () => {
    const { v } = readContactForm(fd({ ...ok, stateId: '', cityId: '', regionId: '' }))
    expect([v.stateId, v.cityId, v.regionId]).toEqual([null, null, null])
  })
})

describe('account form', () => {
  it('refuses letters in the phone and accepts a landline', () => {
    expect(readAccountForm(fd({ name: 'Example Industries', phone: 'abc' })).errors.join(' ')).toMatch(/phone number/)
    expect(readAccountForm(fd({ name: 'Example Industries', phone: '044 2222 2222' })).errors).toEqual([])
  })
})

describe('carrying a refused form back', () => {
  it('round-trips every contact field, the choices included', () => {
    const { v } = readContactForm(fd({ firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com', mobile: 'bad', phone: '044 2222 2222', jobTitle: 'IT', vertical: '100000002', stateId: STATE, cityId: CITY, regionId: REGION }))
    const q = carry({ ...v, regionId: undefined }, { error: 'x', accountId: null })
    expect(q.get('error')).toBe('x')
    expect(q.has('accountId')).toBe(false)
    expect(contactFromQuery(Object.fromEntries(q))).toEqual({ firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com', mobile: 'bad', phone: '044 2222 2222', jobTitle: 'IT', vertical: 100000002, stateId: STATE, cityId: CITY })
  })

  it('round-trips every account field', () => {
    const { v } = readAccountForm(fd({ name: 'Example Industries', phone: 'abc', email: 'it@example.com', website: 'https://example.com', type: '1', vertical: '100000002', licenceKey: 'K7-123', stateId: STATE, cityId: CITY }))
    expect(accountFromQuery(Object.fromEntries(carry({ ...v, regionId: undefined })))).toEqual({ name: 'Example Industries', phone: 'abc', email: 'it@example.com', website: 'https://example.com', type: 1, vertical: 100000002, licenceKey: 'K7-123', stateId: STATE, cityId: CITY })
  })

  it('ignores ids that are not ids', () => {
    expect(contactFromQuery({ stateId: 'x', cityId: "1' or 1=1" })).toMatchObject({ stateId: null, cityId: null })
  })
})
