import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { ResearchBar } from '@/components/research/Bar'
import { Fresh } from '@/components/research/Parts'
import { Icon, type IconName } from '@/components/k7/Icon'
import { getLabsStats } from '@/lib/research/data'
import { getServerSideURL } from '@/utilities/getURL'

export const metadata: Metadata = {
  title: 'K7 Labs | Threat research from K7 CyberSecurity',
  description: 'K7 Labs finds cyberthreats before they find you. Research, threat intelligence and publications from K7.',
  alternates: { canonical: `${getServerSideURL()}/research` },
}

const CAPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'document', title: 'Prevention, detection and mitigation', text: 'Enables the prevention, detection and mitigation of future cyberthreats and attacks.' },
  { icon: 'beacon', title: 'Telemetry from around the world', text: 'Aggregates threat-related metadata from globally distributed sources, including live threat event telemetry from K7 Security solutions and honeypot networks.' },
  { icon: 'grid', title: 'Outbreaks, spotted early', text: 'Identifies outbreaks and fast-moving infections, helping researchers build automated security responses.' },
  { icon: 'certificate', title: 'Fewer false positives', text: 'Proactively identifies and remediates potential false positives with intelligent automation, so legitimate files are not misclassified as malware.' },
]
const CONFS = [
  ['Virus Bulletin', 'VB Conference'],
  ['CARO', 'Computer Antivirus Research Organization'],
  ['AMTSO', 'Anti-Malware Testing Standards Organization'],
  ['AVAR', 'Association of Anti-Virus Asia Researchers'],
  ['International Anti-Virus Conference', 'and other global research forums'],
]

export default async function LabsPage() {
  const s = await getLabsStats()
  const pubs: { icon: IconName; title: string; href: string; desc: string; stamp: React.ReactNode }[] = [
    { icon: 'surface', title: 'Lab Blog', href: '/research/lab-blog', desc: 'In-depth analysis of new malware, campaigns and scams.', stamp: <Fresh label="Latest post" date={s.latestPost?.publishedAt} /> },
    { icon: 'shield', title: 'Vulnerability Information', href: '/research/vulnerability-information', desc: 'CVEs rated by K7 Labs, published in monthly batches.', stamp: <Fresh label="Batch" date={s.latestBatch} /> },
    { icon: 'bars', title: 'Top Threats', href: '/research/top-threats', desc: 'The detections we see most, with removal steps.', stamp: <Fresh label="Updated" date={s.latestThreat} /> },
    { icon: 'archive', title: 'Threat Reports', href: '/research/threat-reports', desc: 'The Cyber Threat Monitor, quarterly and annual.', stamp: s.latestReport ? <Fresh label="Latest" date={s.latestReport} /> : <span className="muted">Coming soon</span> },
  ]
  return (
    <>
      <ResearchBar active="k7-labs" crumbs={[{ label: 'Research' }]} ground="contrast" />
      <main id="main">
        <section className="sheet labs-hero g-contrast" aria-labelledby="labs-h">
          <svg className="pattern" aria-hidden="true">
            <defs>
              <pattern id="pt1" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M16 12v8M12 16h8" stroke="currentColor" strokeWidth="1" fill="none" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pt1)" />
          </svg>
          <div className="hero-meta label">
            <span>K7 Labs · Threat research</span>
            <span>Est. 1998 · Chennai, India</span>
          </div>
          <h1 id="labs-h" className="stair">
            <span>Finding cyberthreats</span>
            <span>before cyberthreats</span>
            <span>find you.</span>
          </h1>
          <div className="hero-foot">
            <p className="lede">K7 Labs was established in 1998 to speed up cyberthreat discovery and shrink the window of opportunity for attacks. It analyses hundreds of thousands of samples every day and ships definition updates several times a day.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/research/lab-blog">
                Read the latest research →
              </Link>
              <Link className="btn btn-line" href="/research/top-threats">
                See top threats
              </Link>
            </div>
          </div>
          <div className="statusline label">
            <Link href="/research/lab-blog">
              <span className="k">Latest analysis</span>
              <Fresh date={s.latestPost?.publishedAt} />
            </Link>
            <Link href="/research/vulnerability-information">
              <span className="k">CVE batch</span>
              <Fresh date={s.latestBatch} />
            </Link>
            <Link href="/research/top-threats">
              <span className="k">Top threats list</span>
              <Fresh date={s.latestThreat} />
            </Link>
            <span>
              <span className="k">Latest definitions</span>
              <span className="v">{s.definitions ?? '—'}</span>
            </span>
          </div>
        </section>

        <section className="sheet g-paper" aria-labelledby="pub-h">
          <div className="sheet-tab label" style={{ '--k': 1 } as React.CSSProperties}>
            <span>
              <span className="pixel" aria-hidden="true" />
              Publications
            </span>
            <span />
          </div>
          <div className="sheet-head">
            <h2 id="pub-h" className="h-sheet">
              Read the work.
            </h2>
            <p className="body-l">Everything K7 Labs publishes, in one place. Each list shows when it last changed.</p>
          </div>
          <div className="pub-list ilist">
            {pubs.map((p) => (
              <div className="irow" key={p.href}>
                <Icon name={p.icon} />
                <span className="irow-title">
                  <Link href={p.href}>{p.title}</Link>
                </span>
                <span className="desc">{p.desc}</span>
                <span className="when label">{p.stamp}</span>
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="sheet g-panel" aria-labelledby="lab-h">
          <div className="sheet-tab label" style={{ '--k': 0.66 } as React.CSSProperties}>
            <span>
              <span className="pixel" aria-hidden="true" />
              The lab
            </span>
            <span />
          </div>
          <div className="sheet-head">
            <h2 id="lab-h" className="h-sheet">
              Hundreds of thousands
              <br />
              of samples. <span className="dim">Every day.</span>
            </h2>
            <p className="body-l">The research facility analyses threat samples around the clock and distributes definition updates multiple times a day, so every K7 user is protected against the latest threats. It also runs the K7 Threat Intel Feed Service, which powers detection in SOCs, SIEM platforms and network security solutions.</p>
          </div>
          <div className="facts lab-facts">
            <div>
              <span className="k">1998</span>
              <span className="v">K7 Labs established to accelerate cyberthreat discovery.</span>
            </div>
            <div>
              <span className="k">AMTSO</span>
              <span className="v">First winner of the Real Time Threat List Contributor of the Year award from the Anti-Malware Testing Standards Organization.</span>
            </div>
            <div>
              <span className="k">First</span>
              <span className="v">The first discoverer of several malware families.</span>
            </div>
            <div>
              <span className="k">Daily</span>
              <span className="v">Threat definition updates, multiple times a day.</span>
            </div>
          </div>
          <h3 className="label" style={{ margin: 'clamp(56px,6cqw,88px) 0 0' }}>
            Ecosystem Threat Intelligence (K7ETI)
          </h3>
          <p className="body-l" style={{ maxWidth: '62ch', margin: '14px 0 0' }}>
            At the heart of every K7 Security solution, K7ETI gives our products the best telemetry on an adversary’s capabilities and tactics, so attacks can be prevented before they land.
          </p>
          <div className="cap-list">
            {CAPS.map((c) => (
              <div key={c.title}>
                <Icon name={c.icon} className="licon licon-48" />
                <div>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="sheet stage g-contrast" aria-labelledby="stage-h">
          <div className="sheet-tab label" style={{ '--k': 0.33 } as React.CSSProperties}>
            <span>
              <span className="pixel" aria-hidden="true" />
              On stage
            </span>
            <span />
          </div>
          <div className="sheet-head">
            <h2 id="stage-h" className="h-sheet">
              Research, presented.
              <br />
              <span className="dim">Where the field meets.</span>
            </h2>
            <p className="body-l">K7 Labs researchers regularly speak and present at the leading global threat research conferences.</p>
          </div>
          <div className="conf-list">
            {CONFS.map(([n, d]) => (
              <div key={n}>
                <span className="n">{n}</span>
                <span className="d label">{d}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="sheet cta-sheet g-signal" aria-labelledby="cta-h">
          <div className="sheet-tab label" style={{ '--k': 0 } as React.CSSProperties}>
            <span>
              <span className="pixel" aria-hidden="true" />
              Threat intel
            </span>
            <span />
          </div>
          <div className="sheet-head">
            <h2 id="cta-h" className="h-sheet">
              Put K7 Labs
              <br />
              in your SOC.
            </h2>
            <p>The K7 Threat Intel Feed Service delivers the same intelligence that protects K7 users straight into your SOC, SIEM and network security tools.</p>
          </div>
          <div className="cta-actions">
            <Link className="btn btn-primary" href="/contact-us">
              Talk to our team →
            </Link>
            <Link className="link-u" href="/k7-seventh-sense">
              About the platform →
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
