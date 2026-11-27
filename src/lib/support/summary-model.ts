/* The case summary (TR-24), pure: reading what Dynamics' Copilot answers. The custom API msdyn_CustomApiCustomerServiceCaseSummary
   returns one string, "Result: {json}\r\nMetadata: {json}", whose Result carries the summary and a status (20000 when it ran).
   Tested without a tenant on the answer UAT gave for CS-01195-B0Q3 on 2026-11-27. */

export type CopilotSummary = { ok: true; summary: string; partial: boolean } | { ok: false; reason: string }

const jsonAfter = (raw: string, label: string): Record<string, unknown> | null => {
  const at = raw.indexOf(`${label}:`)
  if (at < 0) return null
  const start = raw.indexOf('{', at)
  if (start < 0) return null
  // The JSON runs to the matching brace; strings may hold braces, so count outside strings only.
  let depth = 0
  let inString = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) {
      try {
        return JSON.parse(raw.slice(start, i + 1)) as Record<string, unknown>
      } catch {
        return null
      }
    }
  }
  return null
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

/** The summary out of Copilot's answer, or why there is none. */
export const parseCopilotSummary = (raw: string | null | undefined): CopilotSummary => {
  if (!raw || !raw.trim()) return { ok: false, reason: 'Copilot returned nothing.' }
  const result = jsonAfter(raw, 'Result')
  if (!result) return { ok: false, reason: 'Copilot answered in a form the portal does not read.' }
  const response = obj(obj(result.payloadRaw).Response)
  const status = obj(response.status)
  const code = Number(status.code ?? 0)
  const summary = typeof response.summary === 'string' ? response.summary.trim() : ''
  if (code && code !== 20000) return { ok: false, reason: `Copilot could not summarise this case (${String(status.message ?? code)}).` }
  if (!summary) return { ok: false, reason: 'Copilot had nothing to summarise yet.' }
  const meta = jsonAfter(raw, 'Metadata')
  return { ok: true, summary, partial: obj(meta).PartialSummary === true }
}

/** A note the portal writes holding a summary: it is not new activity on the case. */
export const SUMMARY_NOTE_SUBJECT = 'Case summary (Copilot)'

/** Whether the case has moved on since the summary was made: a timeline entry newer than it that is not the summary's own note. */
export const summaryStale = (madeAt: string, entries: { when: string; subject?: string }[]): boolean => {
  const made = Date.parse(madeAt)
  return entries.some((e) => Date.parse(e.when) > made && e.subject !== SUMMARY_NOTE_SUBJECT)
}
