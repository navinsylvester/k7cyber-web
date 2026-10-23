import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { appVars, dealVars, deliveryFor, digestMail, EVENT_KEYS, EVENTS, eventDef, isEventKey, mailHtml, mailText, placeholdersIn, render, renderTemplate, SAMPLE_VARS, schemeVars, toTemplate, unknownPlaceholders, validateTemplate, type Template } from '@/lib/partner/notify-model'

/* The notification catalogue and the templates without a tenant (FR-NTF-01, 02-build-plan.md M8): every event the code
   sends is in the catalogue, placeholders render and unknown ones are refused, a template replaces the code's text only
   when it exists and is on, the delivery rule, the mail shapes. */

const tpl = (o: Partial<Template> = {}): Template => ({ event: 'deal.approved', enabled: true, delivery: 'immediate', subject: '', body: '', updatedAt: null, updatedBy: '', ...o })
const CODE = { subject: 'Deal K7D-00001 approved', body: 'Protected until 21-01-2027.' }

describe('the catalogue', () => {
  it('has unique keys and every event the library calls notify() with', () => {
    expect(new Set(EVENT_KEYS).size).toBe(EVENTS.length)
    const dir = path.resolve(process.cwd(), 'src/lib/partner')
    const used = new Set<string>()
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts') || f === 'notify-model.ts') continue
      const src = readFileSync(path.join(dir, f), 'utf8')
      // Only the `event:` line of a notify() call counts (audit actions share the dotted shape); a ternary names both halves.
      for (const line of src.matchAll(/event: ([^\n]*)/g)) for (const m of line[1]!.matchAll(/'([a-z]+\.[a-z.-]+)'/g)) used.add(m[1]!)
    }
    expect(used.size).toBeGreaterThan(20)
    expect([...used].filter((k) => !isEventKey(k))).toEqual([])
    // The two registration decisions are built from a template literal; both halves are in the catalogue.
    expect(isEventKey('scheme.registration.approved')).toBe(true)
    expect(isEventKey('scheme.registration.declined')).toBe(true)
    expect(isEventKey('sla.breached')).toBe(true)
  })

  it('names a delivery and an audience per event, and samples every variable it declares', () => {
    for (const e of EVENTS) {
      expect(['immediate', 'digest', 'bell']).toContain(e.delivery)
      for (const v of e.vars) expect(SAMPLE_VARS[v], `${e.key} samples ${v}`).toBeTruthy()
    }
    expect(eventDef('deal.note')?.delivery).toBe('digest')
    expect(eventDef('nope')).toBeNull()
  })
})

describe('rendering', () => {
  it('fills placeholders, tolerates spaces in the braces and blanks unknown ones', () => {
    expect(render('Deal {{dealId}} for {{ customer }} ({{nope}})', { dealId: 'K7D-1', customer: 'ACME' })).toBe('Deal K7D-1 for ACME ()')
    expect(placeholdersIn('{{a}} {{b}} {{a}}')).toEqual(['a', 'b'])
    expect(unknownPlaceholders('{{dealId}} {{link}} {{foo}}', 'deal.approved')).toEqual(['foo'])
  })

  it('uses the template only when it exists and is on; a blank half keeps the code’s', () => {
    expect(renderTemplate(null, CODE, {})).toEqual(CODE)
    expect(renderTemplate(tpl({ enabled: false, subject: 'X', body: 'Y' }), CODE, {})).toEqual(CODE)
    expect(renderTemplate(tpl({ subject: 'Good news on {{dealId}}' }), CODE, { dealId: 'K7D-9' })).toEqual({ subject: 'Good news on K7D-9', body: CODE.body })
    const r = renderTemplate(tpl({ subject: '{{subject}} · {{partner}}', body: 'Dear {{recipient}},\n\n{{body}}\n\n{{link}}' }), CODE, { partner: 'ACME', recipient: 'Asha', link: 'https://x/y' })
    expect(r.subject).toBe('Deal K7D-00001 approved · ACME')
    expect(r.body).toBe('Dear Asha,\n\nProtected until 21-01-2027.\n\nhttps://x/y')
    // A template of nothing but unknown placeholders falls back rather than sending an empty mail.
    expect(renderTemplate(tpl({ subject: '{{nope}}', body: '{{nope}}' }), CODE, {})).toEqual(CODE)
    // The subject never carries a line break.
    expect(renderTemplate(tpl({ subject: 'a\nb   c' }), CODE, {}).subject).toBe('a b c')
  })

  it('validates a template against the event’s placeholders and the sizes', () => {
    expect(validateTemplate({ subject: 'Deal {{dealId}}', body: '{{body}} {{link}}' }, 'deal.approved')).toEqual({})
    expect(validateTemplate({ subject: '{{scheme}}', body: '' }, 'deal.approved').body).toMatch(/Unknown placeholder: \{\{scheme\}\}/)
    expect(validateTemplate({ subject: 'x'.repeat(201), body: 'y'.repeat(4001) }, 'deal.approved')).toMatchObject({ subject: expect.stringMatching(/200/), body: expect.stringMatching(/4,000/) })
  })

  it('reads a row and takes the delivery from the template, else the catalogue', () => {
    const t = toTemplate({ event: 'deal.note', enabled: true, delivery: 'bell', subject: 's', body: 'b', updatedAt: '2026-10-23T00:00:00.000Z', updatedBy: 'cm@k7computing.com' })
    expect(t).toMatchObject({ event: 'deal.note', delivery: 'bell', updatedBy: 'cm@k7computing.com' })
    expect(toTemplate({ event: 'deal.note', delivery: 'nonsense' }).delivery).toBe('digest')
    expect(deliveryFor('deal.note', t)).toBe('bell')
    expect(deliveryFor('deal.note', null)).toBe('digest')
    expect(deliveryFor('deal.approved', null)).toBe('immediate')
    expect(deliveryFor('made.up', null)).toBe('immediate')
  })
})

describe('the variables and the mail', () => {
  it('shapes the deal, application and scheme variables in the portal’s formats', () => {
    expect(dealVars({ dealId: 'K7D-00030', orgName: 'PP-TEST', orgPartnerId: 'K7P-00000', expectedValue: 1200000, closeDate: '2027-02-15', protectionEnds: '2027-01-21T00:00:00.000Z', customer: { name: 'Northwind' } })).toEqual({ dealId: 'K7D-00030', customer: 'Northwind', partner: 'PP-TEST', partnerId: 'K7P-00000', value: '₹12,00,000', closeDate: '15-02-2027', protectionEnds: '21-01-2027' })
    expect(appVars({ number: 'K7A-00003', company: { legalName: 'Ex Ltd' }, contact: { name: 'Asha' } }, 'Value Added Reseller')).toEqual({ application: 'K7A-00003', company: 'Ex Ltd', type: 'Value Added Reseller', contact: 'Asha' })
    expect(schemeVars({ name: 'Q2', startDate: '2026-04-01', endDate: '2026-06-30' }, { name: 'Ex', tradeName: 'Ex Trade', partnerId: 'K7P-1' })).toEqual({ scheme: 'Q2', startDate: '01-04-2026', endDate: '30-06-2026', partner: 'Ex Trade', partnerId: 'K7P-1' })
  })

  it('escapes the HTML, keeps paragraphs, adds the link and the signature', () => {
    const html = mailHtml({ body: 'Line <one>\n\nTwo & three', link: 'https://x/y?a=1&b=2', signature: 'K7\nPartners' })
    expect(html).toContain('Line &lt;one&gt;')
    expect(html).toContain('Two &amp; three')
    expect(html).toContain('href="https://x/y?a=1&amp;b=2"')
    expect(html).toContain('K7<br>Partners')
    expect(html).not.toContain('<one>')
    expect(mailText({ body: 'B', link: 'L', signature: 'S' })).toBe('B\n\nL\n\nS')
  })

  it('writes the digest as one message, the subject by the count', () => {
    const one = digestMail([{ subject: 'Note on K7D-1', body: 'Hello', link: 'https://x', at: '' }], { signature: 'S', portal: 'https://p' })
    expect(one.subject).toBe('K7 Partner Programme: Note on K7D-1')
    const three = digestMail(Array.from({ length: 3 }, (_, i) => ({ subject: `S${i}`, body: `B${i}\nmore`, link: '', at: '' })), { signature: 'S', portal: 'https://p' })
    expect(three.subject).toBe('K7 Partner Programme: 3 updates')
    expect(three.text).toContain('• S2\n  B2 more')
    expect(three.html).toContain('<strong>S0</strong>')
    expect(three.text).toContain('https://p')
  })
})
