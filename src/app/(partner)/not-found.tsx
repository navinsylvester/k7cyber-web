import Link from 'next/link'
import React from 'react'

export default function PartnerNotFound() {
  return (
    <section className="sheet ws g-paper">
      <div className="hero-meta">
        <span className="label">404 · Not found</span>
        <span className="label">No record at this address</span>
      </div>
      <div className="hero-grid">
        <h1 className="h-page">Nothing here.</h1>
        <div className="hero-side">
          <p className="lede">The page may have moved, or the partner portal is not open on this host.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/partners/portal">
              Partner portal →
            </Link>
            <Link className="btn btn-line" href="/partners">
              The programme
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
