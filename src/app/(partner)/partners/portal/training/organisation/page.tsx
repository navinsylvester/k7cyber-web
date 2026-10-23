import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Empty, RoleTags, Strip } from '@/components/partner/Parts'
import { ModulesBar, TestStateTag } from '@/components/partner/Training'
import { requirePartnerRole } from '@/lib/partner/session'
import { orgTrainingFor, PARTNER_TRAINING } from '@/lib/partner/training'
import { dmy } from '@/lib/support/format'

export const metadata: Metadata = { title: 'Training · organisation' }

/* FR-TRN-11 for the Partner Admin: every active user of the organisation, the tracks open to them and where they stand on
   each course (modules, test, best score, last activity). Read through the scope; nobody else's organisation can appear. */
export default async function OrgTrainingPage() {
  const me = await requirePartnerRole(['admin'], `${PARTNER_TRAINING}/organisation`)
  const rows = await orgTrainingFor(me)
  const learners = rows.filter((r) => r.groups.length)
  const courses = learners.flatMap((r) => r.groups.flatMap((g) => g.courses))
  const passed = courses.filter((c) => c.standing.test === 'passed').length
  const certifiedPeople = learners.filter((r) => r.groups.some((g) => g.courses.some((c) => c.standing.test === 'passed'))).length
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">
            <Link className="link-u" href={PARTNER_TRAINING}>
              Training
            </Link>{' '}
            · {me.org.tradeName || me.org.name}
          </span>
          <h1 className="h-util">Your organisation’s progress.</h1>
          <p className="lede">Every user of the organisation with the tracks their roles open, the modules they have completed, the state of each test and their best score. A user without the Sales or Technical role has no track; give them one on their member sheet.</p>
        </div>
      </div>
      <Strip
        items={[
          { label: 'Users', value: `${String(rows.length).padStart(2, '0')} · ${String(learners.length).padStart(2, '0')} with a track` },
          { label: 'Courses in hand', value: String(courses.length).padStart(2, '0') },
          { label: 'Tests passed', value: String(passed).padStart(2, '0') },
          { label: 'People with a pass', value: String(certifiedPeople).padStart(2, '0') },
        ]}
      />
      {learners.length === 0 ? (
        <Empty label="Training">{rows.length === 0 ? 'No user in the organisation yet.' : 'No published course applies to your users’ roles yet.'}</Empty>
      ) : (
        <div className="library">
          {learners.map((r) => (
            <section className="filed ledger" key={r.user.id} aria-labelledby={`u-${r.user.id}`}>
              <span className="ftab label" id={`u-${r.user.id}`}>
                {r.user.name || r.user.email} <span className="muted">· {r.user.email}</span>
              </span>
              <div className="table-wrap">
                <table className="dtable trn-table org-trn">
                  <thead>
                    <tr>
                      <th scope="col">Track · course</th>
                      <th scope="col">Modules</th>
                      <th scope="col">Test</th>
                      <th scope="col" className="num">
                        Best
                      </th>
                      <th scope="col" className="num">
                        Attempts
                      </th>
                      <th scope="col">Last activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.groups.flatMap((g) =>
                      g.courses.map((c) => (
                        <tr className="row" key={c.course.id}>
                          <td className="title">
                            <span className="muted">{g.track.name} · </span>
                            {c.course.title}
                            <div className="muted mono-note">v{c.course.version}{c.standing.passOutdated ? ` · passed on v${c.standing.pass?.courseVersion}` : ''}</div>
                          </td>
                          <td className="text">
                            <ModulesBar modules={c.modules} progress={new Map(c.progress.map((p) => [p.moduleId, p]))} rules={c.rules} compact />
                          </td>
                          <td className="status">
                            <TestStateTag state={c.standing.test} />
                          </td>
                          <td className="num">{c.standing.best ? `${c.standing.best.score ?? 0}%` : '—'}</td>
                          <td className="num">{c.standing.attempts || '—'}</td>
                          <td className="num">{c.standing.lastActivity ? dmy(c.standing.lastActivity) : '—'}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
              <div className="ledger-foot">
                <span className="label">
                  <RoleTags roles={r.user.roles} />
                </span>
                <span className="label">
                  <Link className="link-u" href={`/partners/portal/organisation/users/${r.user.id}`}>
                    Member sheet →
                  </Link>
                </span>
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
