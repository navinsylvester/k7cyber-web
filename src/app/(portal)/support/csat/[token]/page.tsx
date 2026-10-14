import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { RateScale, ReasonSelect, ScoreTag } from '@/components/support/Csat'
import { Field, Flash, Tid } from '@/components/support/Parts'
import { asScore, csatForCase, readSurveyToken } from '@/lib/support/csat'
import { getSettings } from '@/lib/support/kpi-config'

import { submitSurvey } from './actions'

export const metadata: Metadata = { title: 'How did we do?' }

type SP = { score?: string; done?: string; error?: string }

const ERRORS: Record<string, string> = {
  score: 'Pick a number from 1 to 5.',
  off: 'The survey is switched off at the moment. Thank you anyway.',
  case: 'We could not find that case any more.',
  failed: 'We could not save your rating. Try again in a moment.',
}

/* The emailed survey (09-portal-guide.md §4d): the case, one question, five tiles, an optional line. The link in the email carries
   the signed token and may carry the score the customer clicked. */
export default async function SurveyPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SP> }) {
  const [{ token: raw }, sp] = await Promise.all([params, searchParams])
  const token = decodeURIComponent(raw)
  const t = token === 'expired' ? null : readSurveyToken(token)
  const settings = await getSettings()
  if (!t) {
    return (
      <section className="sheet ws g-paper">
        <div className="survey">
          <span className="label muted">K7 Support · Survey</span>
          <h1 className="h-util">This link has expired.</h1>
          <p className="form-intro">Survey links work for {settings.csat.surveyDays} days. You can still rate any closed case after signing in to the portal.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/support/cases?state=closed">
              Sign in to my cases →
            </Link>
          </div>
        </div>
      </section>
    )
  }
  const row = await csatForCase(t.caseId)
  const title = row?.title ?? ''
  const preselected = asScore(sp.score) ?? row?.score ?? null
  const done = sp.done === '1'
  const given = asScore(sp.score)
  const low = given !== null && given <= settings.csat.unhappyAtOrBelow
  return (
    <section className="sheet ws g-paper">
      <div className="survey">
        <span className="label muted">K7 Support · Survey</span>
        {done ? (
          <>
            <h1 className="h-util">{low ? 'We are sorry we let you down.' : 'Thank you.'}</h1>
            <div className="case-line">
              <Tid ticket={t.ticket} />
              {title && <span>{title}</span>}
              {given !== null && <ScoreTag score={given} settings={settings.csat} />}
            </div>
            <p className="form-intro">
              {low
                ? 'A support manager reads every low rating and will be in touch to put this right. If the problem is back, sign in and reopen the case so the engineer has the history.'
                : 'Your rating goes straight to the engineer and their manager. If anything is still wrong, sign in and reopen the case.'}
            </p>
            <div className="actions">
              <Link className="btn btn-line" href="/support/cases?state=closed">
                Sign in to my cases
              </Link>
              <Link className="link-u" href={`/support/csat/${encodeURIComponent(token)}`}>
                Change my rating
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="h-util">How did we do?</h1>
            <div className="case-line">
              <Tid ticket={t.ticket} />
              {title && <span>{title}</span>}
              {row?.score !== null && row?.score !== undefined && <span className="label muted">you rated {row.score}/5 before</span>}
            </div>
            {sp.error && <Flash kind="error">{ERRORS[sp.error] ?? 'Try again.'}</Flash>}
            <form action={submitSurvey} className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <input type="hidden" name="token" value={token} />
              <RateScale selected={preselected} />
              <Field id="reason" label="If something went wrong, what was it mainly about?" hint="Optional. It tells us whether to fix the product or the way we helped you." select>
                <ReasonSelect id="reason" audience="customer" value={row?.customerReason ?? ''} />
              </Field>
              <Field id="comment" label="Anything you want to tell us?" hint="Optional. Read by the engineer's manager.">
                <textarea id="comment" name="comment" rows={3} maxLength={2000} defaultValue={row?.comment ?? ''} placeholder="What went well, or what we should have done differently" />
              </Field>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit">
                  Send my rating →
                </button>
                <span className="hint">Ten seconds. {t.email ? `For ${t.email}.` : ''}</span>
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  )
}
