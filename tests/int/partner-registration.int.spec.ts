import { describe, expect, it } from 'vitest'

import { formatId } from '@/lib/partner/ids'
import { accountBody, clarificationNote, contactBody, normaliseWebsite, readyToSubmit, SIZE_BANDS, TURNOVER_BANDS, validateCompany, validateContact, validateRegions, yearsInBusinessBand, type Application, type Company } from '@/lib/partner/registration-model'
import { alreadyLine, canMoveApplication, canMoveOrg, decisionPath, isOpenApplication, isRepeatedDecision } from '@/lib/partner/status'

/* The application's machine, validation and CRM mapping without a tenant (docs/partner-portal/04-portal-guide.md M2). */

const company: Company = { legalName: 'Example Technologies Private Limited', tradeName: 'Example Tech', address: '12 Mount Road', city: 'Chennai', state: 'Tamil Nadu', country: 'India', pin: '600002', website: 'www.example.com', yearOfIncorporation: 2012, size: '11-50', turnover: '6-10', gstin: '33ABCDE1234F1Z5', pan: 'ABCDE1234F' }
const contact = { name: 'Priya Raman', designation: 'Director', email: 'priya@example.com', mobile: '+91 98400 00000' }

describe('application status machine (01-requirements.md §3.2)', () => {
  it('follows the table: submitted → under review → approved | rejected | clarification → submitted', () => {
    expect(canMoveApplication('draft', 'submitted')).toBe(true)
    expect(canMoveApplication('submitted', 'underReview')).toBe(true)
    expect(canMoveApplication('submitted', 'approved')).toBe(false)
    expect(canMoveApplication('underReview', 'approved')).toBe(true)
    expect(canMoveApplication('underReview', 'rejected')).toBe(true)
    expect(canMoveApplication('underReview', 'clarification')).toBe(true)
    expect(canMoveApplication('clarification', 'submitted')).toBe(true)
    expect(canMoveApplication('clarification', 'approved')).toBe(false)
    expect(canMoveApplication('approved', 'rejected')).toBe(false)
    expect(canMoveApplication('rejected', 'submitted')).toBe(false)
  })
  it('lets a decision on a submitted application assign it first, and refuses decisions elsewhere', () => {
    expect(decisionPath('submitted', 'approve')).toEqual(['underReview', 'approved'])
    expect(decisionPath('underReview', 'reject')).toEqual(['rejected'])
    expect(decisionPath('clarification', 'approve')).toEqual([])
    expect(decisionPath('approved', 'clarify')).toEqual([])
    expect(decisionPath('rejected', 'approve')).toEqual([])
  })
  it('knows which states are open and that an organisation only toggles', () => {
    expect(['submitted', 'underReview', 'clarification'].every((s) => isOpenApplication(s as 'submitted'))).toBe(true)
    expect(isOpenApplication('approved')).toBe(false)
    expect(canMoveOrg('approved', 'suspended')).toBe(true)
    expect(canMoveOrg('approved', 'approved')).toBe(false)
  })
})

describe('join validation (FR-REG-02, appendix 6)', () => {
  it('accepts a complete company and reports what is missing field by field', () => {
    expect(validateCompany(company, 2026)).toEqual({})
    const bad = validateCompany({ ...company, legalName: 'X', pin: '', yearOfIncorporation: 2031, size: '' as Company['size'], gstin: 'nope', pan: 'short' }, 2026)
    expect(Object.keys(bad).sort()).toEqual(['gstin', 'legalName', 'pan', 'pin', 'size', 'yearOfIncorporation'])
  })
  it('keeps GSTIN and PAN optional', () => {
    expect(validateCompany({ ...company, gstin: '', pan: '' }, 2026)).toEqual({})
  })
  it('checks the contact and the regions', () => {
    expect(validateContact(contact)).toEqual({})
    expect(Object.keys(validateContact({ ...contact, email: 'not-an-email', mobile: '123' })).sort()).toEqual(['contactEmail', 'contactMobile'])
    expect(validateRegions(['S'], [{ code: 'S' }, { code: 'N' }])).toEqual({})
    expect(validateRegions(['X'], [{ code: 'S' }])).toHaveProperty('regions')
    expect(validateRegions([], [])).toEqual({})
  })
  it('refuses to submit until the email is verified', () => {
    const app = { company, contact: { ...contact, emailVerifiedAt: null, mobileVerifiedAt: null, mobileVerification: 'none' as const }, regions: ['S'] }
    expect(readyToSubmit(app, [{ code: 'S' }])).toEqual({ emailVerified: 'The contact email has not been verified yet.' })
    expect(readyToSubmit({ ...app, contact: { ...app.contact, emailVerifiedAt: '2026-10-22T10:00:00.000Z' } }, [{ code: 'S' }])).toEqual({})
  })
  it('normalises a website and reads the latest clarification note', () => {
    expect(normaliseWebsite('www.example.com')).toBe('https://www.example.com')
    expect(normaliseWebsite('http://example.com/x')).toBe('http://example.com/x')
    expect(normaliseWebsite('  ')).toBe('')
    const decisions: Application['decisions'] = [
      { to: 'submitted', byName: 'P', byEmail: 'p@x', at: '1', comment: '' },
      { to: 'clarification', byName: 'K', byEmail: 'k@x', at: '2', comment: 'first' },
      { to: 'submitted', byName: 'P', byEmail: 'p@x', at: '3', comment: '' },
      { to: 'clarification', byName: 'K', byEmail: 'k@x', at: '4', comment: 'second' },
    ]
    expect(clarificationNote({ decisions })?.comment).toBe('second')
    expect(clarificationNote({ decisions: [] })).toBeNull()
  })
})

describe('CRM account mapping (03-dynamics-exploration.md §6)', () => {
  it('maps the partner type and the bands by value, never by label', () => {
    const { body } = accountBody({ name: company.legalName, type: 'distributor', website: 'https://www.example.com', email: contact.email, phone: contact.mobile, address: company.address, city: company.city, state: company.state, country: company.country, pin: company.pin, turnover: '6-10', size: '11-50', yearOfIncorporation: 2012, approvedAt: '2026-10-22T10:00:00.000Z' }, 2026)
    expect(body).toMatchObject({ name: company.legalName, alletec_accounttype: 2, alletec_accountsubtype: 3, alletec_approxlyturnover: 2, alletec_salesforcecount: 5, alletec_noofyearsinitbusiness: 3, alletec_associatedwithk7on: '2026-10-22', address1_city: 'Chennai', address1_postalcode: '600002', websiteurl: 'https://www.example.com' })
    expect(accountBody({ name: 'V', type: 'var', website: '', email: '', phone: '', address: '', city: '', state: '', country: '', pin: '', turnover: '', size: '', yearOfIncorporation: null, approvedAt: '2026-10-22' }).body).toEqual({ name: 'V', alletec_accounttype: 0, alletec_accountsubtype: 3, alletec_associatedwithk7on: '2026-10-22' })
    expect(accountBody({ name: 'I', type: 'integrationPartner', website: '', email: '', phone: '', address: '', city: '', state: '', country: '', pin: '', turnover: '', size: '', yearOfIncorporation: null, approvedAt: '2026-10-22' }).body.alletec_accounttype).toBe(0)
  })
  it('bands the years in business and keeps every band on a CRM value', () => {
    expect(yearsInBusinessBand(2026, 2026)).toBe(0)
    expect(yearsInBusinessBand(2021, 2026)).toBe(1)
    expect(yearsInBusinessBand(2000, 2026)).toBe(6)
    expect(yearsInBusinessBand(1990, 2026)).toBe(7)
    expect(TURNOVER_BANDS.map((b) => b.crm)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(SIZE_BANDS.every((b) => [4, 5, 6].includes(b.crm))).toBe(true)
  })
  it('splits the contact name and writes no customer type (the contact has none)', () => {
    expect(contactBody(contact)).toEqual({ firstname: 'Priya', lastname: 'Raman', jobtitle: 'Director', emailaddress1: 'priya@example.com', mobilephone: '+919840000000' })
    expect(contactBody({ name: 'Madonna', designation: '', email: '', mobile: '' })).toEqual({ firstname: 'Madonna', lastname: '.' })
  })
  it('formats the portal identifiers', () => {
    expect(formatId('partner', 1)).toBe('K7P-00001')
    expect(formatId('application', 123)).toBe('K7A-00123')
    expect(formatId('deal', 99999)).toBe('K7D-99999')
  })
})

describe('the same decision twice (B-03)', () => {
  it('reads a second click as done, and a different decision still meets the machine', () => {
    expect(isRepeatedDecision('approved', 'approve')).toBe(true)
    expect(isRepeatedDecision('rejected', 'reject')).toBe(true)
    expect(isRepeatedDecision('clarification', 'clarify')).toBe(true)
    expect(isRepeatedDecision('underReview', 'approve')).toBe(false)
    expect(isRepeatedDecision('approved', 'reject')).toBe(false)
    expect(decisionPath('approved', 'reject')).toEqual([])
    expect(isRepeatedDecision('rejected', 'approve')).toBe(false)
    expect(alreadyLine('approve', 'Asha K')).toBe('Already approved by Asha K.')
    expect(alreadyLine('clarify')).toBe('Already sent back for clarification.')
  })
})
