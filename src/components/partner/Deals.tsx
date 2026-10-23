import React from 'react'

import { Pid } from '@/components/partner/Parts'
import { approvedAt, CONFLICT_MATCH_LABEL, daysLeft, dealSourceLabel, formatInr, protectionShare, type Conflict, type Deal } from '@/lib/partner/deals-model'
import { DEAL_STATUS_LABEL, type DealStatus } from '@/lib/partner/status'
import { bytes, dmy, dmyHm, initials, relative } from '@/lib/support/format'

/* Section 10 · Partners, the deal parts (design-system/components/PartnerParts/README.md P13–P16): the deal ID on P1's shape, the
   deal state as one tag, the deal read back as filed facts, the conflicts box for the approver, the protection line, and the
   thread on section 09's message rows. The registration form (P14) is DealForm.client.tsx: it keeps what was typed when the
   server refuses it. */

/** The deal number, K7D-00001, in the P1 shape. */
export const Did: React.FC<{ id: string; href?: string; display?: boolean }> = ({ id, href, display }) => <Pid id={id || 'K7D-—'} href={href} display={display} />

/** P13 Deal state: signal where someone must act now (K7: Submitted, Extension requested; the partner: Information requested),
    Approved solid, the three closed states dimmed. */
export const DealStateTag: React.FC<{ status: DealStatus; audience?: 'partner' | 'k7' }> = ({ status, audience = 'k7' }) => {
  const signal = audience === 'k7' ? status === 'submitted' || status === 'extensionRequested' : status === 'infoRequested'
  const closed = status === 'rejected' || status === 'expired' || status === 'withdrawn'
  const cls = signal ? 'tag tag-signal' : status === 'approved' ? 'tag tag-solid' : closed ? 'tag tag-closed' : 'tag tag-state'
  return <span className={cls}>{DEAL_STATUS_LABEL[status]}</span>
}

/* ---------- The deal as filed facts (P9's shape) ---------- */

const Row: React.FC<{ k: string; v: React.ReactNode; sans?: boolean }> = ({ k, v, sans = true }) => (
  <>
    <dt>{k}</dt>
    <dd className={sans ? 'sans' : undefined}>{v || '—'}</dd>
  </>
)

export const DealFacts: React.FC<{ deal: Deal; k7?: boolean }> = ({ deal, k7 }) => {
  const c = deal.customer
  return (
    <div className="app-summary">
      <div>
        <h2 className="sub-head">End customer</h2>
        <dl className="meta-rows label">
          <Row k="Customer" v={c.name} />
          <Row k="Industry" v={c.industry} />
          <Row k="Where" v={[c.city, c.state].filter(Boolean).join(', ')} />
          <Row k="Contact" v={c.contactName ? `${c.contactName}${c.designation ? `, ${c.designation}` : ''}` : ''} />
          <Row k="Email" v={c.email} sans={false} />
          <Row k="Phone" v={c.phone} sans={false} />
          {deal.reseller.name && <Row k="Reseller" v={deal.reseller.orgPartnerId ? <>{deal.reseller.name} <Pid id={deal.reseller.orgPartnerId} /></> : deal.reseller.name} />}
        </dl>
      </div>
      <div>
        <h2 className="sub-head">The deal</h2>
        <dl className="meta-rows label">
          <Row
            k="Products"
            v={
              deal.products.length ? (
                <ul className="lines">
                  {deal.products.map((l, i) => (
                    <li key={i}>
                      {l.name} <span className="muted">{l.sku}</span> × <strong>{l.quantity}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                ''
              )
            }
          />
          <Row k="Expected value" v={formatInr(deal.expectedValue)} sans={false} />
          <Row k="Expected closure" v={deal.closeDate ? dmy(deal.closeDate) : ''} sans={false} />
          <Row k="Source" v={dealSourceLabel(deal.source)} />
          <Row k="Competitor" v={deal.competitor} />
          <Row k="Registered" v={deal.submittedAt ? `${dmy(deal.submittedAt)} by ${deal.registeredBy.name || deal.registeredBy.email}` : ''} />
          {k7 && <Row k="Organisation" v={<><Pid id={deal.orgPartnerId} href={`/partners/portal/k7/partners/${deal.orgPartnerId}`} /> {deal.orgName}</>} />}
          {deal.crm.opportunityNo && <Row k="CRM opportunity" v={deal.crm.opportunityNo} sans={false} />}
        </dl>
      </div>
    </div>
  )
}

/* ---------- P15 The conflicts box (the approver only, FR-DEAL-04) ---------- */

export const ConflictBox: React.FC<{ conflicts: Conflict[]; stored?: number }> = ({ conflicts, stored }) => (
  <div className={`pending conflicts${conflicts.length ? '' : ' is-clear'}`}>
    <h2>
      {conflicts.length ? <i className="pixel" aria-hidden="true" /> : null} {conflicts.length ? `${conflicts.length} possible conflict${conflicts.length === 1 ? '' : 's'}` : 'No conflict among portal deals'}
    </h2>
    <p className="hint" style={{ margin: 0 }}>
      {conflicts.length ? 'Live registrations by other partners for what looks like the same end customer. The partner is not told who holds them.' : 'No other live registration shares this customer’s name, work domain or contact email.'}
      {typeof stored === 'number' && stored !== conflicts.length ? ` At submission: ${stored}.` : ''} The CRM-side check is a later switch.
    </p>
    {conflicts.length > 0 && (
      <ol className="ntf" style={{ marginTop: 12 }}>
        {conflicts.map((c) => (
          <li key={c.rowId}>
            <span className="ntf-when">
              <Did id={c.dealId} href={`/partners/portal/k7/deals/${c.dealId}`} />
            </span>
            <div className="ntf-body">
              <strong>
                {c.customerName} · <Pid id={c.orgPartnerId} /> {c.orgName}
              </strong>
              <p>
                <DealStateTag status={c.status} /> {c.protectionEnds ? `protected to ${dmy(c.protectionEnds)} · ` : ''}
                {c.matchedOn.map((m) => CONFLICT_MATCH_LABEL[m]).join(', ')}
              </p>
            </div>
          </li>
        ))}
      </ol>
    )}
  </div>
)

/* ---------- P16 The protection line ---------- */

export const Protection: React.FC<{ deal: Deal }> = ({ deal }) => {
  const from = approvedAt(deal)
  const share = protectionShare(from, deal.protectionEnds)
  const left = daysLeft(deal.protectionEnds)
  if (share === null || left === null) return null
  const over = left <= 0 || deal.status === 'expired'
  return (
    <div className="protect" aria-label="Deal protection">
      <div className="protect-bar" role="img" aria-label={over ? 'Protection ended' : `${Math.round(share * 100)}% of the protection period used`}>
        <i style={{ width: `${Math.round(share * 100)}%` }} className={over ? 'is-over' : left <= 14 ? 'is-ending' : undefined} />
      </div>
      <div className="protect-line">
        <span className="label">
          Protected from {from ? dmy(from) : '—'} to <strong>{deal.protectionEnds ? dmy(deal.protectionEnds) : '—'}</strong>
          {deal.extension.granted ? ' · extended once' : ''}
        </span>
        <span className={`label${over ? '' : left <= 14 ? ' is-ending' : ''}`}>{over ? (deal.status === 'withdrawn' ? 'released' : 'ended') : `${left} day${left === 1 ? '' : 's'} left`}</span>
      </div>
    </div>
  )
}

/* ---------- The thread, on section 09's message rows ---------- */

export const DealThread: React.FC<{ deal: Deal; fileHref: (fileId: string) => string; you: 'partner' | 'k7' }> = ({ deal, fileHref, you }) => (
  <div className="dthread">
    {deal.thread.map((t, i) => {
      const name = t.side === 'system' ? 'Portal' : t.byName || t.byEmail || (t.side === 'k7' ? 'K7' : deal.orgName)
      return (
        <article className={`msg${t.side === you ? ' is-you' : ''}${t.side === 'system' ? ' is-system' : ''}`} key={i}>
          <span className="avatar" aria-hidden="true">
            {t.side === 'system' ? '·' : initials(name)}
          </span>
          <div className="msg-head">
            <span className="name">
              {name}
              {t.side === 'k7' && t.byName ? <span className="muted"> · K7</span> : null}
              {t.title ? <span className="msg-title"> · {t.title}</span> : null}
              {t.to ? (
                <>
                  {' '}
                  <DealStateTag status={t.to} audience={you} />
                </>
              ) : null}
            </span>
            <span className="when" title={dmyHm(t.at)}>
              {relative(t.at)}
            </span>
          </div>
          {t.text && (
            <div className="msg-body">
              {t.text.split(/\n{2,}|\n/).map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          )}
          {t.files.length > 0 && (
            <div className="msg-att">
              {t.files.map((f) => (
                <a className="tag" href={fileHref(f.id)} key={f.id}>
                  {f.name} <span className="muted">{bytes(f.size)}</span>
                </a>
              ))}
            </div>
          )}
        </article>
      )
    })}
  </div>
)
