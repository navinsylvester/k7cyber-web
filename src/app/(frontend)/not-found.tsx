import Link from 'next/link'
import React from 'react'

export default function NotFound() {
  return (
    <article>
      <section className="sheet g-paper hero-u" id="top">
        <div className="hero-meta">
          <span className="label">404 · Not found</span>
          <span className="label">No record at this address</span>
        </div>
        <div className="hero-grid">
          <h1 className="h-page">Nothing here.</h1>
          <div className="hero-side">
            <p className="lede">The page may have moved or never existed. The platform, solutions and services are in the menu above.</p>
            <div className="actions">
              <Link className="btn btn-primary" href="/">
                Home →
              </Link>
              <Link className="btn btn-line" href="/contact-us">
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </article>
  )
}
