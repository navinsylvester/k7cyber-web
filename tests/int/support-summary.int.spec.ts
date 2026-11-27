import { describe, expect, it } from 'vitest'

import { parseCopilotSummary, SUMMARY_NOTE_SUBJECT, summaryStale } from '@/lib/support/summary-model'

/* The case summary (TR-24) without a tenant: Copilot's answer as UAT gave it for CS-01195-B0Q3 on 2026-11-27. */

const RAW =
  'Result: {"payloadRaw":{"Response":{"summary":"The customer reported that the ISP appeared down when connected to the UTM firewall. Support confirmed the ISP itself was down {not the firewall}.","status":{"code":20000,"message":"Successfulrun"},"additional_information":[{"key":"last_activity_datetime_processed","value":"2026-10-15T05:22:59.0000000Z"}]},"Response_Context":{"models":[{"inputTokenCount":853}]}}}\r\nMetadata: {"ActivitiesOrderedBy":"modifiedon","ActivitiesLastRecordDate":"","PartialSummary":false}\r\n'

describe('Copilot case summary', () => {
  it('reads the summary out of the answer, braces in the text and all', () => {
    expect(parseCopilotSummary(RAW)).toEqual({ ok: true, summary: 'The customer reported that the ISP appeared down when connected to the UTM firewall. Support confirmed the ISP itself was down {not the firewall}.', partial: false })
    expect(parseCopilotSummary(RAW.replace('"PartialSummary":false', '"PartialSummary":true'))).toMatchObject({ ok: true, partial: true })
  })
  it('says why there is none', () => {
    expect(parseCopilotSummary('')).toMatchObject({ ok: false })
    expect(parseCopilotSummary('Result: {"payloadRaw":{"Response":{"summary":"","status":{"code":40001,"message":"NoActivities"}}}}')).toEqual({ ok: false, reason: 'Copilot could not summarise this case (NoActivities).' })
    expect(parseCopilotSummary('Result: not json')).toMatchObject({ ok: false })
  })
  it('knows when the case has moved on since, not counting its own note', () => {
    const made = '2026-11-27T08:40:00.000Z'
    expect(summaryStale(made, [{ when: '2026-11-27T08:30:00Z', subject: 'Call back' }])).toBe(false)
    expect(summaryStale(made, [{ when: '2026-11-27T08:41:00Z', subject: SUMMARY_NOTE_SUBJECT }])).toBe(false)
    expect(summaryStale(made, [{ when: '2026-11-27T08:40:00Z' }])).toBe(false)
    expect(summaryStale(made, [{ when: '2026-11-27T08:42:00Z', subject: 'Portal: reply from customer' }])).toBe(true)
  })
})
