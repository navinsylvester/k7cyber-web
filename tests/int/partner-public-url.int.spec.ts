import { afterEach, describe, expect, it } from 'vitest'

import { partnerPublicUrl } from '@/lib/partner/public-url'

// B-02 (2026-10-27): the portal's absolute links follow the host people sign in through, read at run time.
const KEYS = ['PARTNER_PUBLIC_URL', 'AUTH_URL', 'NEXT_PUBLIC_SERVER_URL'] as const
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
const set = (v: Partial<Record<(typeof KEYS)[number], string>>) => KEYS.forEach((k) => (v[k] === undefined ? delete process.env[k] : (process.env[k] = v[k])))

describe('partnerPublicUrl', () => {
  afterEach(() => set(saved as Record<string, string>))
  it('prefers PARTNER_PUBLIC_URL, then AUTH_URL, then NEXT_PUBLIC_SERVER_URL', () => {
    set({ PARTNER_PUBLIC_URL: 'https://partners.example.com/', AUTH_URL: 'https://tunnel.example', NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000' })
    expect(partnerPublicUrl()).toBe('https://partners.example.com')
    set({ AUTH_URL: 'https://tunnel.example', NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000' })
    expect(partnerPublicUrl()).toBe('https://tunnel.example')
    set({ NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000' })
    expect(partnerPublicUrl()).toBe('http://localhost:3000')
  })
  it('drops an Auth.js base path', () => {
    set({ AUTH_URL: 'https://tunnel.example/api/auth' })
    expect(partnerPublicUrl()).toBe('https://tunnel.example')
  })
})
