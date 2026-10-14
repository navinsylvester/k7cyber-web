import { afterEach, describe, expect, it, vi } from 'vitest'

import { assertWriteAllowed, callDataverse } from '@/lib/dataverse/client'
import { ProductionWriteRefused, WritesDisabled } from '@/lib/dataverse/errors'

/* 07-production-safety.md §1b: production Dataverse is read-only for the portal, whatever the environment says. */

const PROD = 'https://k7crm.crm8.dynamics.com/api/data/v9.2/incidents(00000000-0000-0000-0000-000000000000)'
const PROD_API = 'https://k7crm.api.crm8.dynamics.com/api/data/v9.2/incidents'
const UAT = 'https://k7crmuat.crm8.dynamics.com/api/data/v9.2/incidents'

describe('Dataverse write guard', () => {
  it('refuses every non-GET call to the production hosts even with writes enabled', () => {
    for (const m of ['POST', 'PATCH', 'DELETE'] as const) {
      expect(() => assertWriteAllowed(m, PROD, { DATAVERSE_WRITES_ENABLED: '1' } as unknown as NodeJS.ProcessEnv)).toThrow(ProductionWriteRefused)
      expect(() => assertWriteAllowed(m, PROD_API, { DATAVERSE_WRITES_ENABLED: '1' } as unknown as NodeJS.ProcessEnv)).toThrow(ProductionWriteRefused)
    }
  })
  it('lets GET through to production', () => {
    expect(() => assertWriteAllowed('GET', PROD, {} as unknown as NodeJS.ProcessEnv)).not.toThrow()
  })
  it('refuses writes to UAT unless DATAVERSE_WRITES_ENABLED=1', () => {
    expect(() => assertWriteAllowed('POST', UAT, {} as unknown as NodeJS.ProcessEnv)).toThrow(WritesDisabled)
    expect(() => assertWriteAllowed('PATCH', UAT, { DATAVERSE_WRITES_ENABLED: '0' } as unknown as NodeJS.ProcessEnv)).toThrow(WritesDisabled)
    expect(() => assertWriteAllowed('POST', UAT, { DATAVERSE_WRITES_ENABLED: '1' } as unknown as NodeJS.ProcessEnv)).not.toThrow()
  })
})

describe('callDataverse', () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
    vi.restoreAllMocks()
  })
  it('throws before any network call when a write targets production', async () => {
    process.env.DATAVERSE_URL = 'https://k7crm.crm8.dynamics.com'
    process.env.DATAVERSE_WRITES_ENABLED = '1'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('network must not be touched')
    })
    await expect(callDataverse({ kind: 'agent', token: 't' }, 'POST', 'CloseIncident', { body: {} })).rejects.toBeInstanceOf(ProductionWriteRefused)
    await expect(callDataverse({ kind: 'agent', token: 't' }, 'POST', '$batch', { body: {} })).rejects.toBeInstanceOf(ProductionWriteRefused)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it('refuses to follow a next link to another host', async () => {
    process.env.DATAVERSE_URL = 'https://k7crmuat.crm8.dynamics.com'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('network must not be touched')
    })
    await expect(callDataverse({ kind: 'agent', token: 't' }, 'GET', 'https://evil.example.com/api/data/v9.2/incidents')).rejects.toThrow(/another host/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it('retries a GET on 429 honouring Retry-After and parses the OData error otherwise', async () => {
    process.env.DATAVERSE_URL = 'https://k7crmuat.crm8.dynamics.com'
    let calls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      calls++
      if (calls === 1) return new Response('', { status: 429, headers: { 'Retry-After': '0' } })
      return new Response(JSON.stringify({ value: [{ incidentid: 'x' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    const r = await callDataverse<{ value: unknown[] }>({ kind: 'agent', token: 't' }, 'GET', 'incidents?$select=incidentid')
    expect(calls).toBe(2)
    expect(r.value).toHaveLength(1)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ error: { code: '0x80040217', message: 'Does not exist' } }), { status: 404, headers: { 'x-ms-service-request-id': 'corr-1' } }))
    await expect(callDataverse({ kind: 'agent', token: 't' }, 'GET', 'incidents(1)')).rejects.toMatchObject({ status: 404, code: '0x80040217', correlationId: 'corr-1' })
  })
})
