import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { ContactForm, type HomeFormField } from './ContactForm.client'
import { Customers, type HomeQuote } from './Customers.client'
import { barlow, bigShoulders } from './fonts'
import { HomeFooter } from './HomeFooter'

/* The homepage: "K7 Seventh Sense Landing" (designs/home/Seventh-Sense-Landing.html), ported section by section. The site
   header frames it (its homepage variant: no toggle, no action, the menu on the right edge) and the artboard's footer closes it
   (HomeFooter, on the Footer global's links; layout.tsx leaves SiteFooter out here). Styles: home.css.
   Copy lives here, as on the Labs landing: a designed page, not a CMS page. The CMS still owns its SEO (the "home" page's
   meta), the enquiry form ("Homepage enquiry") and whether the industry and Why K7 pages exist yet. */

export const HOME_FORM = 'Homepage enquiry'

const Arrow: React.FC<{ stroke?: string; size?: number }> = ({
  stroke = 'currentColor',
  size = 20,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke={stroke}
    strokeWidth="3"
    strokeLinecap="square"
    aria-hidden="true"
  >
    <path d="M4 12h14M13 6l6 6-6 6" />
  </svg>
)

const Slash: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 73" aria-hidden="true">
    <polygon points="33.5,0 48,0 14.5,73 0,73" fill="#EC6A23" />
  </svg>
)

const FEEDS = ['Endpoints', 'Servers', 'OT', 'Network', 'Mobile', 'Cloud']
const SOURCES = ['Endpoints', 'Servers', 'OT', 'Network', 'Mobile', 'Cloud', 'Identities', 'Data']

/* The nine tools that fall into one: [shard, label, fill, label x, label y, dark label]. */
const SHARDS: [string, string, string, number, number, boolean][] = [
  ['100,102 230,102 197,174 100,174', 'EPP', '#F4F3F0', 150, 143, true],
  ['230,102 350,102 317,174 197,174', 'EDR', '#8E9296', 273, 143, true],
  ['350,102 460,102 427,174 317,174', 'XDR', '#0B0C0D', 388, 143, false],
  ['100,174 170,174 137,246 100,246', 'DLP', '#EC6A23', 126, 215, true],
  ['170,174 300,174 267,246 137,246', 'IAM', '#0B0C0D', 218, 215, false],
  ['300,174 427,174 394,246 267,246', 'PATCH', '#F4F3F0', 347, 215, true],
  ['100,246 220,246 187,318 100,318', 'LOGS', '#B9BCBF', 150, 287, true],
  ['220,246 310,246 277,318 187,318', 'FIM', '#FF945A', 248, 287, true],
  ['310,246 394,246 361,318 277,318', 'MDR', '#5E6266', 335, 287, false],
]

const STEPS = [
  {
    n: '01',
    name: 'Sensor',
    text: 'Proprietary and unified. One agent on the endpoint instead of a stack of them.',
    mod: '',
  },
  {
    n: '02',
    name: 'Platform',
    text: 'Where it all lives. Every signal read together, not one report at a time.',
    mod: ' is-platform',
  },
  {
    n: '03',
    name: 'Agentic SOC',
    text: 'Cybersecurity, simplified. The sorting is done, so your people decide instead of dig.',
    mod: ' is-soc',
  },
]
/* What falls out of each step: its label and the pixels in flight ([delay class, signal?]). */
const DROPS: { label: string; px: [string, boolean][] }[] = [
  {
    label: 'Raw',
    px: [
      ['', false],
      ['m-f1', false],
      ['m-f2', false],
      ['m-f3', false],
    ],
  },
  {
    label: 'Correlated',
    px: [
      ['', false],
      ['m-f2', true],
    ],
  },
  { label: 'Decided', px: [['', true]] },
]

const JOBS: {
  n: string
  job: string
  title: string
  text: string
  tags: string
  art: React.ReactNode
  icon: React.ReactNode
}[] = [
  {
    n: '01',
    job: 'Infrastructure',
    title: 'Guard everything that computes',
    text: 'Prevention, detection and response, from the laptop to the plant floor.',
    tags: 'Endpoints · Servers · OT · Network · Mobile · Cloud',
    art: (
      <div className="ss-job-art" aria-hidden="true" style={{ height: 80, background: '#FFC9A9' }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="m-pn" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect x="7" y="7" width="6" height="6" fill="#0B0C0D" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#m-pn)" />
        </svg>
      </div>
    ),
    icon: (
      <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true">
        <defs>
          <clipPath id="m-cs">
            <path d="M16 2 28 6V17L16 30 4 17V6Z" />
          </clipPath>
        </defs>
        <path d="M16 2 28 6V17L16 30 4 17V6Z" fill="#F4F3F0" />
        <g clipPath="url(#m-cs)">
          <rect className="m-scan" x="0" y="-4" width="32" height="4" fill="#EC6A23" />
        </g>
      </svg>
    ),
  },
  {
    n: '02',
    job: 'Data',
    title: 'Know where your data goes',
    text: 'Control over where sensitive data lives and moves, with the reports auditors ask for.',
    tags: 'Data Loss Prevention · Compliance reporting',
    art: (
      <div className="ss-job-art" aria-hidden="true" style={{ height: 112, background: '#FF945A' }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="m-pv" width="56" height="56" patternUnits="userSpaceOnUse">
              <rect
                x="7"
                y="7"
                width="42"
                height="42"
                fill="none"
                stroke="#0B0C0D"
                strokeWidth="5"
              />
              <rect x="21" y="21" width="14" height="14" fill="#0B0C0D" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#m-pv)" />
        </svg>
      </div>
    ),
    icon: (
      <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true">
        <path d="M6 2h13l7 7v21H6Z" fill="#F4F3F0" />
        <path className="m-lock" d="M13 17v-4h6v4" fill="none" stroke="#2B2E32" strokeWidth="2" />
        <rect x="11" y="17" width="10" height="9" fill="#2B2E32" />
        <rect x="14.5" y="20" width="3" height="3" fill="#EC6A23" />
      </svg>
    ),
  },
  {
    n: '03',
    job: 'Patching',
    title: 'Close the gap before it is found',
    text: 'Vulnerabilities found and patched automatically, on every operating system you run.',
    tags: 'Vulnerability identification · Automated patching',
    art: (
      <div className="ss-job-art" aria-hidden="true" style={{ height: 144, background: '#EC6A23' }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern
              id="m-ph"
              width="18"
              height="18"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(24.6)"
            >
              <rect x="0" y="0" width="5" height="18" fill="#0B0C0D" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#m-ph)" />
        </svg>
        <span />
      </div>
    ),
    icon: (
      <svg
        viewBox="0 0 32 32"
        width="44"
        height="44"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        <path d="M3 9h15v7h7v14H3Z" fill="#F4F3F0" />
        <rect className="m-drop" x="18" y="9" width="7" height="7" fill="#EC6A23" />
      </svg>
    ),
  },
  {
    n: '04',
    job: 'Compliance',
    title: 'Stay audit-ready, every day',
    text: 'Continuous, auditable, and mapped to the frameworks that matter to you.',
    tags: 'DPDP · PCI DSS · ISO 27001 · GDPR · CBUAE · ADHICS',
    art: (
      <div className="ss-job-art" aria-hidden="true" style={{ height: 176, background: '#B8430C' }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="m-pl" width="640" height="30" patternUnits="userSpaceOnUse">
              <rect x="20" y="8" width="14" height="14" fill="#F4F3F0" />
              <path d="M23 15l3 3 5-6" fill="none" stroke="#0B0C0D" strokeWidth="2.5" />
              <rect x="46" y="12" width="170" height="6" fill="#F4F3F0" />
            </pattern>
          </defs>
          <rect y="26" width="100%" height="150" fill="url(#m-pl)" />
        </svg>
      </div>
    ),
    icon: (
      <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true">
        <path d="M5 5h6V2h10v3h6v25H5Z" fill="#F4F3F0" />
        <path className="m-tick" d="M10 17l4 4 8-9" fill="none" stroke="#EC6A23" strokeWidth="4" />
      </svg>
    ),
  },
]

const CORE = [
  ['EPP', 'Endpoint Protection Platform'],
  ['EDR', 'Endpoint Detection and Response'],
  ['XDR', 'Extended Detection and Response'],
  ['MDR', 'Managed Detection and Response'],
]
const ADDONS = [
  'Data Loss Protection',
  'Identity & Access Management',
  'Patch Management',
  'Advanced Endpoint Management',
  'Agentic SOC',
  'Log Retention',
  'File Security Monitoring',
]

const MARQUEE = 'BFSI / Education / Government / Healthcare / Manufacturing / IT·ITES / Retail /'

/* Each card opens its industry page once that page is published (the slugs the site menu uses); until then it goes to the form. */
const INDUSTRIES: { slug: string; name: string; text: string; icon: React.ReactNode }[] = [
  {
    slug: 'bfsi',
    name: 'BFSI',
    text: 'Branches, core banking and payments, with reporting mapped to PCI DSS and CBUAE.',
    icon: <path d="M16 2 30 10H2ZM5 13h4v11H5ZM14 13h4v11h-4ZM23 13h4v11h-4ZM2 26h28v4H2Z" />,
  },
  {
    slug: 'education',
    name: 'Education',
    text: 'Campus labs, staff devices and student data, managed centrally across every site.',
    icon: <path d="M16 3 31 10 16 17 1 10ZM7 15.6V23l9 5 9-5v-7.4L16 20ZM28 11h2v9h-2Z" />,
  },
  {
    slug: 'government',
    name: 'Government',
    text: 'Citizen data kept sovereign: locally supported and aligned to DPDP.',
    icon: (
      <>
        <path fillRule="evenodd" d="M6 12h20v12H6ZM10 15h3v6h-3ZM14.5 15h3v6h-3ZM19 15h3v6h-3Z" />
        <path d="M2 26h28v4H2ZM11 6h10v4H11ZM15 1h2v5h-2Z" />
        <rect x="17" y="1" width="5" height="3" fill="#EC6A23" />
      </>
    ),
  },
  {
    slug: 'healthcare',
    name: 'Healthcare',
    text: 'Clinical endpoints and patient records, with DLP and ADHICS-ready reporting.',
    icon: (
      <>
        <path d="M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9Z" />
        <rect x="14.5" y="14.5" width="3" height="3" fill="#EC6A23" />
      </>
    ),
  },
  {
    slug: 'manufacturing',
    name: 'Manufacturing',
    text: 'From office IT to plant-floor OT, without stopping the line.',
    icon: <path fillRule="evenodd" d="M2 30V15l9 5v-5l9 5V5h7v25ZM6 23h3v3H6ZM13 23h3v3h-3Z" />,
  },
  {
    slug: 'it-ites',
    name: 'IT/ITES',
    text: 'Identity, data loss and patch controls for hybrid teams working to strict SLAs.',
    icon: (
      <>
        <path fillRule="evenodd" d="M8 8h16v16H8ZM13 13h6v6h-6Z" />
        <path d="M11 3h2v4h-2ZM15 3h2v4h-2ZM19 3h2v4h-2ZM11 25h2v4h-2ZM15 25h2v4h-2ZM19 25h2v4h-2ZM3 11h4v2H3ZM3 15h4v2H3ZM3 19h4v2H3ZM25 11h4v2h-4ZM25 15h4v2h-4ZM25 19h4v2h-4Z" />
        <rect x="14.5" y="14.5" width="3" height="3" fill="#EC6A23" />
      </>
    ),
  },
  {
    slug: 'retail',
    name: 'Retail',
    text: 'Stores, POS terminals and warehouses, protected the same way from one console.',
    icon: <path fillRule="evenodd" d="M5 10h5V3h12v7h5l2 20H3ZM13 10h6V6h-6Z" />,
  },
]

const STATS = [
  ['30+', 'Years', 'Multi-decade expertise'],
  ['Millions', 'of Devices', 'Extensive sources of telemetry'],
  ['27', 'Countries', 'Geographically distributed threat intelligence'],
]

/* Channel 01 is the approved quote already on the site (Hadi Express Exchange, CBUAE audit); 02 and 03 are the design's sample
   copy and stay marked as such until approved quotes replace them. */
const QUOTES: HomeQuote[] = [
  {
    channel: 'Exchange House',
    quote:
      'We engaged K7 Cyber Security to audit our compliance with CBUAE’s IT guidelines on Business Continuity Management and Information Security. We are extremely pleased with the approach, methodology, and professionalism demonstrated by the team from K7 and appreciate the comprehensive and well-structured audit report that was submitted.',
    name: 'Arun Henry',
    role: 'Hadi Express Exchange',
  },
  {
    channel: 'Healthcare Group',
    quote:
      'We have hospitals across four cities. Rolling out K7 took weeks, not months, and the compliance reports have made our ADHICS audits far less painful.',
    name: '[Customer name]',
    role: 'CIO, Healthcare Group',
  },
  {
    channel: 'Manufacturing',
    quote:
      'What stood out was accountability. When we had an incident at 2 a.m., the K7 team was already on it before we called.',
    name: '[Customer name]',
    role: 'IT Director, Manufacturing Company',
  },
]

/* Plain text of a Lexical value (the form's confirmation message). */
const plain = (node: unknown): string => {
  if (!node || typeof node !== 'object') return ''
  const n = node as { root?: unknown; text?: unknown; children?: unknown[] }
  if (n.root) return plain(n.root)
  if (typeof n.text === 'string') return n.text
  return (n.children ?? []).map(plain).join(' ').replace(/\s+/g, ' ').trim()
}

async function loadCms() {
  const payload = await getPayload({ config: configPromise })
  const [forms, pages] = await Promise.all([
    payload.find({
      collection: 'forms',
      where: { title: { equals: HOME_FORM } },
      limit: 1,
      pagination: false,
    }),
    payload.find({
      collection: 'pages',
      where: { slug: { in: [...INDUSTRIES.map((i) => i.slug), 'why-k7'] } },
      draft: false,
      overrideAccess: false,
      limit: 50,
      pagination: false,
      select: { slug: true },
    }),
  ])
  return { form: forms.docs[0] ?? null, published: new Set(pages.docs.map((p) => p.slug)) }
}

export async function SeventhSenseHome() {
  const { form, published } = await loadCms()
  const pageOr = (slug: string) => (published.has(slug) ? `/${slug}` : '#contact')

  return (
    <div className={`ss ${bigShoulders.variable} ${barlow.variable}`}>
      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className="ss-hero" id="top">
          <div className="m-sweep" aria-hidden="true" />
          <div className="m-wrap ss-hero-in">
            <div className="m-mono ss-meta">
              <span>K7 Seventh Sense · Unified Endpoint-To-SOC Security Platform</span>
              <span className="ss-live">
                <span className="ss-seven" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, i) => (
                    <span key={i} />
                  ))}
                  <span className="m-blink" />
                </span>
                The seventh is live
              </span>
            </div>
            <div className="ss-hero-body">
              <h1 className="m-d ss-h1">
                <span className="m-in1">Seventh</span>{' '}
                <span className="m-in2">
                  <Slash className="m-slash" />
                  <span className="m-out3 ss-sense" data-text="Sense">
                    Sense
                  </span>
                </span>
              </h1>
              <div className="ss-hero-side">
                <p className="m-d ss-hero-claim">
                  Your tools see events. Seventh Sense sees the attack.
                </p>
                <div>
                  <p className="ss-hero-text">
                    One sensor, one platform and one agentic SOC that read endpoints, identities,
                    data, vulnerabilities and behaviour together, so your team sees past the
                    obvious.
                  </p>
                  <div className="ss-actions">
                    <a className="m-btn ss-btn ss-btn-signal" href="#contact">
                      Request Demo
                      <Arrow />
                    </a>
                    <a className="m-btn ss-btn ss-btn-line" href="#how">
                      See how it works
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="m-feeds"
              role="img"
              aria-label="Six signal feeds flicker while the seventh, Seventh Sense, holds steady"
            >
              {FEEDS.map((f, i) => (
                <div className="ss-feed" key={f}>
                  <div className="m-mono">{f}</div>
                  <div className="ss-feed-track">
                    <span className={`m-bar${i ? ` m-b${i + 1}` : ''}`} />
                  </div>
                </div>
              ))}
              <div className="ss-feed m-f7">
                <div className="m-mono">The 7th · Seventh Sense</div>
                <div className="ss-feed-hold m-hold" />
              </div>
            </div>
          </div>
        </section>

        <div className="ss-cut" aria-hidden="true">
          <span className="ss-cut-a" />
          <span className="ss-cut-b" />
        </div>

        {/* ---------- 01 · The puzzle ---------- */}
        <section className="ss-puzzle" id="puzzle">
          <div className="m-wrap ss-pad ss-split">
            <div>
              <div className="m-mono ss-kicker">01 · The puzzle</div>
              <h2 className="m-d ss-h2 is-far ss-lines">
                <span>Too many tools.</span>
                <span className="m-out">Not enough people.</span>
              </h2>
              <p className="ss-lede">
                Security got lost in its own puzzle: a console for every problem, a report for every
                console, and never enough people to read them.
              </p>
              <p className="ss-lede">
                K7 Seventh Sense was built to finish the puzzle, not to add another piece.
              </p>
            </div>
            <div className="ss-puzzle-art">
              <svg
                viewBox="70 72 420 276"
                role="img"
                aria-label="Nine shards, one for each separate security tool, drift apart, then lock together into one slab that reads ONE"
              >
                {SHARDS.map(([points, label, fill, x, y, dark], i) => (
                  <g className={`m-pz m-pz${i + 1}`} key={label}>
                    <polygon points={points} fill={fill} stroke="#2B2E32" strokeWidth="2" />
                    <text x={x} y={y} textAnchor="middle" className={dark ? 'm-st m-sk' : 'm-st'}>
                      {label}
                    </text>
                  </g>
                ))}
                <g className="m-fuse">
                  <polygon points="99,101 461,101 361,319 99,319" fill="#F4F3F0" />
                  <polygon points="421,101 461,101 361,319 321,319" fill="#EC6A23" />
                  <text x="122" y="136" className="m-st m-sk">
                    K7 SEVENTH SENSE
                  </text>
                  <text
                    x="118"
                    y="286"
                    className="m-sd"
                    fontSize="150"
                    fontWeight="900"
                    fill="#0B0C0D"
                  >
                    ONE
                  </text>
                </g>
              </svg>
              <div className="m-mono ss-ends">
                <span>Nine consoles in</span>
                <span>One platform out</span>
              </div>
            </div>
          </div>
        </section>

        <div className="ss-march m-march" aria-hidden="true" />

        {/* ---------- 02 · How it works ---------- */}
        <section id="how">
          <div className="m-wrap ss-pad ss-how">
            <div className="ss-how-copy">
              <div>
                <div className="m-mono ss-kicker">02 · How it works</div>
                <h2 className="m-d ss-h2 ss-lines">
                  <span>Endpoint to SOC.</span>
                  <span className="m-out">One line of sight.</span>
                </h2>
                <p className="ss-lede">
                  Raw signals go in at the top. One clear verdict comes out at the bottom.
                  Everything in between happens in one place.
                </p>
              </div>
              <div className="ss-count">
                <div>
                  <div className="m-d ss-count-n">8</div>
                  <div className="m-mono">Sources</div>
                </div>
                <Arrow size={22} />
                <div>
                  <div className="m-d ss-count-n">3</div>
                  <div className="m-mono">Stages</div>
                </div>
                <Arrow size={22} />
                <div>
                  <div className="m-d ss-count-n is-signal">1</div>
                  <div className="m-mono">Verdict</div>
                </div>
              </div>
            </div>
            <div>
              <div className="m-mono ss-src-head">
                <span>Raw signals in</span>
                <span>{SOURCES.length} sources</span>
              </div>
              <div className="m-src">
                {SOURCES.map((s, i) => (
                  <div key={s}>
                    <span
                      className={`ss-px m-blink${i ? ` m-k${i + 1}` : ''}`}
                      aria-hidden="true"
                    />
                    <span className="m-mono">{s}</span>
                  </div>
                ))}
              </div>
              <div className="ss-funnel m-down" aria-hidden="true" />
              {STEPS.map((s, i) => (
                <React.Fragment key={s.n}>
                  <div className={`ss-step${s.mod}`}>
                    <div className="ss-step-name">
                      <span className="m-mono">{s.n}</span>
                      <span className="m-d">{s.name}</span>
                    </div>
                    <p>{s.text}</p>
                  </div>
                  <div className="ss-drop" aria-hidden="true">
                    {DROPS[i]!.px.map(([delay, signal], j) => (
                      <span
                        className={`m-fall m-fs${delay ? ` ${delay}` : ''}${signal ? ' is-signal' : ''}`}
                        key={j}
                      />
                    ))}
                    <span className="m-mono">{DROPS[i]!.label}</span>
                  </div>
                </React.Fragment>
              ))}
              <div className="ss-verdict">
                <span className="m-blink" aria-hidden="true" />
                <span className="m-d">One clear verdict</span>
              </div>
            </div>
          </div>
        </section>

        <div className="ss-hatch" aria-hidden="true" />

        {/* ---------- 03 · The platform ---------- */}
        <section className="ss-platform" id="platform">
          <div className="m-wrap ss-pad">
            <div className="ss-head">
              <div>
                <div className="m-mono ss-kicker">03 · The platform</div>
                <h2 className="m-d ss-h2">
                  Four jobs. <span className="m-out">One platform.</span>
                </h2>
              </div>
              <p className="ss-lede">
                Infrastructure, data, patching and compliance, protected from one place.
              </p>
            </div>
            <div className="ss-jobs">
              {JOBS.map((j) => (
                <div key={j.n}>
                  {j.art}
                  <div className="ss-job">
                    <div className="ss-job-head">
                      <span className="m-mono">
                        {j.n} · {j.job}
                      </span>
                      {j.icon}
                    </div>
                    <h3 className="m-d">{j.title}</h3>
                    <p>{j.text}</p>
                    <p className="m-mono">{j.tags}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="ss-ruler" aria-hidden="true" />

        {/* ---------- 04 · Modules ---------- */}
        <section className="ss-modules" id="modules">
          <div className="m-wrap ss-pad">
            <div className="ss-head">
              <div>
                <div className="m-mono ss-kicker">04 · Modules</div>
                <h2 className="m-d ss-h2 ss-lines">
                  <span>Start with four.</span>
                  <span className="m-out">Switch on the rest.</span>
                </h2>
              </div>
              <p className="ss-lede">
                Every capability is managed from the same console. Switch one on the day you need
                it.
              </p>
            </div>
            <div className="ss-mods">
              <div className="ss-core">
                <div className="m-mono ss-mods-head">
                  <span>Core · on from day one</span>
                  <span>{CORE.length}</span>
                </div>
                <div className="ss-core-grid">
                  {CORE.map(([code, name]) => (
                    <div key={code}>
                      <div className="m-d">{code}</div>
                      <div className="m-mono">{name}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="ss-addons">
                <div className="m-mono ss-mods-head">
                  <span>Add-ons · switch on when you need them</span>
                  <span>{ADDONS.length}</span>
                </div>
                <div className="ss-addon-list">
                  {ADDONS.map((a, i) => (
                    <div className="ss-addon" key={a}>
                      <span className="m-d">{a}</span>
                      <span className="ss-switch" aria-hidden="true">
                        <span className={`m-sw m-w${i + 1}`} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="m-mono ss-mods-foot">
              {CORE.length + ADDONS.length} modules · one console
            </div>
          </div>
        </section>

        <div className="ss-marquee" aria-hidden="true">
          <div className="m-mq m-d">
            <span className="m-out">{MARQUEE}</span>
            <span className="m-out">{MARQUEE}</span>
          </div>
        </div>

        {/* ---------- 05 · Industries ---------- */}
        <section className="ss-industries" id="industries">
          <div className="m-wrap ss-pad is-short">
            <div className="ss-head">
              <div>
                <div className="m-mono ss-kicker">05 · Industries</div>
                <h2 className="m-d ss-h2 is-far">Security that speaks your sector</h2>
              </div>
              <p className="ss-lede">
                Every sector has its own regulator, its own estate and its own bad day. We start
                from yours.
              </p>
            </div>
            <div className="ss-cards">
              {INDUSTRIES.map((ind) => (
                <a className="m-card ss-card" href={pageOr(ind.slug)} key={ind.slug}>
                  <svg viewBox="0 0 32 32" width="32" height="32" fill="#F4F3F0" aria-hidden="true">
                    {ind.icon}
                  </svg>
                  <span className="m-d ss-card-name">{ind.name}</span>
                  <span className="ss-card-text">{ind.text}</span>
                </a>
              ))}
              <a className="m-card ss-card is-talk" href="#contact">
                <span className="m-d ss-card-name">Not on the list?</span>
                <span className="ss-talk">
                  Talk to us
                  <Arrow />
                </span>
              </a>
            </div>
          </div>
        </section>

        <div className="ss-halftone" aria-hidden="true">
          <div />
          <div />
          <div />
          <div />
          <div />
        </div>

        {/* ---------- 06 · Accountability ---------- */}
        <section id="accountability">
          <div className="m-wrap ss-pad">
            <div className="m-mono ss-kicker">06 · Accountability</div>
            <h2 className="m-d ss-h2 is-far ss-lines">
              <span>You don’t buy security.</span>
              <span className="m-out">You trust someone with it.</span>
            </h2>
            <div className="ss-acc">
              <div className="ss-acc-art">
                <svg
                  viewBox="-20 0 360 220"
                  role="img"
                  aria-label="Two blocks, yours and K7’s, slide together and lock around a single orange bond"
                >
                  <g className="m-tl">
                    <path d="M20 40h180v60h-80v80H20Z" fill="#F4F3F0" />
                    <text
                      x="70"
                      y="160"
                      textAnchor="middle"
                      className="m-sd"
                      fontSize="36"
                      fill="#0B0C0D"
                    >
                      YOU
                    </text>
                  </g>
                  <g className="m-tr">
                    <path d="M300 180H120v-60h80V40h67l33 72Z" fill="#0B0C0D" />
                    <text
                      x="250"
                      y="160"
                      textAnchor="middle"
                      className="m-sd"
                      fontSize="36"
                      fill="#F4F3F0"
                    >
                      K7
                    </text>
                  </g>
                  <rect className="m-bond" x="120" y="100" width="80" height="20" fill="#EC6A23" />
                </svg>
                <div className="m-mono">Locked in · one bond</div>
              </div>
              <div className="ss-acc-claim">
                <p className="m-d">One accountable partner. There when it matters most.</p>
              </div>
              <div className="ss-acc-text">
                <p>
                  Your data, operations, reputation and business continuity sit behind whoever you
                  choose. We build cybersecurity around one responsibility: protecting our customers
                  and being there when security matters most.
                </p>
                <a className="m-btn ss-btn ss-btn-line" href={pageOr('why-k7')}>
                  Why K7
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="ss-wire" aria-hidden="true">
          <div className="m-flag" />
          <div className="m-stream" />
        </div>

        {/* ---------- 07 · K7 Labs ---------- */}
        <section className="ss-labs" id="labs">
          <div className="m-wrap ss-pad is-short">
            <div className="m-mono ss-kicker">07 · K7 Labs</div>
            <h2 className="m-d ss-h2 is-far">
              Hundreds of thousands of samples. <span className="m-out">Every day.</span>
            </h2>
            <div className="ss-labs-grid">
              <p className="ss-lede">
                K7 Labs is one of the world’s leading antimalware research and threat intelligence
                centres. Every sample it takes apart is one your team never has to meet.
              </p>
              <div className="ss-award">
                <svg
                  viewBox="0 0 32 32"
                  width="56"
                  height="56"
                  fill="#F4F3F0"
                  role="img"
                  aria-label="Award"
                >
                  <path d="M12 2h8l6 6v8l-6 6h-8l-6-6V8Z" />
                  <path d="M9 21l5 2.5-2 7.5-2.5-3L6 30Z" />
                  <path d="M23 21l-5 2.5 2 7.5 2.5-3L26 30Z" />
                  <path d="M17 7h3l-4.6 10h-3Z" fill="#EC6A23" />
                </svg>
                <span>
                  <span className="m-mono">Award</span>
                  <strong>Real Time Threat List Contributor of the Year</strong>
                  <span className="ss-award-org">Anti-Malware Testing Standards Organization</span>
                </span>
              </div>
            </div>
            <div className="ss-stats">
              {STATS.map(([n, unit, note]) => (
                <div className="ss-stat" key={n}>
                  <div className="m-d ss-stat-n">{n}</div>
                  <div className="m-d ss-stat-u">{unit}</div>
                  <div className="m-mono">{note}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="ss-hatch is-back" aria-hidden="true" />

        {/* ---------- 08 · Customers ---------- */}
        <section id="customers">
          <div className="m-wrap ss-pad">
            <Customers
              quotes={QUOTES}
              note="CH 02 and CH 03 are sample copy · replace with approved quotes"
            />
          </div>
        </section>

        <div className="ss-cut is-contact" aria-hidden="true">
          <span className="ss-cut-a" />
          <span className="ss-cut-b" />
        </div>

        {/* ---------- 09 · Contact ---------- */}
        <section className="ss-contact" id="contact">
          <div className="m-wrap ss-pad ss-contact-grid">
            <div>
              <div className="m-mono ss-kicker">09 · Contact</div>
              <h2 className="m-d ss-h2 is-far">Talk to a K7 specialist</h2>
              <div className="ss-contact-row">
                <p>
                  Tell us what you need to protect. A specialist will get back to you within one
                  business day.
                </p>
                <a
                  className="m-btn ss-btn ss-btn-lg ss-btn-ink"
                  href={form ? '#ss-form' : '/contact-us'}
                >
                  Request Demo
                  <Arrow stroke="#EC6A23" />
                </a>
              </div>
            </div>
            {form && (
              <ContactForm
                formId={form.id}
                fields={(form.fields ?? []) as unknown as HomeFormField[]}
                submitLabel={form.submitButtonLabel || 'Send Message'}
                thanks={
                  plain(form.confirmationMessage) ||
                  'Thank you. A K7 specialist will get back to you within one business day.'
                }
              />
            )}
          </div>
        </section>

        <div className="ss-hatch is-end" aria-hidden="true" />
      </main>
      <HomeFooter />
    </div>
  )
}
