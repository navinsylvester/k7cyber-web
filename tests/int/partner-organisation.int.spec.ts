import { describe, expect, it } from 'vitest'

import { canMoveUser, isStandingAdmin, legalChanges, memberChangeError, memberRemoveError, normaliseLegal, reenabledStatus, toLegalEdit, validateDetails, validateLegal, validateMember } from '@/lib/partner/organisation-model'

/* The organisation and its people without a tenant (docs/partner-portal/04-portal-guide.md M3): what a Partner Admin may change
   at once and what waits for K7 (FR-REG-07), the user status machine, and the rules that keep an organisation from locking
   itself out (a standing Partner Admin always remains; nobody disables or demotes themselves). */

type M = { id: string; roles: ('admin' | 'sales' | 'technical')[]; status: 'invited' | 'active' | 'disabled' }
const admin: M = { id: 'a', roles: ['admin', 'sales'], status: 'active' }
const sales: M = { id: 's', roles: ['sales'], status: 'active' }
const invitedAdmin: M = { id: 'i', roles: ['admin'], status: 'invited' }
const offAdmin: M = { id: 'o', roles: ['admin'], status: 'disabled' }

describe('the legal identity', () => {
  it('normalises and validates like the application', () => {
    expect(normaliseLegal({ name: ' Acme Private Limited ', gstin: '33abcde1234f1z5', pan: 'abcde1234f' })).toEqual({ name: 'Acme Private Limited', gstin: '33ABCDE1234F1Z5', pan: 'ABCDE1234F' })
    expect(validateLegal({ name: 'Acme', gstin: '', pan: '' })).toEqual({})
    expect(Object.keys(validateLegal({ name: 'A', gstin: 'nope', pan: 'nope' })).sort()).toEqual(['gstin', 'name', 'pan'])
  })
  it('lists only what changes, case and spaces aside', () => {
    const cur = { name: 'Acme Private Limited', gstin: '33ABCDE1234F1Z5', pan: '' }
    expect(legalChanges(cur, { name: ' acme private limited', gstin: '33abcde1234f1z5', pan: '' })).toEqual([{ field: 'name', label: 'Legal name', from: 'Acme Private Limited', to: 'acme private limited' }])
    expect(legalChanges(cur, { name: 'Acme Private Limited ', gstin: '33abcde1234f1z5', pan: '' })).toEqual([])
    expect(legalChanges(cur, { name: 'Acme Limited', gstin: '', pan: 'ABCDE1234F' }).map((c) => c.field)).toEqual(['name', 'gstin', 'pan'])
  })
  it('reads a stored edit and ignores anything else', () => {
    expect(toLegalEdit(null)).toBeNull()
    expect(toLegalEdit({})).toBeNull()
    expect(toLegalEdit({ name: 'X', proposedAt: '2026-10-22T10:00:00.000Z', proposedBy: { id: 'u', name: 'P', email: 'p@x.in' }, reason: 'merger' })).toMatchObject({ name: 'X', gstin: '', pan: '', reason: 'merger', proposedBy: { email: 'p@x.in' } })
  })
  it('validates the details with the regions from the settings', () => {
    const d = { tradeName: '', address: '1 Road', city: 'Chennai', state: 'TN', country: 'India', pin: '600001', website: 'example.com', regions: ['S'] }
    expect(validateDetails(d, [{ code: 'S' }])).toEqual({})
    expect(validateDetails({ ...d, regions: ['X'] }, [{ code: 'S' }])).toHaveProperty('regions')
    expect(validateDetails({ ...d, regions: [] }, [])).toEqual({})
    expect(validateDetails({ ...d, website: 'not a site' }, [])).toHaveProperty('website')
    expect(validateDetails({ ...d, address: '' }, [])).toHaveProperty('address')
  })
})

describe('the people', () => {
  it('moves a user only along the machine', () => {
    expect(canMoveUser('invited', 'active')).toBe(true)
    expect(canMoveUser('invited', 'disabled')).toBe(true)
    expect(canMoveUser('active', 'disabled')).toBe(true)
    expect(canMoveUser('active', 'invited')).toBe(false)
    expect(canMoveUser('disabled', 'active')).toBe(true)
    expect(canMoveUser('disabled', 'invited')).toBe(true)
    expect(reenabledStatus({ lastSignInAt: null })).toBe('invited')
    expect(reenabledStatus({ lastSignInAt: '2026-10-22T00:00:00.000Z' })).toBe('active')
  })
  it('validates a new member: a name, a work email, a role; the mobile is optional', () => {
    expect(validateMember({ name: 'Priya Raman', email: 'priya@partner.in', designation: '', mobile: '', roles: ['sales'] })).toEqual({})
    expect(Object.keys(validateMember({ name: 'P', email: 'nope', designation: '', mobile: '12', roles: [] })).sort()).toEqual(['email', 'mobile', 'name', 'roles'])
    expect(validateMember({ name: 'Priya', email: '', designation: '', mobile: '', roles: ['admin'] }, { email: false })).toEqual({})
  })
  it('keeps a standing admin and stops self-harm', () => {
    expect(isStandingAdmin(admin)).toBe(true)
    expect(isStandingAdmin(invitedAdmin)).toBe(true)
    expect(isStandingAdmin(offAdmin)).toBe(false)
    // The only admin cannot drop the role or be disabled.
    expect(memberChangeError(admin, admin, { roles: ['sales'] }, [admin, sales])).toMatch(/cannot take/)
    expect(memberChangeError(admin, admin, { status: 'disabled' }, [admin, sales])).toMatch(/cannot disable yourself/)
    // Another admin may demote them once a second standing admin exists.
    expect(memberChangeError(invitedAdmin, admin, { roles: ['sales'] }, [admin, sales, invitedAdmin])).toBeNull()
    expect(memberChangeError(invitedAdmin, admin, { status: 'disabled' }, [admin, sales, invitedAdmin])).toBeNull()
    // A disabled admin does not count as standing.
    expect(memberChangeError(invitedAdmin, admin, { roles: ['sales'] }, [admin, offAdmin, invitedAdmin])).toBeNull()
    expect(memberChangeError(sales, admin, { roles: ['technical'] }, [admin, sales, offAdmin])).toMatch(/at least one Partner Admin/)
    // Promoting a sales user is always fine; disabling them too.
    expect(memberChangeError(admin, sales, { roles: ['sales', 'admin'] }, [admin, sales])).toBeNull()
    expect(memberChangeError(admin, sales, { status: 'disabled' }, [admin, sales])).toBeNull()
  })
  it('removes a member on the same rule', () => {
    expect(memberRemoveError(admin, admin, [admin, sales])).toMatch(/cannot remove yourself/)
    expect(memberRemoveError(admin, sales, [admin, sales])).toBeNull()
    expect(memberRemoveError(sales, admin, [admin, sales])).toMatch(/at least one Partner Admin/)
    expect(memberRemoveError(invitedAdmin, admin, [admin, sales, invitedAdmin])).toBeNull()
  })
})
