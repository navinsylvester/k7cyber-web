import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { Empty, Flash } from '@/components/partner/Parts'
import { ContentStateTag } from '@/components/partner/Training'
import { requireK7Role } from '@/lib/partner/session'
import { K7_TRAINING, k7CourseLedger, trainingCounts } from '@/lib/partner/training'
import type { ContentStatus } from '@/lib/partner/training-model'
import { dmy } from '@/lib/support/format'

export const metadata: Metadata = { title: 'Training' }

type SP = { view?: string; ok?: string; error?: string }
const VIEWS: { key: ContentStatus | 'all' | 'nobank'; label: string }[] = [
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'nobank', label: 'Without a bank' },
  { key: 'retired', label: 'Retired' },
  { key: 'all', label: 'All' },
]

/* The Training Admin's ledger (FR-TRN-12, 13, decision 9): every course in every state with its track, version, modules,
   the askable bank, the learners and the pass rate. Editing happens in the Payload admin, one click away; the CSV import of
   a bank is on each course's sheet here. */
export default async function K7TrainingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireK7Role(['trainingAdmin'], K7_TRAINING)
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : 'published') as (typeof VIEWS)[number]['key']
  const [rows, counts] = await Promise.all([k7CourseLedger(), trainingCounts()])
  const inView = rows.filter((r) => (view === 'all' ? true : view === 'nobank' ? r.course.status !== 'retired' && r.bank === 0 : r.course.status === view))
  const counter = (label: string, n: number, href: string, hot = false) => (
    <Link className={`kpi${hot && n > 0 ? ' is-signal' : ''}`} href={href} key={label}>
      <span className="n">{n}</span>
      <span className="label">{label}</span>
    </Link>
  )
  return (
    <>
      <K7Nav active="training" roles={me.roles} counts={{ training: counts.banksEmpty }} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">Partner desk · training</span>
            <h1 className="h-util">Courses and tests.</h1>
            <p className="lede">The Sales and Technical tracks as partners see them: each course’s state, version, modules and question bank, who has started it and who has passed. Tracks, courses, modules and questions are edited in the Payload admin; a course’s bank can also be imported from a CSV on its sheet here.</p>
          </div>
          <div className="ws-actions">
            <Link className="btn btn-primary" href="/admin/collections/partner-courses/create">
              Add a course →
            </Link>
            <Link className="link-u" href="/admin/collections/partner-tracks">
              Tracks in the admin
            </Link>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          {counter('Published courses', counts.published, `${K7_TRAINING}?view=published`)}
          {counter('Drafts', counts.draft, `${K7_TRAINING}?view=draft`)}
          {counter('Without a bank', counts.banksEmpty, `${K7_TRAINING}?view=nobank`, true)}
          {counter('Active questions', counts.questions, `${K7_TRAINING}?view=all`)}
          {counter('Learners, 30 days', counts.learners30, `${K7_TRAINING}?view=published`)}
          {counter('Passes, 30 days', counts.passes30, `${K7_TRAINING}?view=published`)}
        </div>

        <form className="views" action={K7_TRAINING} method="get">
          <div className="seg-choice" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <label key={v.key}>
                <input type="radio" name="view" value={v.key} defaultChecked={view === v.key} />
                {v.label}
              </label>
            ))}
          </div>
          <button className="btn btn-line btn-sm" type="submit">
            Show
          </button>
        </form>

        {inView.length === 0 ? (
          <Empty label={VIEWS.find((v) => v.key === view)?.label}>{rows.length === 0 ? 'No course yet. Make a track and a course in the admin, add modules with their videos, fill the bank, then publish.' : 'Nothing in this view.'}</Empty>
        ) : (
          <div className="filed ledger">
            <span className="ftab label">
              {inView.length} course{inView.length === 1 ? '' : 's'}
            </span>
            <div className="table-wrap">
              <table className="dtable trn-k7">
                <thead>
                  <tr>
                    <th scope="col">Course</th>
                    <th scope="col">Track</th>
                    <th scope="col">State</th>
                    <th scope="col" className="num">
                      Version
                    </th>
                    <th scope="col" className="num">
                      Modules
                    </th>
                    <th scope="col" className="num">
                      Bank
                    </th>
                    <th scope="col" className="num">
                      Learners
                    </th>
                    <th scope="col" className="num">
                      Passed
                    </th>
                    <th scope="col" className="num">
                      Pass rate
                    </th>
                    <th scope="col">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {inView.map((r) => (
                    <tr className={`row${r.course.status === 'retired' ? ' is-off' : ''}`} key={r.course.id}>
                      <td className="title">
                        <Link href={`${K7_TRAINING}/${r.course.id}`}>{r.course.title}</Link>
                        {r.course.description ? <div className="muted lib-desc">{r.course.description}</div> : null}
                      </td>
                      <td className="text">{r.track ? r.track.name : <span className="is-ending">No track</span>}</td>
                      <td className="status">
                        <ContentStateTag status={r.course.status} />
                      </td>
                      <td className="num">v{r.course.version}</td>
                      <td className="num">
                        {r.modules}
                        {r.modulesDraft ? <div className="muted">+{r.modulesDraft} draft</div> : null}
                      </td>
                      <td className={`num${r.bank === 0 && r.course.status === 'published' ? ' is-hot' : ''}`}>
                        {r.bank}
                        {r.bankTotal !== r.bank ? <div className="muted">of {r.bankTotal}</div> : null}
                      </td>
                      <td className="num">
                        {r.learners}
                        {r.completed ? <div className="muted">{r.completed} all modules</div> : null}
                      </td>
                      <td className={`num${r.passed ? ' is-won' : ''}`}>{r.passed}</td>
                      <td className="num">{r.passRate === null ? '—' : `${r.passRate}%`}</td>
                      <td className="num">{dmy(r.course.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ledger-foot">
              <span className="label">Bank: questions that can be asked (active, well formed). A published course without one shows to partners but its test stays locked and the desk is told.</span>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
