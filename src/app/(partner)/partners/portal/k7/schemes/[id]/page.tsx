import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { Empty, Field, Flash, Pid, Strip } from '@/components/partner/Parts'
import { PayoutTag, PhaseTag, RegistrationTag, ResultTag, SlabTable } from '@/components/partner/Schemes'
import { objectAudit } from '@/lib/partner/audit'
import { K7_SCHEMES, listRegistrations, listResults, loadScheme, schemeCounts } from '@/lib/partner/schemes'
import { applicabilityText, canCompute, canPublish, disputeUntil, resultStatus, SCHEME_STATUS_LABEL, schemePhase } from '@/lib/partner/schemes-model'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings, PARTNER_TYPE_LABEL } from '@/lib/partner/settings'
import { dmy, dmyHm } from '@/lib/support/format'

import { computeAction, decideRegistrationAction, publishAction } from '../actions'

export const metadata: Metadata = { title: 'Scheme' }

type SP = { ok?: string; error?: string }

/* One scheme on the desk: its facts and slabs, the registrations with the pending ones to decide (FR-SCH-04), the results
   once computed with each organisation's standing (FR-ELG-01, 02), and in the side column the run, the publication and the
   Finance export (FR-ELG-07). Each result has its own sheet for the adjustment, the dispute and the payout. */
export default async function K7SchemePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const me = await requireK7Role(['schemeAdmin'], `${K7_SCHEMES}/${id}`)
  const sc = await loadScheme(id)
  if (!sc) notFound()
  const [regs, results, counts, settings, trail] = await Promise.all([listRegistrations(sc.id), listResults(sc.id), schemeCounts(), getPartnerSettings(), objectAudit('partner-schemes', sc.id, 20)])
  const phase = schemePhase(sc)
  const published = Boolean(sc.results.publishedAt)
  const computeBlock = canCompute(sc)
  const publishBlock = canPublish(sc)
  const pending = regs.filter((r) => r.status === 'pending')
  const regionName = (code: string) => settings.regions.find((r) => r.code === code)?.name ?? code
  const until = disputeUntil(sc, settings.schemes.disputeDays)
  return (
    <>
      <K7Nav active="schemes" roles={me.roles} counts={{ schemes: counts.pending + counts.disputes + counts.due }} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">
              <Link className="link-u" href={K7_SCHEMES}>
                Schemes
              </Link>{' '}
              · {applicabilityText(sc, (t) => PARTNER_TYPE_LABEL[t], regionName)}
            </span>
            <h1 className="h-util">{sc.name}.</h1>
            {sc.description ? <p className="lede">{sc.description}</p> : null}
          </div>
          <div className="ws-actions">
            <Link className="btn btn-line btn-sm" href={`/admin/collections/partner-schemes/${sc.id}`}>
              Edit in the admin
            </Link>
            {results.length ? (
              <a className="link-u" href={`${K7_SCHEMES}/${sc.id}/export.csv`}>
                Export for Finance (CSV)
              </a>
            ) : null}
            {sc.attachment ? (
              <a className="link-u" href={`${K7_SCHEMES}/${sc.id}/attachment`} target="_blank" rel="noopener">
                Scheme document
              </a>
            ) : null}
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <Strip
          items={[
            { label: 'State', value: sc.status === 'published' ? <PhaseTag phase={phase} /> : <span className={sc.status === 'draft' ? 'tag tag-dashed' : 'tag tag-closed'}>{SCHEME_STATUS_LABEL[sc.status]}</span> },
            { label: 'Runs', value: `${dmy(sc.startDate)} – ${dmy(sc.endDate)}` },
            { label: 'Register by', value: dmy(sc.registrationDeadline) },
            { label: 'Registered', value: `${String(regs.filter((r) => r.status === 'approved').length).padStart(2, '0')}${pending.length ? ` · ${String(pending.length).padStart(2, '0')} waiting` : ''}` },
            { label: 'Results', value: published ? `Published ${dmy(sc.results.publishedAt!)}` : sc.results.computedAt ? `Computed ${dmy(sc.results.computedAt)} · to publish` : phase === 'closed' ? 'To compute' : 'After the close' },
          ]}
        />
        <div className="phome">
          <div>
            {pending.length > 0 && (
              <div className="pending" style={{ marginBottom: 'clamp(28px, 3cqw, 40px)' }}>
                <h2>
                  <i className="pixel" aria-hidden="true" /> {pending.length} registration{pending.length === 1 ? '' : 's'} to decide
                </h2>
                <p className="hint" style={{ margin: '0 0 12px' }}>
                  This scheme asks for K7’s approval of each registration (FR-SCH-04). The partner’s admins are told either way; a decline needs a note.
                </p>
                <ol className="ntf">
                  {pending.map((r) => (
                    <li key={r.id}>
                      <span className="ntf-when">{dmy(r.acceptedAt ?? r.createdAt)}</span>
                      <div className="ntf-body">
                        <strong>
                          <Pid id={r.orgPartnerId} href={`/partners/portal/k7/partners/${r.orgPartnerId}`} /> {r.orgName}
                        </strong>
                        <p>
                          Terms accepted by {r.acceptedBy.name || r.acceptedBy.email}
                          {r.orgType ? ` · ${PARTNER_TYPE_LABEL[r.orgType]}` : ''}
                        </p>
                        <form action={decideRegistrationAction} className="form-grid" style={{ gap: 10, marginTop: 10 }}>
                          <input type="hidden" name="schemeId" value={sc.id} />
                          <input type="hidden" name="registrationId" value={r.id} />
                          <Field id={`note-${r.id}`} label="Note (required to decline)" span>
                            <input id={`note-${r.id}`} name="note" />
                          </Field>
                          <div className="form-actions span-2">
                            <button className="btn btn-primary btn-sm" type="submit" name="decision" value="approve">
                              Approve
                            </button>
                            <button className="btn btn-line btn-sm" type="submit" name="decision" value="decline">
                              Decline
                            </button>
                          </div>
                        </form>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {results.length > 0 ? (
              <div className="filed ledger" style={{ marginBottom: 'clamp(28px, 3cqw, 40px)' }}>
                <span className="ftab label">
                  Results · {results.length} organisation{results.length === 1 ? '' : 's'} · {results.filter((r) => r.eligible).length} eligible{published ? '' : ' · not yet published'}
                </span>
                <div className="table-wrap">
                  <table className="dtable sch-k7">
                    <thead>
                      <tr>
                        <th scope="col">Organisation</th>
                        <th scope="col" className="num">
                          Deals
                        </th>
                        <th scope="col" className="num">
                          Won
                        </th>
                        <th scope="col" className="num">
                          Adjustment
                        </th>
                        <th scope="col" className="num">
                          Counted
                        </th>
                        <th scope="col">Standing</th>
                        <th scope="col">Payout</th>
                        <th scope="col" className="num">
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => {
                        const slab = r.slabIndex >= 0 ? sc.slabs[r.slabIndex] : null
                        return (
                          <tr className="row" key={r.id}>
                            <td className="title">
                              <Link href={`${K7_SCHEMES}/${sc.id}/results/${r.orgPartnerId}`}>{r.orgName}</Link>
                              <div className="muted small">
                                <Pid id={r.orgPartnerId} />
                              </div>
                            </td>
                            <td className="num">{r.dealsCounted.length}</td>
                            <td className="num">₹{r.achieved.toLocaleString('en-IN')}</td>
                            <td className="num">{r.adjustment.amount ? `${r.adjustment.amount > 0 ? '+' : ''}₹${r.adjustment.amount.toLocaleString('en-IN')}` : '—'}</td>
                            <td className="num">
                              <strong>₹{r.final.toLocaleString('en-IN')}</strong>
                            </td>
                            <td className="status">
                              <ResultTag status={published ? resultStatus(r, true) : r.eligible ? 'eligible' : 'notEligible'} />
                              <div className="muted small">{slab ? `Slab ${r.slabIndex + 1} · ${slab.benefit}` : `₹${r.gap.toLocaleString('en-IN')} short`}</div>
                              {r.dispute.status === 'open' ? <div className="is-ending">Dispute open</div> : null}
                            </td>
                            <td className="status">{r.eligible && published ? <PayoutTag status={r.payout.status} /> : <span className="muted">—</span>}</td>
                            <td className="num lib-act">
                              <Link className="btn btn-line btn-sm" href={`${K7_SCHEMES}/${sc.id}/results/${r.orgPartnerId}`}>
                                Open
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="filed ledger" style={{ marginBottom: 'clamp(28px, 3cqw, 40px)' }}>
              <span className="ftab label">Registrations · {regs.length}</span>
              {regs.length === 0 ? (
                <Empty label="Registrations">{sc.status === 'published' ? 'No organisation has registered yet.' : 'Publish the scheme for partners to register.'}</Empty>
              ) : (
                <div className="table-wrap">
                  <table className="dtable sch-k7">
                    <thead>
                      <tr>
                        <th scope="col">Organisation</th>
                        <th scope="col">Type</th>
                        <th scope="col">Terms accepted</th>
                        <th scope="col">State</th>
                        <th scope="col">Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regs.map((r) => (
                        <tr className={`row${r.status === 'declined' ? ' is-off' : ''}`} key={r.id}>
                          <td className="title">
                            <Link href={`/partners/portal/k7/partners/${r.orgPartnerId}`}>{r.orgName}</Link>
                            <div className="muted small">
                              <Pid id={r.orgPartnerId} />
                            </div>
                          </td>
                          <td className="text">{r.orgType ? PARTNER_TYPE_LABEL[r.orgType] : '—'}</td>
                          <td className="num" title={r.acceptedAt ?? ''}>
                            {r.acceptedAt ? dmyHm(r.acceptedAt) : '—'}
                            <div className="muted">{r.acceptedBy.name || r.acceptedBy.email}</div>
                          </td>
                          <td className="status">
                            <RegistrationTag status={r.status} audience="k7" />
                          </td>
                          <td className="text">{r.decision.at ? `${dmy(r.decision.at)} · ${r.decision.by}${r.decision.note ? ` · ${r.decision.note}` : ''}` : sc.approvalRequired ? '—' : 'Automatic'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <h2>Slabs</h2>
            <SlabTable slabs={sc.slabs} />
            <h2 style={{ marginTop: 'clamp(28px, 3cqw, 40px)' }}>Terms and conditions</h2>
            <p className="terms-text">{sc.terms}</p>
          </div>
          <aside className="ws-side">
            <div className="decide">
              <h2>Results</h2>
              {published ? (
                <>
                  <p className="hint" style={{ margin: 0 }}>
                    Published {dmyHm(sc.results.publishedAt!)} by {sc.results.publishedBy}. Partners may dispute until {until ? dmy(until) : '—'}. Results are not recomputed; adjust one with a reason on its sheet.
                  </p>
                </>
              ) : (
                <>
                  <p className="hint" style={{ margin: '0 0 14px' }}>
                    {computeBlock ?? `Counts every approved registration's won deals inside ${dmy(sc.startDate)} – ${dmy(sc.endDate)} from the CRM read-back and sets them against the slabs. Run it again after a fresh sync; adjustments are kept.`}
                  </p>
                  <form action={computeAction} style={{ marginBottom: 18 }}>
                    <input type="hidden" name="schemeId" value={sc.id} />
                    <button className={sc.results.computedAt ? 'btn btn-line' : 'btn btn-primary'} type="submit" disabled={Boolean(computeBlock)}>
                      {sc.results.computedAt ? 'Compute again' : 'Compute the results'} →
                    </button>
                    {sc.results.computedAt ? <p className="hint" style={{ margin: '8px 0 0' }}>Last computed {dmyHm(sc.results.computedAt)} by {sc.results.computedBy}.</p> : null}
                  </form>
                  <form action={publishAction} className="form-grid" style={{ gap: 12 }}>
                    <input type="hidden" name="schemeId" value={sc.id} />
                    <label className="check span-2" style={{ fontSize: 14 }}>
                      <input type="checkbox" name="confirm" value="1" disabled={Boolean(publishBlock)} /> Publish the results to every registered organisation; each is told by email and the dispute window of {sc.disputeDays ?? settings.schemes.disputeDays} days opens.
                    </label>
                    <div className="form-actions span-2">
                      <button className="btn btn-primary" type="submit" disabled={Boolean(publishBlock)}>
                        Publish →
                      </button>
                      {publishBlock && sc.results.computedAt ? <span className="hint">{publishBlock}</span> : null}
                    </div>
                  </form>
                </>
              )}
            </div>
            <div>
              <h2>Facts</h2>
              <dl className="meta-rows">
                <dt>Registrations</dt>
                <dd className="sans">{sc.approvalRequired ? 'K7 approves each' : 'Automatic on acceptance'}</dd>
                <dt>Products</dt>
                <dd className="sans">{sc.productNames.length ? sc.productNames.join(', ') : 'Every product'}</dd>
                <dt>Dispute window</dt>
                <dd className="sans">
                  {sc.disputeDays ?? settings.schemes.disputeDays} days{sc.disputeDays === null ? ' (the setting)' : ''}
                </dd>
                <dt>Admin state</dt>
                <dd className="sans">{SCHEME_STATUS_LABEL[sc.status]}</dd>
                <dt>Changed</dt>
                <dd className="sans">{dmyHm(sc.updatedAt)}</dd>
              </dl>
            </div>
            {trail.length > 0 && (
              <div>
                <h2>Record</h2>
                <ol className="ntf">
                  {trail.map((t) => (
                    <li key={t.id}>
                      <span className="ntf-when">{dmy(t.at)}</span>
                      <div className="ntf-body">
                        <strong>{t.action.replace(/[.-]/g, ' ')}</strong>
                        <p>
                          {t.comment || ''}
                          {t.actor.name ? ` · ${t.actor.name}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  )
}
