import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Empty, Flash, Strip } from '@/components/partner/Parts'
import { CourseLedger } from '@/components/partner/Training'
import { requirePartner } from '@/lib/partner/session'
import { PARTNER_CERTIFICATES } from '@/lib/partner/certificates'
import { PARTNER_TRAINING, trainingFor } from '@/lib/partner/training'

export const metadata: Metadata = { title: 'Training' }

type SP = { ok?: string; error?: string }

/* The learner's training (01-requirements.md §4, FR-TRN-01, 11): the tracks open to their roles, each course with its
   modules, the test's state and the best score. Every read carries the scope and the user; a Partner Admin also reaches the
   organisation's view. */
export default async function TrainingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requirePartner(PARTNER_TRAINING)
  const groups = await trainingFor(me)
  const rows = groups.flatMap((g) => g.courses)
  const passed = rows.filter((r) => r.standing.test === 'passed' || r.standing.test === 'recertify').length
  const ready = rows.filter((r) => r.standing.test === 'ready' || r.standing.test === 'failed').length
  const recertify = rows.filter((r) => r.standing.test === 'recertify').length
  const certs = rows.filter((r) => r.standing.certificate && (r.standing.certificate.state === 'valid' || r.standing.certificate.state === 'expiring')).length
  const modulesDone = rows.reduce((t, r) => t + r.standing.modulesDone, 0)
  const modulesTotal = rows.reduce((t, r) => t + r.standing.modulesTotal, 0)
  const admin = me.roles.includes('admin')
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">{me.org.tradeName || me.org.name} · training</span>
          <h1 className="h-util">Your training.</h1>
          <p className="lede">Self-paced videos with a test per course. A module counts once you have watched most of it; the test unlocks when every module of the course is complete. Passing earns an individual certificate, a PDF with a number anyone can verify; it stands for a year, and the test opens again before it lapses.</p>
        </div>
        <div className="ws-actions">
          {admin ? (
            <Link className="btn btn-line btn-sm" href={`${PARTNER_TRAINING}/organisation`}>
              Your organisation’s progress →
            </Link>
          ) : null}
        </div>
      </div>
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash kind="error">{sp.error}</Flash>}
      <Strip
        items={[
          { label: 'Tracks open to you', value: groups.length ? groups.map((g) => g.track.name).join(' · ') : '—' },
          { label: 'Courses', value: `${String(rows.length).padStart(2, '0')} · ${String(passed).padStart(2, '0')} passed` },
          { label: 'Modules', value: `${String(modulesDone).padStart(2, '0')} of ${String(modulesTotal).padStart(2, '0')} complete` },
          { label: 'Tests to take', value: ready || recertify ? `${String(ready + recertify).padStart(2, '0')}${recertify ? ` · ${recertify} to recertify` : ''}` : 'None waiting' },
          { label: 'Certificates', value: <Link href={PARTNER_CERTIFICATES}>{String(certs).padStart(2, '0')} current →</Link> },
        ]}
      />
      {groups.length === 0 ? (
        <Empty label="Training">{me.roles.some((r) => r === 'sales' || r === 'technical') ? 'No course is published for your roles yet. K7 publishes the Sales and Technical tracks here as the programme opens; you will be told when one does.' : 'Training tracks are for the Sales and Technical roles. Ask your Partner Admin to add one of them to your account to take a course; as Partner Admin you can read the organisation’s progress.'}</Empty>
      ) : (
        <CourseLedger groups={groups} href={(r) => `${PARTNER_TRAINING}/${r.course.id}`} />
      )}
    </section>
  )
}
