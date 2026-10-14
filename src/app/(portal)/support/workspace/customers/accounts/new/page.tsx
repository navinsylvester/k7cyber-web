import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Crumbs, Flash } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { requireAgent } from '@/lib/support/session'

import { AccountFields, loadGeo } from '../../forms'

import { createAccountAction } from './actions'

export const metadata: Metadata = { title: 'New account' }

type SP = { error?: string; name?: string; phone?: string; email?: string; website?: string }

export default async function NewAccountPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const geo = await loadGeo(me.auth)
  return (
    <>
      <WorkspaceBar active="customers" />
      <section className="sheet ws g-paper">
        <div className="form-sheet">
          <Crumbs items={[{ label: 'Customers', href: `${WS}/customers` }, { label: 'Accounts', href: `${WS}/customers?kind=accounts` }, { label: 'New account' }]} />
          <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
            New account.
          </h1>
          <p className="form-intro">An organisation that uses K7: a company, a school, a partner or a distributor. Add its people as contacts afterwards.</p>
          {sp.error && <Flash kind="error">{sp.error}</Flash>}
          <form action={createAccountAction} className="form-grid">
            <AccountFields v={{ name: sp.name ?? '', phone: sp.phone ?? '', email: sp.email ?? '', website: sp.website ?? '' }} geo={geo} />
            <div className="form-actions span-2">
              <button className="btn btn-primary" type="submit">
                Create account →
              </button>
              <Link className="link-u" href={`${WS}/customers?kind=accounts`}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </section>
    </>
  )
}
