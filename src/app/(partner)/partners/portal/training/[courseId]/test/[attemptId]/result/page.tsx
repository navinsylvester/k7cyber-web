import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { Flash, Strip } from '@/components/partner/Parts'
import { AttemptTag, PaperReview, ResultFacts } from '@/components/partner/Training'
import { requirePartner } from '@/lib/partner/session'
import { loadAttemptFor, PARTNER_TRAINING } from '@/lib/partner/training'
import { gradePaper } from '@/lib/partner/training-model'

import { startTestAction } from '../../../../actions'

export const metadata: Metadata = { title: 'Result' }

/* The result (FR-TRN-06): the score and the outcome as filed facts, the paper reviewed question by question with the
   learner's answers and, when the course allows it, the correct ones and the explanations. An open attempt goes back to
   its paper. */
export default async function ResultPage({ params }: { params: Promise<{ courseId: string; attemptId: string }> }) {
  const { courseId, attemptId } = await params
  const me = await requirePartner(`${PARTNER_TRAINING}/${courseId}/test/${attemptId}/result`)
  const found = await loadAttemptFor(me, courseId, attemptId)
  if (!found) notFound()
  const { view, attempt: a } = found
  if (a.status === 'open') redirect(`${PARTNER_TRAINING}/${view.course.id}/test/${a.id}`)
  const grade = gradePaper(a.paper, a.answers, a.passMark)
  const courseHref = `${PARTNER_TRAINING}/${view.course.id}`
  const canRetake = !a.passed && view.standing.unlock.ok && !view.attempts.some((x) => x.status === 'open')
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">
            <Link className="link-u" href={courseHref}>
              {view.course.title}
            </Link>{' '}
            · result
          </span>
          <h1 className="h-util">{a.passed ? `Passed with ${a.score}%.` : a.status === 'expired' ? `Out of time · ${a.score}%.` : `${a.score}% · not passed.`}</h1>
          <p className="lede">
            {a.passed ? `${a.correct} of ${a.total} right against a pass mark of ${a.passMark}%. Your Partner Admin has been told; the individual certificate arrives with the next phase of the portal.` : a.status === 'expired' ? `The time ran out and the paper was submitted with what you had answered: ${a.correct} of ${a.total} right, against a pass mark of ${a.passMark}%. You may take the test again.` : `${a.correct} of ${a.total} right, against a pass mark of ${a.passMark}%. Watch the modules again where you need to and take the test again; each attempt draws a fresh paper.`}
          </p>
        </div>
        <div className="ws-actions">
          {canRetake ? (
            <form action={startTestAction}>
              <input type="hidden" name="courseId" value={view.course.id} />
              <button className="btn btn-primary" type="submit">
                Take the test again →
              </button>
            </form>
          ) : (
            <Link className="btn btn-primary" href={courseHref}>
              Back to the course →
            </Link>
          )}
        </div>
      </div>
      {a.status === 'expired' ? <Flash kind="error">Submitted after the time limit: recorded as out of time and graded on what was answered.</Flash> : null}
      <Strip
        items={[
          { label: 'Result', value: <AttemptTag attempt={a} /> },
          { label: 'Score', value: `${a.score}% · pass mark ${a.passMark}%` },
          { label: 'Correct', value: `${a.correct} of ${a.total}` },
          { label: 'Course version', value: `v${a.courseVersion}` },
        ]}
      />
      <div className="phome">
        <div>
          <h2>{a.showAnswers ? 'Your answers and the correct ones' : 'Your answers'}</h2>
          <PaperReview paper={a.paper} answers={a.answers} perQuestion={grade.perQuestion} showAnswers={a.showAnswers} />
        </div>
        <aside className="ws-side">
          <div>
            <h2>This attempt</h2>
            <ResultFacts attempt={a} timeLimitMinutes={view.rules.timeLimitMinutes} />
          </div>
        </aside>
      </div>
    </section>
  )
}
