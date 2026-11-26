import { describe, expect, it } from 'vitest'

import { DataverseError } from '@/lib/dataverse/errors'
import { columnList, isSecuredRefusalCode, may, notSaved, rightsFrom, skippedFrom, withoutLocked, writeAroundSecured } from '@/lib/support/field-security-model'

/* Dynamics field security in the portal (field-security-model.ts), without a tenant. The ids and codes are UAT's (2026-11-26). */

const SECURED = [
  { id: '3807D5ED-A947-E811-814B-5065F38C1521', column: 'k7_incidentid' },
  { id: 'aaaaaaaa-0000-0000-0000-000000000002', column: 'k7_module' },
]
const refusal = (code: string) => new DataverseError('Caller user does not have update permissions to a Incident ID secured field', { status: 403, code })
const isRefusal = (e: unknown) => e instanceof DataverseError && isSecuredRefusalCode(e.code)

describe('rights', () => {
  it('grants what the privileges grant and nothing else', () => {
    const r = rightsFrom(SECURED, [{ AttributeId: '3807d5ed-a947-e811-814b-5065f38c1521', CanRead: 4, CanCreate: 0, CanUpdate: 4 }])
    expect(r.k7_incidentid).toEqual({ read: true, create: false, update: true })
    // A secured column the user has no privilege on: locked every way (an agent without a field security profile).
    expect(r.k7_module).toEqual({ read: false, create: false, update: false })
  })

  it('allows unknown rights and columns outside field security', () => {
    const r = rightsFrom(SECURED, [])
    expect(may(r, 'k7_incidentid', 'update')).toBe(false)
    expect(may(r, 'title', 'update')).toBe(true)
    expect(may(null, 'k7_incidentid', 'update')).toBe(true)
  })

  it('knows the two refusal codes', () => {
    expect(isSecuredRefusalCode('0x8004f502')).toBe(true)
    expect(isSecuredRefusalCode('0x8004F507')).toBe(true)
    expect(isSecuredRefusalCode('0x8004f865')).toBe(false)
    expect(isSecuredRefusalCode(undefined)).toBe(false)
  })
})

describe('writing around a refusal', () => {
  it('writes once when Dynamics accepts', async () => {
    const sent: Record<string, unknown>[] = []
    const r = await writeAroundSecured({ title: 'x', k7_incidentid: 'BG-1' }, async (b) => (sent.push(b), 'ok'), async () => ['k7_incidentid'], isRefusal)
    expect(r).toEqual({ result: 'ok', skipped: [] })
    expect(sent).toHaveLength(1)
  })

  it('writes again without the secured columns after 0x8004f502 / 0x8004f507', async () => {
    const sent: Record<string, unknown>[] = []
    const write = async (b: Record<string, unknown>) => {
      sent.push(b)
      if ('k7_incidentid' in b) throw refusal('0x8004f507')
      return 'saved'
    }
    const r = await writeAroundSecured({ title: 'x', k7_incidentid: 'BG-1', k7_module: 'USB' }, write, async () => ['k7_incidentid', 'k7_module'], isRefusal)
    expect(r).toEqual({ result: 'saved', skipped: ['k7_incidentid', 'k7_module'] })
    expect(sent[1]).toEqual({ title: 'x' })
  })

  it('passes any other error through, and a refusal with nothing secured to drop', async () => {
    await expect(writeAroundSecured({ title: 'x' }, async () => Promise.reject(refusal('0x8004f865')), async () => ['k7_incidentid'], isRefusal)).rejects.toThrow()
    await expect(writeAroundSecured({ title: 'x' }, async () => Promise.reject(refusal('0x8004f507')), async () => ['k7_incidentid'], isRefusal)).rejects.toThrow()
  })

  it('drops locked columns from a body', () => {
    expect(withoutLocked({ a: 1, k7_yodizid: 'K7-1' }, (k) => k === 'k7_yodizid')).toEqual({ body: { a: 1 }, skipped: ['k7_yodizid'] })
  })
})

describe('messages', () => {
  it('names the columns in the portal’s words', () => {
    expect(columnList(['k7_incidentid'])).toBe('Incident ID')
    expect(columnList(['k7_productversion', 'k7_incidentid', 'k7_module'])).toBe('Product version, Incident ID and Module')
    expect(notSaved(['k7_incidentid'])).toBe('Incident ID was not saved: Dynamics field security does not let your user set it.')
    expect(notSaved([])).toBe('')
  })

  it('never echoes an unknown skipped value', () => {
    expect(skippedFrom('k7_incidentid,<script>,k7_module')).toEqual(['k7_incidentid', 'k7_module'])
    expect(skippedFrom(undefined)).toEqual([])
  })
})
