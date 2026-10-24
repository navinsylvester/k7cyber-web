import { describe, expect, it } from 'vitest'

import { condition, layoutCells, likeAny, rootAttributes, shapeFetchXml } from '@/lib/dataverse/fetchxml'
import { and, bind, buildQuery, contains, entity, guid, or, str } from '@/lib/dataverse/odata'
import { htmlToText, sanitizeHtml, splitTicket } from '@/lib/support/format'
import { issueOtp, verifyOtp } from '@/lib/support/otp'
import { customerScopeFilter, partiesFrom } from '@/lib/support/cases'
import { productFamily } from '@/lib/support/reference'
import { STATUS } from '@/lib/support/options'
import { canReopen, caseStatusLabel, customerState, trackIndex } from '@/lib/support/status'

const VIEW = '<fetch version="1.0" output-format="xml-platform" mapping="logical" distinct="false" savedqueryid="00000000-0000-0000-00aa-000010001028"><entity name="incident"><attribute name="ticketnumber" /><attribute name="title" /><order attribute="title" descending="false" /><filter type="and"><condition attribute="ownerid" operator="eq-userid" /><condition attribute="statecode" operator="eq" value="0" /></filter><link-entity name="contact" from="contactid" to="customerid" link-type="outer"><attribute name="emailaddress1" /><order attribute="emailaddress1" descending="true" /></link-entity><attribute name="incidentid" /></entity></fetch>'

describe('FetchXML shaping', () => {
  it('adds paging and totals, drops the saved query id, keeps the view filter', () => {
    const x = shapeFetchXml(VIEW, { page: 3, count: 25, returnTotal: true })
    expect(x).toMatch(/<fetch[^>]* count="25"/)
    expect(x).toMatch(/<fetch[^>]* page="3"/)
    expect(x).toMatch(/returntotalrecordcount="true"/)
    expect(x).not.toMatch(/savedqueryid/)
    expect(x).toContain('<condition attribute="ownerid" operator="eq-userid" />')
  })
  it('replaces the root order but leaves link-entity orders alone', () => {
    const x = shapeFetchXml(VIEW, { order: { attribute: 'modifiedon', descending: true } })
    expect(x).not.toContain('<order attribute="title"')
    expect(x).toContain('<order attribute="modifiedon" descending="true" />')
    expect(x).toContain('<order attribute="emailaddress1" descending="true" />')
  })
  it('injects search conditions escaped and ensures attributes once', () => {
    const x = shapeFetchXml(VIEW, { conditions: [likeAny(['title'], 'a<b&"c')], ensureAttributes: ['title', 'statuscode'] })
    expect(x).toContain('value="%a&lt;b&amp;&quot;c%"')
    expect((x.match(/<attribute name="title" \/>/g) ?? []).length).toBe(1)
    expect(x).toContain('<attribute name="statuscode" />')
  })
  it('reads root attributes and layout cells', () => {
    expect(rootAttributes(VIEW)).toEqual(['ticketnumber', 'title', 'incidentid'])
    expect(layoutCells('<grid><row><cell name="title" width="300"/><cell name="ticketnumber" width="150"/></row></grid>')).toEqual([
      { name: 'title', width: 300 },
      { name: 'ticketnumber', width: 150 },
    ])
    expect(condition('ticketnumber', 'like', 'CS-1%')).toBe('<condition attribute="ticketnumber" operator="like" value="CS-1%" />')
  })
})

describe('OData helpers', () => {
  it('escapes literals and validates guids', () => {
    expect(str("O'Brien")).toBe("'O''Brien'")
    expect(() => guid('not-a-guid')).toThrow()
    expect(guid('4CE6DE05-56C6-F111-A05C-70A8A5675658')).toBe('4ce6de05-56c6-f111-a05c-70a8a5675658')
    expect(bind('contacts', '4ce6de05-56c6-f111-a05c-70a8a5675658')).toBe('/contacts(4ce6de05-56c6-f111-a05c-70a8a5675658)')
    expect(entity('incidents', '4ce6de05-56c6-f111-a05c-70a8a5675658')).toBe('incidents(4ce6de05-56c6-f111-a05c-70a8a5675658)')
    expect(and('a eq 1', null, 'b eq 2')).toBe('(a eq 1) and (b eq 2)')
    expect(or('a eq 1', false)).toBe('(a eq 1)')
    expect(contains('title', "x'y")).toBe("contains(title,'x''y')")
    expect(buildQuery('incidents', { select: ['a', 'b'], filter: 'a eq 1', orderby: 'b desc', top: 5, count: true })).toBe('incidents?$select=a,b&$filter=a%20eq%201&$orderby=b%20desc&$top=5&$count=true')
  })
  it('scopes every customer query to the contact, account and primary contact, never showing cancelled cases', () => {
    const f = customerScopeFilter({ contactId: '4ce6de05-56c6-f111-a05c-70a8a5675658', accountId: '258340fc-55c6-f111-a05c-6045bdc5dd6f', email: 'x@y.z' })
    expect(f).toContain('_customerid_value eq 4ce6de05-56c6-f111-a05c-70a8a5675658')
    expect(f).toContain('_primarycontactid_value eq 4ce6de05-56c6-f111-a05c-70a8a5675658')
    expect(f).toContain('_customerid_value eq 258340fc-55c6-f111-a05c-6045bdc5dd6f')
    expect(f).toContain('statecode eq 0 or statecode eq 1')
    expect(() => customerScopeFilter({ contactId: "x' or 1 eq 1", email: '' })).toThrow()
  })
})

describe('Customer status mapping (01-requirements.md §5.3)', () => {
  it('collapses the ten status reasons to four states and hides merged/cancelled', () => {
    expect(customerState(STATUS.OPEN)).toBe('received')
    expect(customerState(STATUS.REASSIGNED)).toBe('received')
    expect(customerState(STATUS.IN_PROGRESS_SUPPORT)).toBe('in-progress')
    expect(customerState(STATUS.IN_PROGRESS_LAB)).toBe('in-progress')
    expect(customerState(STATUS.IN_PROGRESS_PRINCIPLE)).toBe('in-progress')
    expect(customerState(STATUS.IN_PROGRESS_CUSTOMER)).toBe('waiting')
    expect(customerState(STATUS.CLOSED_CALL)).toBe('closed')
    expect(customerState(STATUS.CLOSED_REMOTE)).toBe('closed')
    expect(customerState(STATUS.CANCELED)).toBe('hidden')
    expect(customerState(STATUS.MERGED)).toBe('hidden')
    expect(customerState(999, 1)).toBe('closed')
    expect(trackIndex('waiting')).toBe(2)
  })
  it('allows reopening a resolved case for fourteen days', () => {
    const now = new Date().toISOString()
    const old = new Date(Date.now() - 20 * 864e5).toISOString()
    expect(canReopen(1, now)).toBe(true)
    expect(canReopen(1, old)).toBe(false)
    expect(canReopen(0, now)).toBe(false)
    expect(canReopen(2, now)).toBe(false)
  })
})

describe('One-time codes', () => {
  process.env.AUTH_SECRET ??= 'test-secret'
  it('issues a six-digit code whose token verifies once', () => {
    const { code, token, payload } = issueOtp({ email: ' Someone@Example.COM ', purpose: 'register', firstName: 'Priya' })
    expect(code).toMatch(/^\d{6}$/)
    expect(payload.email).toBe('someone@example.com')
    const r = verifyOtp(token, code)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.payload.firstName).toBe('Priya')
    expect(verifyOtp(token, code)).toMatchObject({ ok: false })
  })
  it('rejects wrong codes, tampered tokens and locks after five attempts', () => {
    const { code, token } = issueOtp({ email: 'a@b.co', purpose: 'sign-in' })
    const wrong = code === '000000' ? '000001' : '000000'
    for (let i = 0; i < 4; i++) expect(verifyOtp(token, wrong)).toEqual({ ok: false, reason: 'invalid' })
    expect(verifyOtp(token, wrong)).toEqual({ ok: false, reason: 'locked' })
    expect(verifyOtp(token, code)).toEqual({ ok: false, reason: 'locked' })
    const [body, hash] = token.split('.')
    expect(verifyOtp(`${body}.${hash}.AAAA`, code)).toEqual({ ok: false, reason: 'expired' })
    expect(verifyOtp(undefined, code)).toEqual({ ok: false, reason: 'expired' })
  })
})

describe('Formatting', () => {
  it('splits case numbers, strips html and sanitises bodies', () => {
    expect(splitTicket('CS-431548-V1T5')).toEqual({ pre: 'CS-', id: '431548-V1T5' })
    expect(htmlToText('<p>Hello<br>there</p><p>&amp; more</p>')).toBe('Hello\nthere\n\n& more')
    const s = sanitizeHtml('<p onclick="x()">ok</p><script>alert(1)</script><img src="x"><a href="javascript:alert(1)">l</a><a href="https://k7computing.com">k7</a>')
    expect(s).not.toContain('script')
    expect(s).not.toContain('onclick')
    expect(s).not.toContain('<img')
    expect(s).toContain('href="#"')
    expect(s).toContain('href="https://k7computing.com"')
    expect(productFamily('Total Security - 5U3Y')).toBe('Total Security')
    expect(productFamily('Mobile Security 1U6M')).toBe('Mobile Security')
    expect(productFamily('K7 Endpoint Security')).toBe('K7 Endpoint Security')
  })
})

/* 13-tester-round-1.md: the case head's parties (TR-07, TR-08, TR-10) and the status fallback (TR-12). */
describe('case head parties', () => {
  const ACC = 'b57d9512-c2c7-f111-a05c-7ced8daf56a6'
  it('gives a contact customer its account, its mobile and the account licence key', () => {
    const p = partiesFrom({ customerid_contact: { mobilephone: '9995716824', telephone1: '044 1', parentcustomerid_account: { accountid: ACC, name: 'BATMAN corp', k7_description: 'KEY-1' } }, customerid_account: null, primarycontactid: null })
    expect(p).toEqual({ account: { id: ACC, name: 'BATMAN corp' }, phone: '9995716824', licenceKey: 'KEY-1' })
  })
  it('falls back to the phone, then to the primary contact', () => {
    expect(partiesFrom({ customerid_contact: { mobilephone: null, telephone1: '044 1' } }).phone).toBe('044 1')
    expect(partiesFrom({ customerid_contact: { mobilephone: ' ' }, primarycontactid: { mobilephone: '98' } }).phone).toBe('98')
  })
  it('gives an account case its primary contact, else the account number, and no account row', () => {
    expect(partiesFrom({ customerid_account: { telephone1: '044 2', k7_description: 'K' }, primarycontactid: { mobilephone: '97' } })).toEqual({ account: null, phone: '97', licenceKey: 'K' })
    expect(partiesFrom({ customerid_account: { telephone1: '044 2' }, primarycontactid: null }).phone).toBe('044 2')
  })
  it('reads an empty expansion as nothing', () => {
    expect(partiesFrom({})).toEqual({ account: null, phone: '', licenceKey: '' })
  })
})

describe('case status label', () => {
  it('prefers the CRM label, then ours, then says unknown, never a bare number', () => {
    expect(caseStatusLabel({ statuscode: 1, 'statuscode@OData.Community.Display.V1.FormattedValue': 'Open' })).toBe('Open')
    expect(caseStatusLabel({ statuscode: 5 })).toBe('Closed-Call')
    expect(caseStatusLabel({ statuscode: 696720006 })).toBe('Unknown status')
    expect(caseStatusLabel({ statuscode: 696720006, 'statuscode@OData.Community.Display.V1.FormattedValue': '696720006' })).toBe('Unknown status')
    expect(caseStatusLabel({})).toBe('')
  })
})
