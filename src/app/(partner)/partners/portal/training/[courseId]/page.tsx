import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Empty, Flash, Strip } from '@/components/partner/Parts'
import { AttemptsLedger, ModuleList, ModulesBar, TestStateTag } from '@/components/partner/Training'
import { certificateHref } from '@/lib/partner/certificates'
import { requirePartner } from '@/lib/partner/session'
import { loadCourseFor, PARTNER_TRAINING } from '@/lib/partner/training'
import { dmy } from '@/lib/support/format'

import { startTestAction } from '../actions'

export const metadata: Metadata = { title: 'Course' }

type SP = { ok?: string; error?: string }

/* One course for the learner (FR-TRN-01, 04, 05, 06, 14): the modules in order with what has been watched, the test on the
   decision panel (locked with the reason, ready to start, or passed), the attempts so far. Reached only for a published course
   under a track open to the user; anything else is a 404. */
export default async function CoursePage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<SP> }) {
  const [{ courseId }, sp] = await Promise.all([params, searchParams])
  const me = await requirePartner(`${PARTNER_TRAINING}/${courseId}`)
  const view = await loadCourseFor(me, courseId)
  if (!view) notFound()
  const { course, track, modules, progress, attempts, standing: st, rules } = view
  const open = attempts.find((a) => a.status === 'open')
  const finished = attempts.filter((a) => a.status !== 'open')
  const firstUndone = modules.find((m) => {
    const p = progress.get(m.id)
    return !p?.completedAt
  })
  const href = (id: string) => `${PARTNER_TRAINING}/${course.id}/${id}`
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">
            <Link className="link-u" href={PARTNER_TRAINING}>
              Training
            </Link>{' '}
            · {track.name}
          </span>
          <h1 className="h-util">{course.title}.</h1>
          {course.description ? <p className="lede">{course.description}</p> : null}
        </div>
        <div className="ws-actions">
          {open ? (
            <Link className="btn btn-primary" href={`${PARTNER_TRAINING}/${course.id}/test/${open.id}`}>
              Resume the test →
            </Link>
          ) : st.test === 'ready' || st.test === 'failed' || st.test === 'recertify' ? (
            <form action={startTestAction}>
              <input type="hidden" name="courseId" value={course.id} />
              <button className="btn btn-primary" type="submit">
                {st.test === 'recertify' ? 'Take the recertification test →' : st.test === 'failed' ? 'Take the test again →' : 'Take the test →'}
              </button>
            </form>
          ) : firstUndone ? (
            <Link className="btn btn-primary" href={href(firstUndone.id)}>
              {st.modulesDone > 0 || st.watchedShare > 0 ? 'Continue →' : 'Start the first module →'}
            </Link>
          ) : null}
        </div>
      </div>
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash kind="error">{sp.error}</Flash>}
      <Strip
        items={[
          { label: 'Modules', value: <ModulesBar modules={modules} progress={progress} rules={rules} /> },
          { label: 'Test', value: <TestStateTag state={st.test} /> },
          { label: 'Pass mark', value: `${rules.passMark}% · ${rules.timeLimitMinutes} min` },
          { label: 'Best score', value: st.best ? `${st.best.score ?? 0}%${st.attempts > 1 ? ` · ${st.attempts} attempts` : ''}` : '—' },
          { label: 'Version', value: `v${course.version}${st.passOutdated ? ` · passed on v${st.pass?.courseVersion}` : ''}` },
        ]}
      />
      <div className="phome">
        <div>
          <h2>Modules</h2>
          {modules.length ? (
            <ModuleList modules={modules} progress={progress} rules={rules} href={(m) => href(m.id)} />
          ) : (
            <Empty label="Modules">No module is published on this course yet.</Empty>
          )}
          {finished.length ? (
            <div style={{ marginTop: 'clamp(28px, 3cqw, 40px)' }}>
              <AttemptsLedger attempts={finished} href={(a) => `${PARTNER_TRAINING}/${course.id}/test/${a.id}/result`} />
            </div>
          ) : null}
        </div>
        <aside className="ws-side">
          <div className={`decide test-box${st.test === 'ready' || st.test === 'recertify' ? ' is-ready' : ''}`}>
            <h2>{st.test === 'recertify' ? 'Recertification' : 'The test'}</h2>
            {st.test === 'recertify' ? (
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 15 }}>
                Your certificate {st.certificate!.number} {st.certificate!.state === 'expiring' ? `expires on ${dmy(st.certificate!.expiresAt)}` : st.certificate!.state === 'expired' ? `expired on ${dmy(st.certificate!.expiresAt)}` : 'was revoked'}. Take the test again ({rules.questionsPerTest} questions, {rules.timeLimitMinutes} minutes, pass mark {rules.passMark}%); passing issues a new certificate.
              </p>
            ) : st.test === 'passed' ? (
              <>
                <p className="muted" style={{ margin: '0 0 12px', fontSize: 15 }}>
                  Passed on {dmy(st.pass!.submittedAt ?? st.pass!.startedAt)} with {st.pass!.score}% (version {st.pass!.courseVersion}).{st.passOutdated ? ` The course is now on version ${course.version}; your pass stays valid, and you may take the new version.` : ''}
                  {st.certificate && (st.certificate.state === 'valid' || st.certificate.state === 'expiring') ? (
                    <>
                      {' '}
                      Certificate <Link className="link-u" href={certificateHref({ id: st.certificate.id })}>{st.certificate.number}</Link>, valid to {dmy(st.certificate.expiresAt)}.
                    </>
                  ) : st.certificate ? (
                    ` Certificate ${st.certificate.number} is ${st.certificate.state}.`
                  ) : (
                    ' Your certificate is issued by the next sweep.'
                  )}
                </p>
                {st.passOutdated && !open && st.unlock.ok ? (
                  <form action={startTestAction}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <button className="btn btn-line btn-sm" type="submit">
                      Take version {course.version} →
                    </button>
                  </form>
                ) : null}
              </>
            ) : open ? (
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>
                An attempt is open; its clock is running. <Link className="link-u" href={`${PARTNER_TRAINING}/${course.id}/test/${open.id}`}>Resume it</Link>.
              </p>
            ) : st.unlock.ok ? (
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>
                {rules.questionsPerTest} questions drawn from the course’s bank, shuffled, {rules.timeLimitMinutes} minutes, pass mark {rules.passMark}%. {rules.showAnswers ? 'The correct answers show after you submit.' : 'Your score shows after you submit.'}
                {st.test === 'failed' ? ` Your best so far is ${st.best?.score ?? 0}%; you may take it again.` : ''}
              </p>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>
                Locked: {st.unlock.reason} The test unlocks when every module is complete.
              </p>
            )}
          </div>
          <div>
            <h2>How completion works</h2>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>
              A module is complete once you have watched {Math.round(rules.requiredShare * 100)}% of its video. The player keeps the parts you have actually watched; skipping ahead leaves gaps that do not count. You can stop and resume where you left off, on any device.
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
