import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { FileTag } from '@/components/partner/Collateral'
import { Player } from '@/components/partner/Player.client'
import { ModuleList, WatchLine } from '@/components/partner/Training'
import { fileKind } from '@/lib/partner/collateral-model'
import { requirePartner } from '@/lib/partner/session'
import { loadModuleFor, PARTNER_TRAINING, trainingFileUrl } from '@/lib/partner/training'
import { moduleComplete } from '@/lib/partner/training-model'

export const metadata: Metadata = { title: 'Module' }

/* One module (FR-TRN-02, 03): the player with the watched line, the reading material and the files beneath, the course's
   module list beside it with this one marked, the next module once this one is complete. Reached only through a course the
   user may take. */
export default async function ModulePage({ params }: { params: Promise<{ courseId: string; moduleId: string }> }) {
  const { courseId, moduleId } = await params
  const me = await requirePartner(`${PARTNER_TRAINING}/${courseId}/${moduleId}`)
  const view = await loadModuleFor(me, courseId, moduleId)
  if (!view) notFound()
  const { course, module: m, mine, required, source, prev, next, index, modules, progress, rules } = view
  const share = mine ? Math.min(1, mine.share) : 0
  const complete = Boolean(mine?.completedAt) || moduleComplete(share, required, mine?.duration)
  const courseHref = `${PARTNER_TRAINING}/${course.id}`
  const nextHref = next ? `${courseHref}/${next.id}` : `${courseHref}?ok=${encodeURIComponent(complete || !m.video ? 'Every module watched; the test is on the course page.' : 'Back to the course.')}`
  const paragraphs = m.reading.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">
            <Link className="link-u" href={PARTNER_TRAINING}>
              Training
            </Link>{' '}
            ·{' '}
            <Link className="link-u" href={courseHref}>
              {course.title}
            </Link>{' '}
            · module {String(index + 1).padStart(2, '0')} of {String(modules.length).padStart(2, '0')}
          </span>
          <h1 className="h-util">{m.title}.</h1>
          {m.description ? <p className="lede">{m.description}</p> : null}
        </div>
        <div className="ws-actions">
          {prev ? (
            <Link className="link-u" href={`${courseHref}/${prev.id}`}>
              ← Previous
            </Link>
          ) : null}
          {next ? (
            <Link className="link-u" href={`${courseHref}/${next.id}`}>
              Next →
            </Link>
          ) : (
            <Link className="link-u" href={courseHref}>
              The course →
            </Link>
          )}
        </div>
      </div>
      <div className="phome mod-layout">
        <div>
          {source ? (
            <Player source={source} postUrl={`${PARTNER_TRAINING}/progress`} moduleId={m.id} courseId={course.id} initial={{ ranges: mine?.ranges ?? [], duration: m.durationSeconds ?? mine?.duration ?? null, position: mine?.lastPosition ?? 0, share, complete }} required={required} nextHref={next ? `${courseHref}/${next.id}` : courseHref} />
          ) : (
            <WatchLine share={0} required={required} duration={null} complete={false} noVideo />
          )}
          {paragraphs.length ? (
            <div className="mod-reading">
              <h2>Reading</h2>
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : null}
          {m.attachments.length ? (
            <div className="mod-files">
              <h2>Files</h2>
              <ul className="msg-att">
                {m.attachments.map((f) => (
                  <li key={f.id}>
                    <a className="tag" href={`${trainingFileUrl(f.id)}?inline=1`} target="_blank" rel="noopener">
                      <FileTag name={f.name} size={f.size} kind={fileKind(f.mime, f.name)} /> {f.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!source && !complete ? (
            <p className="more">
              <Link className="btn btn-primary" href={nextHref}>
                {next ? 'Next module →' : 'Back to the course →'}
              </Link>
            </p>
          ) : null}
        </div>
        <aside className="ws-side">
          <div>
            <h2>In this course</h2>
            <ModuleList modules={modules} progress={progress} rules={rules} href={(x) => `${courseHref}/${x.id}`} current={m.id} />
          </div>
        </aside>
      </div>
    </section>
  )
}
