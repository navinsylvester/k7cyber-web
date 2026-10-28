import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Icon } from '@/components/k7/Icon'
import { NotificationList } from '@/components/partner/Parts'
import { auth } from '@/auth'
import { PARTNER_CERTIFICATES } from '@/lib/partner/certificates'
import { collateralCountFor, PARTNER_COLLATERAL } from '@/lib/partner/collateral'
import { dealCounts, PARTNER_DASHBOARD, PARTNER_DEALS, registerGate } from '@/lib/partner/deals'
import { listNotifications } from '@/lib/partner/notify'
import { PARTNER_SCHEMES, schemeCountFor } from '@/lib/partner/schemes'
import { requirePartner, type PartnerContext } from '@/lib/partner/session'
import { PARTNER_TRAINING, trainingCountFor } from '@/lib/partner/training'

export const metadata: Metadata = { title: 'Home', description: 'Register deals, find sales material, join schemes and train your team with K7.' }

const pad = (n: number) => String(n).padStart(2, '0')
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

type Way = { icon: React.ComponentProps<typeof Icon>['name']; href: string; title: string; desc: React.ReactNode }

const Ways: React.FC<{ ways: Way[] }> = ({ ways }) => (
  <div className="paths ilist" style={{ marginTop: 'clamp(32px, 4cqw, 56px)' }}>
    {ways.map((w) => (
      <div className="irow" key={w.href}>
        <Icon name={w.icon} />
        <span className="irow-title">
          <Link href={w.href}>{w.title}</Link>
        </span>
        <span className="desc">{w.desc}</span>
        <span className="arrow" aria-hidden="true">
          →
        </span>
      </div>
    ))}
  </div>
)

const Tab: React.FC<{ n: string; label: string; k: number }> = ({ n, label, k }) => (
  <div className="sheet-tab label" style={{ '--k': k } as React.CSSProperties}>
    <span>
      <span className="pixel" aria-hidden="true" />
      <span>{n}</span>
    </span>
    <span>{label}</span>
  </div>
)

/* The partner portal's front door, on the help centre's shape (section 09 `help-hero`, `paths`, `cta-sheet`): one question, four
   ways in, and one signal sheet. A visitor reads what the portal is for and the two doors (sign in, apply); a partner user reads
   their own counts in the hero, the four ways in with where each stands, the latest from K7 and the deal to register. The
   organisation's facts and record live on the organisation page; an unusable partner session goes back to the door with its
   reason (requirePartner), an agent session is sent to the desk by the proxy. Every partner read carries `me.scope`. */
export default async function PartnerHomePage() {
  const s = await auth()
  if (s?.user?.kind === 'partner') return <PartnerHome me={await requirePartner('/partners/portal')} />
  return <VisitorHome />
}

const VisitorHome: React.FC = () => (
  <>
    <section className="sheet help-hero g-panel" aria-labelledby="home-h">
      <div className="hero-meta label">
        <span>K7 Partners · Partner portal</span>
        <span>Distributors · resellers · integrators · MSPs</span>
      </div>
      <h1 id="home-h" className="h-page">
        Sell K7, with K7 behind you.
      </h1>
      <p className="body-l" style={{ maxWidth: '52ch', marginTop: 'clamp(16px, 2cqw, 24px)' }}>
        Register your deals and K7 protects them. The current sales material, the schemes that pay you for results, and the training that certifies your team, in one place.
      </p>
      <div className="actions" style={{ marginTop: 'clamp(24px, 3cqw, 40px)' }}>
        <Link className="btn btn-primary" href="/partners/portal/sign-in">
          Sign in →
        </Link>
        <Link className="btn btn-line" href="/partners/join">
          Apply to become a partner
        </Link>
      </div>
    </section>

    <section className="sheet g-paper" aria-labelledby="ways-h">
      <Tab n="02/03" label="Four ways in" k={1} />
      <div className="sheet-head">
        <h2 id="ways-h" className="h-sheet">
          Register, sell, earn, <span className="dim">and certify.</span>
        </h2>
        <p className="body-l">Everything a K7 partner does with K7, after one sign-in with your work email.</p>
      </div>
      <Ways
        ways={[
          { icon: 'shield', href: PARTNER_DEALS, title: 'Register a deal', desc: 'Tell K7 about the opportunity once. When it is approved, it is yours for the protection window, and you follow it to the order.' },
          { icon: 'archive', href: PARTNER_COLLATERAL, title: 'Sales material', desc: 'Brochures, datasheets, presentations and brand files for every K7 product, always the current version.' },
          { icon: 'bars', href: PARTNER_SCHEMES, title: 'Schemes', desc: 'Incentive schemes with targets and slabs. Register, see your progress against the target, read your result.' },
          { icon: 'certificate', href: PARTNER_TRAINING, title: 'Training', desc: 'Self-paced courses for sales and technical people, each with a test and a certificate anyone can verify.' },
        ]}
      />
    </section>

    <section className="sheet g-signal cta-sheet" aria-labelledby="cta-h">
      <Tab n="03/03" label="Apply" k={0} />
      <div className="sheet-head">
        <h2 id="cta-h" className="h-sheet">
          Sell K7? <span className="dim">Apply.</span>
        </h2>
        <p>Tell us about your company. A K7 Channel Manager reviews the application and, once approved, your Partner Admin can invite the rest of your team.</p>
      </div>
      <div className="cta-actions">
        <Link className="btn btn-primary" href="/partners/join">
          Apply to become a partner →
        </Link>
        <Link className="link-u" href="/partners">
          About the programme
        </Link>
      </div>
    </section>
  </>
)

const PartnerHome: React.FC<{ me: PartnerContext }> = async ({ me }) => {
  const [notifications, deals, blocked, collateral, schemes, training] = await Promise.all([listNotifications({ kind: 'user', userId: me.user.id, scope: me.scope }, 3), dealCounts(me.scope), registerGate(me), collateralCountFor(me), schemeCountFor(me), trainingCountFor(me)])
  const first = me.user.name.split(' ')[0]
  const org = me.org.tradeName || me.org.name
  const todo = training.recertify + training.ready + training.inProgress
  const admin = me.roles.includes('admin')
  return (
    <>
      <section className="sheet help-hero g-panel" aria-labelledby="home-h">
        <div className="hero-meta label">
          <span>
            K7 Partners · {org} · {me.org.partnerId}
          </span>
          <span>Signed in as {me.user.email}</span>
        </div>
        <h1 id="home-h" className="h-page">
          {first ? `Hello ${first}. ` : ''}What are we selling today?
        </h1>
        <form className="help-search" action={PARTNER_COLLATERAL} method="get" role="search">
          <label className="sr-only" htmlFor="home-q">
            Search the sales material
          </label>
          <span className="control">
            <input id="home-q" name="q" type="search" placeholder="Search sales material: datasheet, brochure, presentation…" autoComplete="off" />
            <button type="submit" aria-label="Search">
              →
            </button>
          </span>
        </form>
        <div className="mine-strip">
          <Link href={`${PARTNER_DEALS}?view=approved`}>
            <span className="n">{pad(deals.approved)}</span>
            <span className="label">Deals protected</span>
          </Link>
          <Link href={`${PARTNER_DEALS}?view=infoRequested`}>
            <span className="n">{pad(deals.infoRequested)}</span>
            <span className="label">Need your answer</span>
          </Link>
          <Link href={PARTNER_SCHEMES}>
            <span className="n">{pad(schemes.open)}</span>
            <span className="label">Schemes open</span>
          </Link>
          {blocked ? (
            <Link href={PARTNER_TRAINING}>
              <span className="n">{pad(todo)}</span>
              <span className="label">Training to finish</span>
            </Link>
          ) : (
            <Link href={`${PARTNER_DEALS}/new`}>
              <span className="n">+</span>
              <span className="label">Register a deal</span>
            </Link>
          )}
        </div>
        {blocked && (
          <p className="hint" style={{ marginTop: 16 }}>
            Deal registration is not open to you: {blocked}
          </p>
        )}
      </section>

      <section className="sheet g-paper" aria-labelledby="ways-h">
        <Tab n="02/04" label="Four ways in" k={1} />
        <div className="sheet-head">
          <h2 id="ways-h" className="h-sheet">
            Register, sell, earn, <span className="dim">and certify.</span>
          </h2>
          <p className="body-l">Everything {org} does with K7. Each line says where it stands today.</p>
        </div>
        <Ways
          ways={[
            {
              icon: 'shield',
              href: PARTNER_DEALS,
              title: 'Deals',
              desc: (
                <>
                  {deals.approved + deals.submitted + deals.extensionRequested + deals.infoRequested === 0 ? 'No live deal yet. Register one and K7 protects it once approved.' : `${deals.approved} protected, ${deals.submitted + deals.extensionRequested} with K7${deals.endingSoon ? `, ${deals.endingSoon} ending soon` : ''}.`}{' '}
                  <Link className="link-u" href={PARTNER_DASHBOARD}>
                    The pipeline dashboard
                  </Link>
                </>
              ),
            },
            { icon: 'archive', href: PARTNER_COLLATERAL, title: 'Sales material', desc: collateral === 0 ? 'Nothing published for your organisation yet.' : `${plural(collateral, 'item')} of sales and brand material, always the current version.` },
            { icon: 'bars', href: PARTNER_SCHEMES, title: 'Schemes', desc: schemes.open + schemes.registered + schemes.results === 0 ? 'No scheme applies to your organisation right now.' : [schemes.open && `${schemes.open} open to register`, schemes.registered && `${schemes.registered} you are in`, schemes.results && `${plural(schemes.results, 'result')} published`].filter(Boolean).join(', ') + '.' },
            {
              icon: 'certificate',
              href: PARTNER_TRAINING,
              title: 'Training',
              desc: (
                <>
                  {training.courses === 0 ? (admin && !me.roles.some((r) => r === 'sales' || r === 'technical') ? 'Read your team’s progress.' : 'No course is published for your roles yet.') : `${plural(training.courses, 'course')} for your roles, ${training.passed} passed${todo ? `, ${todo} to finish` : ''}.`}{' '}
                  <Link className="link-u" href={PARTNER_CERTIFICATES}>
                    Certificates
                  </Link>
                </>
              ),
            },
          ]}
        />
      </section>

      <section className="sheet g-panel" aria-labelledby="news-h">
        <Tab n="03/04" label="From K7" k={0.5} />
        <div className="sheet-head">
          <h2 id="news-h" className="h-sheet">
            The latest. <span className="dim">Decisions come here first.</span>
          </h2>
          <p className="body-l">Approvals, requests for information and scheme results, also sent by email.</p>
        </div>
        <div style={{ marginTop: 'clamp(32px, 4cqw, 56px)' }}>{notifications.length ? <NotificationList rows={notifications} /> : <p className="hint">Nothing has been sent to you yet.</p>}</div>
        <div className="actions" style={{ marginTop: 28 }}>
          <Link className="link-u" href="/partners/portal/notifications">
            All notifications
          </Link>
        </div>
      </section>

      <section className="sheet g-signal cta-sheet" aria-labelledby="cta-h">
        <Tab n="04/04" label="Next deal" k={0} />
        <div className="sheet-head">
          <h2 id="cta-h" className="h-sheet">
            A deal in sight? <span className="dim">Register it.</span>
          </h2>
          <p>Register before anyone else does. K7 checks for conflicts, decides within the programme’s working hours and protects the deal for you once it is approved.</p>
        </div>
        <div className="cta-actions">
          {blocked ? (
            <Link className="btn btn-primary" href={PARTNER_DEALS}>
              Your deals →
            </Link>
          ) : (
            <Link className="btn btn-primary" href={`${PARTNER_DEALS}/new`}>
              Register a deal →
            </Link>
          )}
          <Link className="link-u" href="/partners/portal/organisation">
            {admin ? 'Your organisation and its users' : 'Your organisation'}
          </Link>
        </div>
      </section>
    </>
  )
}
