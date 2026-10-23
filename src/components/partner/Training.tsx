import Link from 'next/link'
import React from 'react'

import { CONTENT_STATUS_LABEL, minutesText, pct, requiredShareFor, standingLabel, TEST_STATE_LABEL, type Attempt, type ContentStatus, type CourseRow, type CourseRules, type Module, type PaperQuestion, type Progress, type TestState, type TrackGroup } from '@/lib/partner/training-model'
import { dmy, dmyHm } from '@/lib/support/format'

/* Section 10 · Partners, the training parts (design-system/components/PartnerParts/README.md P29–P32): the test state as a tag,
   the course ledger per track with the modules bar, the module list with the watched share, the result as filed facts and the
   paper's review. Server components; the player and the paper's clock are the two client components beside this file. */

/** P29 The test state: Passed solid, Ready to take on signal (the learner must act), Not passed yet state, Locked dashed. */
export const TestStateTag: React.FC<{ state: TestState }> = ({ state }) => <span className={state === 'passed' ? 'tag tag-solid' : state === 'ready' ? 'tag tag-signal' : state === 'failed' ? 'tag tag-state' : 'tag tag-dashed'}>{TEST_STATE_LABEL[state]}</span>

/** The content's state for K7: Published solid, Draft dashed, Retired closed; never signal. */
export const ContentStateTag: React.FC<{ status: ContentStatus }> = ({ status }) => <span className={status === 'published' ? 'tag tag-solid' : status === 'retired' ? 'tag tag-closed' : 'tag tag-dashed'}>{CONTENT_STATUS_LABEL[status]}</span>

/** The pass or fail of one attempt. */
export const AttemptTag: React.FC<{ attempt: Attempt }> = ({ attempt: a }) => (a.status === 'open' ? <span className="tag tag-dashed">Open</span> : a.passed ? <span className="tag tag-solid">Passed</span> : a.status === 'expired' ? <span className="tag tag-closed">Out of time</span> : <span className="tag tag-state">Not passed</span>)

/** P29 The modules bar: one cell per published module on the track's bars, ink when complete, signal for the one in
    progress, line ahead; the count in mono beside it. */
export const ModulesBar: React.FC<{ modules: Module[]; progress: Map<string, Progress> | ((id: string) => Progress | null); rules: CourseRules; compact?: boolean }> = ({ modules, progress, rules, compact }) => {
  const get = (id: string) => (typeof progress === 'function' ? progress(id) : (progress.get(id) ?? null))
  const live = modules.filter((m) => m.status === 'published')
  const done = live.filter((m) => {
    const p = get(m.id)
    return p?.completedAt || (p && p.share >= requiredShareFor(m, rules))
  }).length
  return (
    <span className={`mbar${compact ? ' is-compact' : ''}`} title={`${done} of ${live.length} modules complete`}>
      <span className="mbar-cells" aria-hidden="true">
        {live.map((m) => {
          const p = get(m.id)
          const complete = p?.completedAt || (p && p.share >= requiredShareFor(m, rules))
          return <i key={m.id} className={complete ? 'is-done' : p && p.share > 0 ? 'is-now' : undefined} />
        })}
      </span>
      <span className="mbar-n">
        {String(done).padStart(2, '0')}/{String(live.length).padStart(2, '0')}
      </span>
    </span>
  )
}

/** P29 The course ledger: one filed ledger per track open to the learner, each course a row with its modules bar, the test
    state, the best score and one action. */
export const CourseLedger: React.FC<{ groups: TrackGroup[]; href: (c: CourseRow) => string }> = ({ groups, href }) => (
  <div className="library trn-list">
    {groups.map((g) => (
      <section className="filed ledger" key={g.track.id} aria-labelledby={`trk-${g.track.id}`}>
        <span className="ftab label" id={`trk-${g.track.id}`}>
          {g.track.name} <span className="muted">· {String(g.courses.length).padStart(2, '0')}</span>
        </span>
        <div className="table-wrap">
          <table className="dtable trn-table">
            <thead>
              <tr>
                <th scope="col">Course</th>
                <th scope="col">Modules</th>
                <th scope="col">Test</th>
                <th scope="col" className="num">
                  Best
                </th>
                <th scope="col">Last activity</th>
                <th scope="col" className="num">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {g.courses.map((r) => (
                <tr className="row" key={r.course.id}>
                  <td className="title">
                    <Link href={href(r)}>{r.course.title}</Link>
                    {r.course.description ? <div className="muted lib-desc">{r.course.description}</div> : null}
                    <div className="muted mono-note">
                      v{r.course.version}
                      {r.standing.passOutdated ? ` · passed on v${r.standing.pass?.courseVersion}` : ''}
                    </div>
                  </td>
                  <td className="text">
                    <ModulesBar modules={r.modules} progress={new Map(r.progress.map((p) => [p.moduleId, p]))} rules={r.rules} compact />
                    <div className="muted">{standingLabel(r.standing)}</div>
                  </td>
                  <td className="status">
                    <TestStateTag state={r.standing.test} />
                  </td>
                  <td className="num">{r.standing.best ? `${r.standing.best.score ?? 0}%` : '—'}</td>
                  <td className="num">{r.standing.lastActivity ? dmy(r.standing.lastActivity) : '—'}</td>
                  <td className="num lib-act">
                    <Link className="btn btn-line btn-sm" href={href(r)}>
                      {r.standing.test === 'passed' ? 'Open' : r.standing.test === 'ready' ? 'Take the test' : r.standing.modulesDone > 0 || r.standing.watchedShare > 0 ? 'Continue' : 'Start'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    ))}
  </div>
)

/** P30 The module list on the course page: the index in mono, the title and description, the length, the watched share as a
    small bar with the required share as a tick, the state; complete rows carry the pixel. */
export const ModuleList: React.FC<{ modules: Module[]; progress: Map<string, Progress>; rules: CourseRules; href: (m: Module) => string; current?: string }> = ({ modules, progress, rules, href, current }) => (
  <ol className="mods">
    {modules.map((m, i) => {
      const p = progress.get(m.id) ?? null
      const req = requiredShareFor(m, rules)
      const share = p ? Math.min(1, p.share) : 0
      const complete = Boolean(p?.completedAt) || share >= req
      return (
        <li key={m.id} className={`${complete ? 'is-done' : share > 0 ? 'is-now' : ''}${current === m.id ? ' is-current' : ''}`}>
          <span className="mods-n">{String(i + 1).padStart(2, '0')}</span>
          <div className="mods-body">
            <strong>
              {complete ? <i className="pixel" aria-label="Complete" /> : null}
              <Link href={href(m)}>{m.title}</Link>
            </strong>
            {m.description ? <p>{m.description}</p> : null}
            <WatchLine share={share} required={req} duration={m.durationSeconds ?? p?.duration ?? null} complete={complete} noVideo={!m.video} />
          </div>
          <span className="mods-len">{m.video ? minutesText(m.durationSeconds ?? p?.duration ?? null) : m.reading ? 'Reading' : '—'}</span>
        </li>
      )
    })}
  </ol>
)

/** P30 The watched line: 6px on the track's height, ink for the share watched, signal once the required share is reached, a
    2px tick at the required share; the words beneath. The player's client component moves the same line as the video plays. */
export const WatchLine: React.FC<{ share: number; required: number; duration: number | null; complete: boolean; noVideo?: boolean; live?: boolean }> = ({ share, required, duration, complete, noVideo, live }) => (
  <div className={`wline${live ? ' is-live' : ''}`} aria-label="Watched">
    <div className="wline-bar">
      <i className={complete ? 'is-done' : undefined} style={{ width: `${Math.round(Math.min(1, share) * 100)}%` }} data-fill />
      <b style={{ left: `${Math.round(required * 100)}%` }} title={`${pct(required)} needed`} />
    </div>
    <div className="wline-words">
      <span className="label" data-words>
        {noVideo ? 'No video: reading only' : complete ? `Complete · ${pct(share)} watched` : share > 0 ? `${pct(share)} watched · ${pct(required)} needed` : `Not started · ${pct(required)} needed`}
      </span>
      <span className="label muted">{duration ? minutesText(duration) : ''}</span>
    </div>
  </div>
)

/** P31 The attempts ledger: when, the score, the result, the version, the link to the result. */
export const AttemptsLedger: React.FC<{ attempts: Attempt[]; href: (a: Attempt) => string; label?: string; who?: boolean }> = ({ attempts, href, label = 'Your attempts', who }) => (
  <div className="filed ledger attempts">
    <span className="ftab label">
      {label} <span className="muted">· {String(attempts.length).padStart(2, '0')}</span>
    </span>
    <div className="table-wrap">
      <table className="dtable">
        <thead>
          <tr>
            {who ? <th scope="col">Who</th> : null}
            <th scope="col">Started</th>
            <th scope="col" className="num">
              Score
            </th>
            <th scope="col" className="num">
              Correct
            </th>
            <th scope="col">Result</th>
            <th scope="col" className="num">
              Version
            </th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr className="row" key={a.id}>
              {who ? <td className="title">{a.userName}</td> : null}
              <td className={who ? 'num' : 'title'}>{who ? dmyHm(a.startedAt) : <Link href={href(a)}>{dmyHm(a.startedAt)}</Link>}</td>
              <td className="num">{a.score === null ? '—' : `${a.score}%`}</td>
              <td className="num">
                {a.correct}/{a.total}
              </td>
              <td className="status">
                <AttemptTag attempt={a} />
              </td>
              <td className="num">v{a.courseVersion}</td>
            </tr>
          ))}
          {attempts.length === 0 ? (
            <tr className="row">
              <td colSpan={who ? 6 : 5} className="muted">
                No attempt yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  </div>
)

/** P32 The result as filed facts: the outcome tag, the score against the pass mark, the count, the time, the version. */
export const ResultFacts: React.FC<{ attempt: Attempt; timeLimitMinutes: number }> = ({ attempt: a, timeLimitMinutes }) => (
  <dl className="meta-rows result-facts">
    <dt>Result</dt>
    <dd className="sans">
      <AttemptTag attempt={a} />
    </dd>
    <dt>Score</dt>
    <dd>
      <strong>{a.score ?? 0}%</strong> <span className="muted sans">· pass mark {a.passMark}%</span>
    </dd>
    <dt>Correct</dt>
    <dd>
      {a.correct} of {a.total}
    </dd>
    <dt>Started</dt>
    <dd>{dmyHm(a.startedAt)}</dd>
    <dt>Submitted</dt>
    <dd>{a.submittedAt ? dmyHm(a.submittedAt) : '—'}</dd>
    <dt>Time limit</dt>
    <dd>{timeLimitMinutes} min</dd>
    <dt>Course version</dt>
    <dd>v{a.courseVersion}</dd>
  </dl>
)

/** P32 The review: every question of the paper with the learner's answer and, when the course allows, the correct one and the
    explanation; a wrong row carries the accent rule. Without answers shown, only right or wrong per question. */
export const PaperReview: React.FC<{ paper: PaperQuestion[]; answers: Record<string, string[]>; perQuestion: Record<string, boolean>; showAnswers: boolean }> = ({ paper, answers, perQuestion, showAnswers }) => (
  <ol className="paper review">
    {paper.map((q, i) => {
      const mine = answers[q.qid] ?? []
      const right = perQuestion[q.qid] ?? false
      return (
        <li key={q.qid} className={`qcard${right ? ' is-right' : ' is-wrong'}`}>
          <div className="qcard-head">
            <span className="qcard-n">{String(i + 1).padStart(2, '0')}</span>
            <span className={right ? 'tag tag-solid' : 'tag tag-signal'}>{right ? 'Correct' : 'Wrong'}</span>
          </div>
          <p className="qcard-text">{q.text}</p>
          <ul className="qcard-opts">
            {q.options.map((o) => {
              const chosen = mine.includes(o.key)
              const correct = q.correct.includes(o.key)
              return (
                <li key={o.key} className={`${chosen ? 'is-chosen' : ''}${showAnswers && correct ? ' is-correct' : ''}`}>
                  <span className="qcard-key">{o.key}</span>
                  <span>{o.text}</span>
                  <span className="qcard-mark label">{chosen && showAnswers && correct ? 'your answer · correct' : chosen ? 'your answer' : showAnswers && correct ? 'correct' : ''}</span>
                </li>
              )
            })}
          </ul>
          {!mine.length ? <p className="muted qcard-note">Not answered.</p> : null}
          {showAnswers && q.explanation ? <p className="qcard-note">{q.explanation}</p> : null}
        </li>
      )
    })}
  </ol>
)
