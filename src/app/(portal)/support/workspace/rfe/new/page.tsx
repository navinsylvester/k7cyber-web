import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Crumbs, Field, Flash, Options } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getCase } from '@/lib/support/cases'
import { RFE_STATUS, RFE_TYPE } from '@/lib/support/options'
import { requireAgent } from '@/lib/support/session'

import { createRfeAction } from './actions'

export const metadata: Metadata = { title: 'New RFE' }

type SP = { error?: string; title?: string; yodizId?: string; users?: string; serial?: string; case?: string }

export default async function NewRfePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const linked = sp.case ? await getCase(me.auth, sp.case).catch(() => null) : null
  return (
    <>
      <WorkspaceBar active="product" />
      <section className="sheet ws g-paper">
        <div className="form-sheet">
          <Crumbs items={[{ label: 'Product desk', href: `${WS}/product?view=rfes` }, { label: 'New RFE' }]} />
          <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
            New request for enhancement.
          </h1>
          <p className="form-intro">What the customer wants the product to do that it does not do today. Link the case it came from so the product team sees the context.</p>
          {sp.error && <Flash kind="error">{sp.error}</Flash>}
          {linked && (
            <Flash>
              Linked to case {String(linked.ticketnumber)}: {String(linked.title ?? '')}
            </Flash>
          )}
          <form action={createRfeAction} className="form-grid">
            <Field id="title" label="Title" required span>
              <input id="title" name="title" required defaultValue={sp.title ?? (linked ? `RFE: ${String(linked.title ?? '')}` : '')} placeholder="Allow scheduled scans to skip network drives" />
            </Field>
            <Field id="type" label="Type" required select>
              <select id="type" name="type" required defaultValue={linked ? 100000001 : ''}>
                <Options items={RFE_TYPE} empty="Choose a type" />
              </select>
            </Field>
            <Field id="status" label="Status" select>
              <select id="status" name="status" defaultValue={696720001}>
                <Options items={RFE_STATUS} />
              </select>
            </Field>
            <Field id="yodizId" label="YODIZ id" hint="Once the product team has logged it.">
              <input id="yodizId" name="yodizId" defaultValue={sp.yodizId ?? ''} placeholder="K7-1234" />
            </Field>
            <Field id="users" label="Number of users">
              <input id="users" name="users" inputMode="numeric" defaultValue={sp.users ?? ''} placeholder="250" />
            </Field>
            <Field id="serial" label="Serial number">
              <input id="serial" name="serial" defaultValue={sp.serial ?? ''} spellCheck={false} />
            </Field>
            <Field id="caseId" label="Case id" hint="The id in the case page's address, or leave empty.">
              <input id="caseId" name="caseId" defaultValue={sp.case ?? ''} spellCheck={false} placeholder="00000000-0000-0000-0000-000000000000" />
            </Field>
            <div className="form-actions span-2">
              <button className="btn btn-primary" type="submit">
                Create RFE →
              </button>
              <Link className="link-u" href={`${WS}/rfe`}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </section>
    </>
  )
}
