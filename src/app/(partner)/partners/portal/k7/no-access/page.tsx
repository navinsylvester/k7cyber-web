import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { StaffRoleTags } from '@/components/partner/Parts'
import { requireK7 } from '@/lib/partner/session'

export const metadata: Metadata = { title: 'No access' }

export default async function K7NoAccessPage() {
  const me = await requireK7()
  return (
    <section className="sheet ws g-paper">
      <div className="signin">
        <span className="label muted">Not for your role</span>
        <h1 className="h-util">That page needs a partner-portal role you do not hold.</h1>
        <p>
          You are signed in as <strong>{me.name || me.email}</strong> with <StaffRoleTags roles={me.roles} />. Roles are given in the portal’s settings (the Payload global <em>Partner portal settings</em>, tab Staff) by work email; ask the channel team.
        </p>
        <div className="actions">
          <Link className="btn btn-primary" href="/partners/portal/k7">
            Partner desk →
          </Link>
        </div>
      </div>
    </section>
  )
}
