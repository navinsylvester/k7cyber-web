import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { RoleTags } from '@/components/partner/Parts'
import { requirePartner } from '@/lib/partner/session'

export const metadata: Metadata = { title: 'No access' }

export default async function PartnerNoAccessPage() {
  const me = await requirePartner()
  return (
    <section className="sheet ws g-paper">
      <div className="signin">
        <span className="label muted">Not for your role</span>
        <h1 className="h-util">That page needs a role you do not hold.</h1>
        <p>
          You are signed in to <strong>{me.org.name}</strong> as <RoleTags roles={me.roles} />. Your Partner Admin can change your roles.
        </p>
        <div className="actions">
          <Link className="btn btn-primary" href="/partners/portal">
            Home →
          </Link>
        </div>
      </div>
    </section>
  )
}
