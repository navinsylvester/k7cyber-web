import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Crumbs, Field, Flash } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { requireAgent } from '@/lib/support/session'

import { createArticleAction } from './actions'

export const metadata: Metadata = { title: 'New draft' }

export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ error?: string; title?: string; description?: string; keywords?: string }> }) {
  const sp = await searchParams
  await requireAgent()
  return (
    <>
      <WorkspaceBar active="kb" />
      <section className="sheet ws g-paper">
        <div className="form-sheet">
          <Crumbs items={[{ label: 'Knowledge', href: `${WS}/kb` }, { label: 'New draft' }]} />
          <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
            New draft.
          </h1>
          <p className="form-intro">Write the answer the way you would say it on a call: what the customer sees, what to click, what to expect. The draft stays private until it is approved and published in the Customer Service Hub.</p>
          {sp.error && <Flash kind="error">{sp.error}</Flash>}
          <form action={createArticleAction} className="form-grid">
            <Field id="title" label="Title" required span>
              <input id="title" name="title" required defaultValue={sp.title ?? ''} placeholder="Activation fails with error 1004" />
            </Field>
            <Field id="description" label="Summary" hint="One sentence; shown in lists and search." span>
              <input id="description" name="description" defaultValue={sp.description ?? ''} placeholder="What to do when the serial number is refused after a reinstall." />
            </Field>
            <Field id="keywords" label="Keywords" hint="Comma-separated." span>
              <input id="keywords" name="keywords" defaultValue={sp.keywords ?? ''} placeholder="activation, serial, 1004" />
            </Field>
            <Field id="content" label="Body (HTML)" hint="Paragraphs, lists and headings. Images are not stored here." span>
              <textarea id="content" name="content" rows={16} spellCheck={false} style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} placeholder="<p>…</p>" />
            </Field>
            <label className="check span-2">
              <input type="checkbox" name="internal" />
              <span>Internal only: for agents, never shown to customers</span>
            </label>
            <div className="form-actions span-2">
              <button className="btn btn-primary" type="submit">
                Create draft →
              </button>
              <Link className="link-u" href={`${WS}/kb`}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </section>
    </>
  )
}
