import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { TestPaper } from '@/components/partner/TestPaper.client'
import { requirePartner } from '@/lib/partner/session'
import { loadAttemptFor, PARTNER_TRAINING } from '@/lib/partner/training'
import { secondsLeft } from '@/lib/partner/training-model'

import { submitTestAction } from '../../../actions'

export const metadata: Metadata = { title: 'Test' }

/* The paper (FR-TRN-04, 05): the drawn questions with their shuffled options, the clock, one submission. A submitted or
   expired attempt goes to its result. The paper is the attempt's own, never re-drawn on a refresh. */
export default async function TestPage({ params }: { params: Promise<{ courseId: string; attemptId: string }> }) {
  const { courseId, attemptId } = await params
  const me = await requirePartner(`${PARTNER_TRAINING}/${courseId}/test/${attemptId}`)
  const found = await loadAttemptFor(me, courseId, attemptId)
  if (!found) notFound()
  const { view, attempt } = found
  if (attempt.status !== 'open') redirect(`${PARTNER_TRAINING}/${view.course.id}/test/${attempt.id}/result`)
  const left = secondsLeft(attempt, new Date())
  return (
    <section className="sheet ws g-paper paper-sheet">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">
            <Link className="link-u" href={`${PARTNER_TRAINING}/${view.course.id}`}>
              {view.course.title}
            </Link>{' '}
            · test · version {attempt.courseVersion}
          </span>
          <h1 className="h-util">{attempt.paper.length} questions.</h1>
          <p className="lede">
            Pass mark {attempt.passMark}%. {view.rules.timeLimitMinutes} minutes from when you started; at zero the paper submits itself with what you have answered. One mark per question; a multiple-choice question is right only when exactly the correct options are chosen.
          </p>
        </div>
      </div>
      <TestPaper paper={attempt.paper} secondsLeft={left} action={submitTestAction} attemptId={attempt.id} courseId={view.course.id} />
    </section>
  )
}
