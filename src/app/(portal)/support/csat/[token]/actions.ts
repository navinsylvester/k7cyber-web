'use server'

import { redirect } from 'next/navigation'

import { getCase } from '@/lib/support/cases'
import { asScore, csatForCase, readSurveyToken, recordResponse, snapshotFromRow, snapshotOf } from '@/lib/support/csat'
import { getSettings } from '@/lib/support/kpi-config'

/* The emailed survey: no sign-in, the signed token in the link is the authorisation. The score lands on the case's row;
   when no row exists yet (a link minted before the row), the case is read as the service identity to build one. */

const here = (token: string, q: string) => `/support/csat/${encodeURIComponent(token)}?${q}`

export async function submitSurvey(form: FormData): Promise<void> {
  const token = String(form.get('token') ?? '')
  const t = readSurveyToken(token)
  if (!t) redirect('/support/csat/expired')
  const score = asScore(form.get('score'))
  const comment = String(form.get('comment') ?? '').trim().slice(0, 2000)
  const reason = String(form.get('reason') ?? '')
  if (!score) redirect(here(token, 'error=score'))
  const settings = await getSettings()
  if (!settings.csat.enabled) redirect(here(token, 'error=off'))
  let snapshot = null
  const row = await csatForCase(t.caseId)
  if (row) snapshot = snapshotFromRow(row)
  else {
    try {
      const c = await getCase({ kind: 'service' }, t.caseId)
      if (c && c.ticketnumber === t.ticket) snapshot = snapshotOf(c)
    } catch {
      snapshot = null
    }
  }
  if (!snapshot) redirect(here(token, 'error=case'))
  try {
    await recordResponse(snapshot, { score, comment, source: 'email', email: t.email, reason }, { settings, auth: { kind: 'service' } })
  } catch {
    redirect(here(token, 'error=failed'))
  }
  redirect(here(token, `done=1&score=${score}`))
}
