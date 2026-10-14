import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { Crumbs, Field, Flash, MetaRows } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv } from '@/lib/dataverse/types'
import { dmyHm } from '@/lib/support/format'
import { getArticle } from '@/lib/support/kb'
import { requireAgent } from '@/lib/support/session'

import { updateArticleAction } from './actions'

export const metadata: Metadata = { title: 'Article' }

/* One article as the agent sees it: the sanitised body, its facts, and the edit panel with the raw HTML. */
export default async function ArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; edit?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const me = await requireAgent()
  const a = await getArticle(me.auth, id, 'agent')
  if (!a) notFound()
  const raw = typeof a.content === 'string' ? a.content : ''
  return (
    <>
      <WorkspaceBar active="kb" />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <Crumbs items={[{ label: 'Knowledge', href: `${WS}/kb` }, { label: a.articlepublicnumber }]} />
            <h1 className="h-util">{a.title}</h1>
            <div className="tags">
              <span className="tag lid">{a.articlepublicnumber}</span>
              <span className={`tag${a.statecode === 3 ? ' tag-solid' : ''}`}>{fv(a, 'statecode')}</span>
              <span className={`tag${a.isinternal ? ' tag-quiet' : ''}`}>{a.isinternal ? 'Internal only' : 'Visible to customers'}</span>
            </div>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <div className="ws-grid">
          <div>
            {a.description ? <p className="lede" style={{ marginBottom: 24 }}>{String(a.description)}</p> : null}
            {a.html ? <div className="prose" dangerouslySetInnerHTML={{ __html: a.html }} /> : <p className="hint">This article has no body yet.</p>}
          </div>
          <aside className="ws-side">
            <MetaRows
              items={[
                { k: 'Keywords', v: String(a.keywords ?? ''), sans: true },
                { k: 'Views', v: String(a.knowledgearticleviews ?? 0) },
                { k: 'Owner', v: fv(a, '_ownerid_value'), sans: true },
                { k: 'Modified by', v: fv(a, '_modifiedby_value'), sans: true },
                { k: 'Modified', v: dmyHm(String(a.modifiedon ?? '')) },
                { k: 'Created', v: dmyHm(String(a.createdon ?? '')) },
              ]}
            />
            <div className="acts">
              <details open={sp.edit === '1'}>
                <summary>Edit article</summary>
                <div className="act-body">
                  <p>Edits save to this version. Approval and publishing happen in the Customer Service Hub.</p>
                  <form action={updateArticleAction} className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                    <input type="hidden" name="id" value={a.knowledgearticleid} />
                    <Field id="title" label="Title" required>
                      <input id="title" name="title" required defaultValue={a.title} />
                    </Field>
                    <Field id="description" label="Summary">
                      <input id="description" name="description" defaultValue={String(a.description ?? '')} />
                    </Field>
                    <Field id="keywords" label="Keywords" hint="Comma-separated; search matches these.">
                      <input id="keywords" name="keywords" defaultValue={String(a.keywords ?? '')} />
                    </Field>
                    <Field id="content" label="Body (HTML)">
                      <textarea id="content" name="content" rows={14} defaultValue={raw} spellCheck={false} style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
                    </Field>
                    <label className="check">
                      <input type="checkbox" name="internal" defaultChecked={Boolean(a.isinternal)} />
                      <span>Internal only: hide from customers even when published</span>
                    </label>
                    <button className="btn btn-line btn-sm" type="submit">
                      Save article
                    </button>
                  </form>
                </div>
              </details>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
