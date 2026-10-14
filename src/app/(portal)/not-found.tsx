import Link from 'next/link'
import React from 'react'

export default function PortalNotFound() {
  return (
    <section className="sheet ws g-paper">
      <div className="hero-meta">
        <span className="label">404 · Not found</span>
        <span className="label">No record at this address</span>
      </div>
      <div className="hero-grid">
        <h1 className="h-page">Nothing here.</h1>
        <div className="hero-side">
          <p className="lede">The case, article or page may have moved or never existed.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/support">
              Help centre →
            </Link>
            <Link className="btn btn-line" href="/support/cases">
              My cases
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
