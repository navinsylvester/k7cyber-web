import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { Empty, Field, Flash, Strip } from '@/components/partner/Parts'
import { AttemptsLedger, ContentStateTag } from '@/components/partner/Training'
import { requireK7Role } from '@/lib/partner/session'
import { K7_TRAINING, k7CourseView } from '@/lib/partner/training'
import { minutesText, QUESTION_TYPE_LABEL, QUESTION_TYPES } from '@/lib/partner/training-model'
import { videoRefText } from '@/lib/partner/video'
import { dmy, dmyHm } from '@/lib/support/format'

import { importQuestionsAction } from '../actions'

export const metadata: Metadata = { title: 'Course' }

type SP = { ok?: string; error?: string; lines?: string }

/* One course for the Training Admin (FR-TRN-12, 13, 14): its rules as the portal applies them, the modules with their videos,
   the bank by type with the rows that cannot be asked, the learners with their standing, the recent attempts, and the CSV
   import on the decision panel. Editing is in the admin, linked from each part. */
export default async function K7CoursePage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<SP> }) {
  const [{ courseId }, sp] = await Promise.all([params, searchParams])
  const me = await requireK7Role(['trainingAdmin'], `${K7_TRAINING}/${courseId}`)
  const v = await k7CourseView(courseId)
  if (!v) notFound()
  const { course, track, rules, modules, bank, learners, recent } = v
  const byType = QUESTION_TYPES.map((t) => ({ t, n: bank.filter((q) => q.type === t && q.active).length }))
  const passed = learners.filter((l) => l.pass).length
  return (
    <>
      <K7Nav active="training" roles={me.roles} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">
              <Link className="link-u" href={K7_TRAINING}>
                Training
              </Link>{' '}
              · {track ? track.name : 'no track'}
            </span>
            <h1 className="h-util">{course.title}.</h1>
            {course.description ? <p className="lede">{course.description}</p> : null}
          </div>
          <div className="ws-actions">
            <Link className="btn btn-primary" href={`/admin/collections/partner-courses/${course.id}`}>
              Edit in the admin →
            </Link>
            <Link className="link-u" href={`/admin/collections/partner-modules/create?course=${course.id}`}>
              Add a module
            </Link>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        {sp.lines ? (
          <div className="pending import-lines">
            <h2>
              <i className="pixel" aria-hidden="true" /> Rows refused
            </h2>
            <ul>
              {sp.lines.split('|').map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <Strip
          items={[
            { label: 'State', value: <ContentStateTag status={course.status} /> },
            { label: 'Version', value: `v${course.version}` },
            { label: 'Rules', value: `${rules.questionsPerTest} questions · ${rules.timeLimitMinutes} min · pass ${rules.passMark}% · ${Math.round(rules.requiredShare * 100)}% watched` },
            { label: 'Bank', value: `${v.askable} askable of ${bank.length}` },
            { label: 'Learners', value: `${learners.length} · ${passed} passed` },
          ]}
        />
        <div className="phome">
          <div>
            <h2>Modules</h2>
            {modules.length ? (
              <div className="filed ledger">
                <span className="ftab label">
                  {modules.length} module{modules.length === 1 ? '' : 's'}
                </span>
                <div className="table-wrap">
                  <table className="dtable trn-k7">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Module</th>
                        <th scope="col">Video</th>
                        <th scope="col" className="num">
                          Length
                        </th>
                        <th scope="col" className="num">
                          Files
                        </th>
                        <th scope="col">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((m, i) => (
                        <tr className={`row${m.status !== 'published' ? ' is-off' : ''}`} key={m.id}>
                          <td className="num">{String(i + 1).padStart(2, '0')}</td>
                          <td className="title">
                            <Link href={`/admin/collections/partner-modules/${m.id}`}>{m.title}</Link>
                            {m.description ? <div className="muted lib-desc">{m.description}</div> : null}
                          </td>
                          <td className={`text${!m.video ? ' is-ending' : ''}`}>{videoRefText(m.video)}</td>
                          <td className="num">{minutesText(m.durationSeconds)}</td>
                          <td className="num">{m.attachments.length || '—'}</td>
                          <td className="status">
                            <ContentStateTag status={m.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <Empty label="Modules">No module yet. Add one in the admin with its video (a Vimeo link or an uploaded MP4) and publish it.</Empty>
            )}

            <h2 style={{ marginTop: 'clamp(28px, 3cqw, 40px)' }}>Learners</h2>
            {learners.length ? (
              <div className="filed ledger">
                <span className="ftab label">
                  {learners.length} learner{learners.length === 1 ? '' : 's'}
                </span>
                <div className="table-wrap">
                  <table className="dtable trn-k7">
                    <thead>
                      <tr>
                        <th scope="col">Who</th>
                        <th scope="col">Organisation</th>
                        <th scope="col" className="num">
                          Modules
                        </th>
                        <th scope="col" className="num">
                          Attempts
                        </th>
                        <th scope="col" className="num">
                          Best
                        </th>
                        <th scope="col">Passed</th>
                        <th scope="col">Last activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {learners.map((l) => (
                        <tr className="row" key={l.userId}>
                          <td className="title">
                            {l.name || l.email}
                            <div className="muted">{l.email}</div>
                          </td>
                          <td className="text">
                            {l.partnerId ? <Link className="link-u" href={`/partners/portal/k7/partners/${l.partnerId}`}>{l.orgName}</Link> : l.orgName}
                          </td>
                          <td className="num">
                            {l.modulesDone}/{l.modulesTotal}
                          </td>
                          <td className="num">{l.attempts || '—'}</td>
                          <td className="num">{l.best ? `${l.best.score ?? 0}%` : '—'}</td>
                          <td className={`text${l.pass ? ' is-won' : ''}`}>{l.pass ? `${dmy(l.pass.submittedAt ?? l.pass.startedAt)} · v${l.pass.courseVersion}` : '—'}</td>
                          <td className="num">{l.lastActivity ? dmyHm(l.lastActivity) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <Empty label="Learners">Nobody has started this course yet.</Empty>
            )}
            {recent.length ? (
              <div style={{ marginTop: 'clamp(28px, 3cqw, 40px)' }}>
                <AttemptsLedger attempts={recent} href={() => '#'} label="Recent attempts" who />
              </div>
            ) : null}
          </div>
          <aside className="ws-side">
            <div className="decide">
              <h2>Import questions</h2>
              <p className="muted" style={{ margin: '0 0 14px', fontSize: 15 }}>
                FR-TRN-13: a CSV in the template’s columns, appended to this course’s bank. Bad rows are refused by line and the rest kept. <a className="link-u" href={`${K7_TRAINING}/template.csv`}>The template</a>.
              </p>
              <form action={importQuestionsAction} className="form-grid" encType="multipart/form-data">
                <input type="hidden" name="courseId" value={course.id} />
                <Field id="csv" label="CSV file" required span>
                  <input id="csv" name="csv" type="file" accept=".csv,text/csv" required />
                </Field>
                <div className="form-actions span-2">
                  <button className="btn btn-primary" type="submit">
                    Import →
                  </button>
                </div>
              </form>
            </div>
            <div>
              <h2>The bank</h2>
              <dl className="meta-rows">
                {byType.map((x) => (
                  <React.Fragment key={x.t}>
                    <dt>{QUESTION_TYPE_LABEL[x.t]}</dt>
                    <dd>{String(x.n).padStart(2, '0')}</dd>
                  </React.Fragment>
                ))}
                <dt>Cannot be asked</dt>
                <dd className={v.invalid.length ? 'is-ending' : undefined}>{String(v.invalid.length).padStart(2, '0')}</dd>
              </dl>
              {v.invalid.length ? (
                <ul className="bank-bad">
                  {v.invalid.slice(0, 8).map(({ q, why }) => (
                    <li key={q.id}>
                      <Link className="link-u" href={`/admin/collections/partner-questions/${q.id}`}>
                        {q.text.slice(0, 60)}
                        {q.text.length > 60 ? '…' : ''}
                      </Link>{' '}
                      <span className="muted">· {why}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="more">
                <Link className="link-u" href={`/admin/collections/partner-questions?where[course][equals]=${course.id}`}>
                  The bank in the admin →
                </Link>
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
