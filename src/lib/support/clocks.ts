/* The clocks added to the SLA engine on 2026-11-27 (09-portal-guide.md §4c): the customer's follow-up waiting for an answer,
   a case waiting in a bin, a Lab sample waiting to be closed. Pure functions over timestamps; sla.ts reads them against the
   targets and the shifts. Tested without a tenant. */

/** One message on a case: from the customer (`in`: an email received, a portal reply) or to them (`out`: an email sent, a
    reply posted to the portal). Automatic CRM mail is left out before it gets here. */
export type Msg = { at: Date; dir: 'in' | 'out' }

/** One follow-up: the customer wrote after the case had been answered; `end` is the next answer, null while it waits. */
export type FollowUp = { start: Date; end: Date | null }

/** The case's follow-ups, oldest first. A run of customer messages before the next answer is one follow-up from the first of
    them; messages before the first answer belong to the first response, not to a follow-up. `firstAnswer` is the response
    clock's stop (a desk note or a phone case answered on the call count there too). */
export const followUps = (msgs: Msg[], firstAnswer: Date | null): FollowUp[] => {
  const sorted = [...msgs].sort((a, b) => a.at.getTime() - b.at.getTime())
  let answered: Date | null = firstAnswer
  let open: Date | null = null
  const out: FollowUp[] = []
  for (const m of sorted) {
    if (m.dir === 'out') {
      if (open) {
        out.push({ start: open, end: m.at })
        open = null
      }
      if (!answered || m.at < answered) answered = answered ?? m.at
    } else if (answered && m.at > answered && !open) {
      open = m.at
    }
  }
  if (open) out.push({ start: open, end: null })
  return out
}

/** The follow-up running now on an active case, from the last message each way: the customer wrote after the case was first
    answered and nobody has answered since. */
export const openFollowUp = (o: { lastIn: Date | null; lastOut: Date | null; firstAnswer: Date | null }): Date | null => {
  const { lastIn, lastOut, firstAnswer } = o
  if (!lastIn || !firstAnswer || lastIn <= firstAnswer) return null
  if (lastOut && lastOut >= lastIn) return null
  return lastIn
}

/** Whether an outgoing email is the CRM's own automatic mail: its subject starts with one of the configured prefixes
    (case and spacing do not matter). */
export const isAutomated = (subject: string | null | undefined, prefixes: string[]): boolean => {
  const s = (subject ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!s) return false
  return prefixes.some((p) => {
    const x = p.replace(/\s+/g, ' ').trim().toLowerCase()
    return x !== '' && s.startsWith(x)
  })
}

/** Owners that are not an engineer: the case is waiting to be picked. */
export const inBin = (ownerKind: 'user' | 'team' | 'shared' | 'none'): boolean => ownerKind !== 'user'
