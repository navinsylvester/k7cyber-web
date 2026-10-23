'use server'

import { redirect } from 'next/navigation'

import { requirePartner } from '@/lib/partner/session'
import { loadAttemptFor, loadCourseFor, PARTNER_TRAINING, startAttempt, submitAttempt } from '@/lib/partner/training'

/* The learner's two moves (01-requirements.md §4): start a test (FR-TRN-04: the unlock rule is re-checked on the server, an
   open attempt is resumed) and submit it (FR-TRN-06: graded and stored once; late by more than the grace, recorded as
   expired). Both are the signed-in user's own; the library reads through the scope and the user. */

const f = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (path: string, q: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(q).toString()}`)

export async function startTestAction(form: FormData): Promise<void> {
  const courseId = f(form, 'courseId')
  const path = `${PARTNER_TRAINING}/${encodeURIComponent(courseId)}`
  const me = await requirePartner(path)
  const view = await loadCourseFor(me, courseId)
  if (!view) redirect(PARTNER_TRAINING)
  const r = await startAttempt(me, view)
  if (!r.ok) return back(path, { error: r.error })
  redirect(`${path}/test/${r.attempt.id}`)
}

export async function submitTestAction(form: FormData): Promise<void> {
  const courseId = f(form, 'courseId')
  const attemptId = f(form, 'attemptId')
  const path = `${PARTNER_TRAINING}/${encodeURIComponent(courseId)}`
  const me = await requirePartner(`${path}/test/${encodeURIComponent(attemptId)}`)
  const found = await loadAttemptFor(me, courseId, attemptId)
  if (!found) redirect(path)
  if (found.attempt.status !== 'open') redirect(`${path}/test/${found.attempt.id}/result`)
  const r = await submitAttempt(me, found, (name) => form.getAll(name).map(String))
  if (!r.ok) return back(path, { error: r.error })
  redirect(`${path}/test/${r.attempt.id}/result`)
}
