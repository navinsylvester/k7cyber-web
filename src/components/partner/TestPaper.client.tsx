'use client'

import React, { useEffect, useRef, useState } from 'react'

import { mmss, type PaperQuestion } from '@/lib/partner/training-model'

/* P31 The test paper (FR-TRN-04, 05): one card per question in the paper's order, the options as radios (single, true/false)
   or checks (multiple) under their letter keys, the clock in mono on a strip that turns signal in the last two minutes; at zero
   the form submits itself and the server records the attempt as expired, graded on what was answered. Answers are not saved
   as you go: one post, like every form on this side. */

type Props = { paper: PaperQuestion[]; secondsLeft: number | null; action: (form: FormData) => void | Promise<void>; attemptId: string; courseId: string }

export const TestPaper: React.FC<Props> = ({ paper, secondsLeft, action, attemptId, courseId }) => {
  const [left, setLeft] = useState(secondsLeft)
  const [answered, setAnswered] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const fired = useRef(false)

  useEffect(() => {
    if (left === null) return
    if (left <= 0) {
      if (!fired.current) {
        fired.current = true
        formRef.current?.requestSubmit()
      }
      return
    }
    const t = window.setTimeout(() => setLeft((v) => (v === null ? v : v - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [left])

  const count = () => {
    const f = formRef.current
    if (!f) return
    const data = new FormData(f)
    setAnswered(paper.filter((q) => data.getAll(`q_${q.qid}`).length > 0).length)
  }

  const low = left !== null && left <= 120
  return (
    <form ref={formRef} action={action} className="paper-form" onChange={count}>
      <input type="hidden" name="attemptId" value={attemptId} />
      <input type="hidden" name="courseId" value={courseId} />
      <div className={`timer${low ? ' is-low' : ''}${left === 0 ? ' is-over' : ''}`} role="timer" aria-live={low ? 'assertive' : 'off'}>
        <span className="label">
          <i className="pixel" aria-hidden="true" /> {left === null ? 'No time limit' : left === 0 ? 'Time is up · submitting' : 'Time left'}
        </span>
        {left !== null ? <span className="timer-n">{mmss(left)}</span> : null}
        <span className="label muted">
          {String(answered).padStart(2, '0')}/{String(paper.length).padStart(2, '0')} answered
        </span>
      </div>
      <ol className="paper">
        {paper.map((q, i) => (
          <li key={q.qid} className="qcard">
            <div className="qcard-head">
              <span className="qcard-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="label muted">{q.type === 'multiple' ? 'Choose all that apply' : q.type === 'trueFalse' ? 'True or false' : 'Choose one'}</span>
            </div>
            <p className="qcard-text" id={`q-${q.qid}`}>
              {q.text}
            </p>
            <ul className="qcard-opts is-input" role="group" aria-labelledby={`q-${q.qid}`}>
              {q.options.map((o) => (
                <li key={o.key}>
                  <label>
                    <input type={q.type === 'multiple' ? 'checkbox' : 'radio'} name={`q_${q.qid}`} value={o.key} />
                    <span className="qcard-key">{o.key}</span>
                    <span>{o.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <div className="form-actions paper-actions">
        <button className="btn btn-primary" type="submit">
          Submit the test →
        </button>
        <span className="hint">One submission. Unanswered questions count as wrong.</span>
      </div>
    </form>
  )
}
