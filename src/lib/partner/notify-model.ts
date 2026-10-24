/* The notification catalogue and the editable templates (FR-NTF-01, 02-build-plan.md M8): every event the portal sends, who
   reads it, how it is delivered by default, and the placeholders a template may use. `renderTemplate` fills a template's
   subject and body; `mailHtml` and `digestMail` shape the email. Pure; tested without a tenant. */

export type Delivery = 'immediate' | 'digest' | 'bell'
export const DELIVERIES: readonly Delivery[] = ['immediate', 'digest', 'bell']
export const DELIVERY_LABEL: Record<Delivery, string> = { immediate: 'Email at once', digest: 'In the daily digest', bell: 'Bell only' }
export const DELIVERY_HINT: Record<Delivery, string> = {
  immediate: 'the bell row and one email per recipient as the event happens',
  digest: 'the bell row at once; the email waits for the next daily digest, one message per person with everything since the last',
  bell: 'the bell row only; nothing by email',
}

export type EventGroup = 'applications' | 'organisation' | 'users' | 'deals' | 'schemes' | 'training' | 'certificates' | 'sla'
export const EVENT_GROUP_LABEL: Record<EventGroup, string> = { applications: 'Applications', organisation: 'Organisation', users: 'People', deals: 'Deals', schemes: 'Schemes', training: 'Training', certificates: 'Certificates', sla: 'Approval SLA' }
export const EVENT_GROUPS: readonly EventGroup[] = ['applications', 'organisation', 'users', 'deals', 'schemes', 'training', 'certificates', 'sla']

export type Audience = 'partner' | 'k7' | 'applicant'

export type EventDef = { key: string; group: EventGroup; label: string; audience: Audience; delivery: Delivery; vars: string[]; hint: string }

/** The placeholders every event supplies: the text the code would have sent, where it leads, who reads it. */
export const COMMON_VARS = ['subject', 'body', 'link', 'portal', 'recipient'] as const
const DEAL = ['dealId', 'customer', 'partner', 'partnerId', 'value', 'closeDate', 'protectionEnds']
const APP = ['application', 'company', 'type', 'contact']
const SCHEME = ['scheme', 'partner', 'partnerId', 'startDate', 'endDate']
const ORG = ['partner', 'partnerId']
const USER = ['partner', 'partnerId', 'user', 'roles']
const TRAINING = ['course', 'track', 'user', 'score', 'partner', 'partnerId']
const CERT = ['certificate', 'course', 'track', 'user', 'band', 'issued', 'expires', 'verifyUrl', 'partner', 'partnerId']
const ORG_CERT = ['certificate', 'issued', 'expires', 'verifyUrl', 'rule', 'reason', 'partner', 'partnerId']

const ev = (key: string, group: EventGroup, label: string, audience: Audience, delivery: Delivery, vars: string[], hint: string): EventDef => ({ key, group, label, audience, delivery, vars, hint })

/** Every event `notify()` is called with, in the order the templates page lists them. A new call site adds its event here. */
export const EVENTS: readonly EventDef[] = [
  ev('application.submitted', 'applications', 'Application submitted', 'k7', 'immediate', APP, 'To the Channel Managers when a company applies.'),
  ev('application.resubmitted', 'applications', 'Application resubmitted', 'k7', 'immediate', APP, 'To the Channel Managers when the applicant answers a clarification.'),
  ev('application.approved', 'applications', 'Application approved · the invitation', 'applicant', 'immediate', [...APP, ...ORG], 'To the primary contact, now the Partner Admin: the partner ID and the door.'),
  ev('org.legal-edit-proposed', 'organisation', 'Legal-identity edit proposed', 'k7', 'immediate', ORG, 'To the Channel Managers when a Partner Admin proposes a change to the legal name, GSTIN or PAN.'),
  ev('org.legal-edit-approved', 'organisation', 'Legal-identity edit approved', 'partner', 'immediate', ORG, 'To the Partner Admins when K7 applies the change.'),
  ev('org.legal-edit-declined', 'organisation', 'Legal-identity edit declined', 'partner', 'immediate', ORG, 'To the Partner Admins with K7’s note.'),
  ev('org.suspended', 'organisation', 'Organisation suspended', 'partner', 'immediate', ORG, 'To every user of the organisation, with the reason.'),
  ev('org.reinstated', 'organisation', 'Organisation reinstated', 'partner', 'immediate', ORG, 'To every user when the suspension is lifted.'),
  ev('user.invited', 'users', 'User invited', 'partner', 'immediate', USER, 'To the person a Partner Admin adds: the door and their roles.'),
  ev('user.roles-changed', 'users', 'Roles changed', 'partner', 'digest', USER, 'To the person whose roles a Partner Admin changed.'),
  ev('user.disabled', 'users', 'User disabled', 'partner', 'immediate', USER, 'To the person a Partner Admin disabled.'),
  ev('user.enabled', 'users', 'User re-enabled', 'partner', 'immediate', USER, 'To the person a Partner Admin re-enabled.'),
  ev('deal.submitted', 'deals', 'Deal registered', 'k7', 'immediate', DEAL, 'To the Deal Desk Approvers when a partner registers a deal.'),
  ev('deal.received', 'deals', 'Deal received · the receipt', 'partner', 'immediate', DEAL, 'To the registering user and the Partner Admins: the K7D number and what happens next.'),
  ev('deal.resubmitted', 'deals', 'Deal resubmitted', 'k7', 'immediate', DEAL, 'To the Deal Desk Approvers when the partner answers a request for information.'),
  ev('deal.approved', 'deals', 'Deal approved', 'partner', 'immediate', DEAL, 'To the partner: approved, protected until the date; with changes when K7 changed the value, the closure or the customer.'),
  ev('deal.rejected', 'deals', 'Deal not accepted', 'partner', 'immediate', DEAL, 'To the partner, with K7’s reason.'),
  ev('deal.info-requested', 'deals', 'Information requested', 'partner', 'immediate', DEAL, 'To the partner: what K7 needs before deciding.'),
  ev('deal.amended', 'deals', 'Deal amended by K7', 'partner', 'digest', DEAL, 'To the partner when K7 changes the value, the closure date or the customer after approval.'),
  ev('deal.note', 'deals', 'Note on a deal', 'partner', 'digest', DEAL, 'To the other side when a note or a file is added; the partner’s notes go to the approvers, K7’s to the partner.'),
  ev('deal.extension-requested', 'deals', 'Extension requested', 'k7', 'immediate', DEAL, 'To the Deal Desk Approvers when a partner asks for the one extension.'),
  ev('deal.extension-granted', 'deals', 'Extension granted', 'partner', 'immediate', DEAL, 'To the partner, with the new end of the protection.'),
  ev('deal.extension-declined', 'deals', 'Extension declined', 'partner', 'immediate', DEAL, 'To the partner, with K7’s reason.'),
  ev('deal.withdrawn', 'deals', 'Deal withdrawn', 'k7', 'digest', DEAL, 'To the Deal Desk Approvers when the partner withdraws a live deal.'),
  ev('deal.protection-ending', 'deals', 'Protection ending', 'partner', 'immediate', DEAL, 'To the partner and the approvers once, the configured days before the protection ends.'),
  ev('deal.expired', 'deals', 'Protection ended', 'partner', 'immediate', DEAL, 'To the partner when the sweep expires an approved deal.'),
  ev('scheme.registration.pending', 'schemes', 'Scheme registration to decide', 'k7', 'immediate', SCHEME, 'To the Scheme Admins when a partner registers for a scheme that needs approval.'),
  ev('scheme.registration.sent', 'schemes', 'Scheme registration sent', 'partner', 'immediate', SCHEME, 'To the Partner Admins: their registration waits for K7.'),
  ev('scheme.registered', 'schemes', 'Registered for a scheme', 'partner', 'immediate', SCHEME, 'To the Partner Admins when the registration is automatic.'),
  ev('scheme.registration.approved', 'schemes', 'Scheme registration approved', 'partner', 'immediate', SCHEME, 'To the Partner Admins when K7 approves the registration.'),
  ev('scheme.registration.declined', 'schemes', 'Scheme registration declined', 'partner', 'immediate', SCHEME, 'To the Partner Admins with K7’s note.'),
  ev('scheme.results.published', 'schemes', 'Scheme results published', 'partner', 'immediate', SCHEME, 'To the Partner Admins of every organisation with a result.'),
  ev('scheme.result.adjusted', 'schemes', 'Result adjusted', 'partner', 'immediate', SCHEME, 'To the Partner Admins when K7 adjusts a published result.'),
  ev('scheme.dispute.raised', 'schemes', 'Dispute raised', 'k7', 'immediate', SCHEME, 'To the Scheme Admins when a partner disputes its result.'),
  ev('scheme.dispute.resolved', 'schemes', 'Dispute answered', 'partner', 'immediate', SCHEME, 'To the Partner Admins with K7’s answer.'),
  ev('scheme.payout', 'schemes', 'Payout state changed', 'partner', 'immediate', SCHEME, 'To the Partner Admins when the payout moves to processed or paid.'),
  ev('training.course.passed', 'training', 'Training course passed', 'partner', 'immediate', TRAINING, 'To the participant and the Partner Admins when a test is passed (FR-NTF-01). When the pass earns a certificate, the certificate’s own message follows with the PDF.'),
  ev('training.bank.empty', 'training', 'Question bank empty', 'k7', 'immediate', ['course', 'track'], 'To the Training Admins when a learner completes every module of a published course whose bank has no askable question.'),
  ev('training.certificate.issued', 'certificates', 'Individual certificate issued', 'partner', 'immediate', CERT, 'To the participant, with the PDF attached, and the Partner Admins when a pass earns a certificate (FR-TRN-07, 08). Sent at once or the PDF is not carried.'),
  ev('training.certificate.expiring', 'certificates', 'Individual certificate expiring', 'partner', 'immediate', CERT, 'To the participant and the Partner Admins once per reminder day (60 and 30 by default) before an individual certificate expires; the recertification test is open (FR-TRN-10).'),
  ev('training.certificate.expired', 'certificates', 'Individual certificate expired', 'partner', 'immediate', CERT, 'To the participant and the Partner Admins when the sweep expires an individual certificate.'),
  ev('training.certificate.revoked', 'certificates', 'Individual certificate revoked', 'partner', 'immediate', CERT, 'To the participant and the Partner Admins when K7 revokes an individual certificate, with the reason.'),
  ev('org.certificate.requested', 'certificates', 'Partner certificate to issue', 'k7', 'immediate', ORG_CERT, 'To the Channel Managers when an organisation first meets the rule for its type, or meets it again after its certificate expired (FR-CRT-02, 06).'),
  ev('org.certificate.issued', 'certificates', 'Partner certificate issued', 'partner', 'immediate', ORG_CERT, 'To the Partner Admins, the primary contact first, with the PDF attached (FR-CRT-04). Sent at once or the PDF is not carried.'),
  ev('org.certificate.declined', 'certificates', 'Partner certificate declined', 'partner', 'immediate', ORG_CERT, 'To the Partner Admins with the Channel Manager’s reason when a request is declined.'),
  ev('org.certificate.expiring', 'certificates', 'Partner certificate expiring', 'partner', 'immediate', ORG_CERT, 'To the Partner Admins once per reminder day before the partner certificate expires, saying whether the organisation still meets the rule (FR-CRT-06).'),
  ev('org.certificate.expired', 'certificates', 'Partner certificate expired', 'partner', 'immediate', ORG_CERT, 'To the Partner Admins when the sweep expires the partner certificate; a renewal request goes to K7 by itself when the rule is still met.'),
  ev('org.certificate.revoked', 'certificates', 'Partner certificate revoked', 'partner', 'immediate', ORG_CERT, 'To the Partner Admins when K7 revokes the partner certificate, with the reason (FR-CRT-07).'),
  ev('sla.breached', 'sla', 'Approval SLA breached', 'k7', 'immediate', ['item', 'kind', 'partner', 'waitingSince', 'hours', 'overdueBy'], 'To the approvers of the queue and their managers when a deal or an application has waited past the target.'),
]

export const EVENT_KEYS: readonly string[] = EVENTS.map((e) => e.key)
export const eventDef = (key: string): EventDef | null => EVENTS.find((e) => e.key === key) ?? null
export const isEventKey = (v: unknown): v is string => typeof v === 'string' && EVENT_KEYS.includes(v)
export const AUDIENCE_LABEL: Record<Audience, string> = { partner: 'Partner users', k7: 'K7 staff', applicant: 'The applicant' }

/* ---------- Templates ---------- */

export type Template = { event: string; enabled: boolean; delivery: Delivery; subject: string; body: string; updatedAt: string | null; updatedBy: string }

type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
export const isDelivery = (v: unknown): v is Delivery => typeof v === 'string' && (DELIVERIES as readonly string[]).includes(v)

export const toTemplate = (x: Doc): Template => ({
  event: s(x.event),
  enabled: x.enabled !== false,
  delivery: isDelivery(x.delivery) ? x.delivery : (eventDef(s(x.event))?.delivery ?? 'immediate'),
  subject: s(x.subject),
  body: s(x.body),
  updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : null,
  updatedBy: s(x.updatedBy),
})

/** The delivery rule for an event: the template's when one exists, else the catalogue's default. */
export const deliveryFor = (event: string, t: Template | null | undefined): Delivery => (t ? t.delivery : (eventDef(event)?.delivery ?? 'immediate'))

const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g

/** `{{name}}` → the variable, case as written; an unknown one becomes nothing. Whitespace inside the braces is allowed. */
export const render = (text: string, vars: Record<string, string>): string => text.replace(PLACEHOLDER, (_, k: string) => vars[k] ?? '')

/** The placeholders a text uses. */
export const placeholdersIn = (text: string): string[] => [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))]

/** The placeholders a text uses that neither the event nor the common set supplies. */
export const unknownPlaceholders = (text: string, event: string): string[] => {
  const known = new Set<string>([...COMMON_VARS, ...(eventDef(event)?.vars ?? [])])
  return placeholdersIn(text).filter((p) => !known.has(p))
}

export type Rendered = { subject: string; body: string }

/** What goes out: the template filled in when it exists and is enabled, else the code's own subject and body. A template
    with a blank subject or body keeps the code's text for that half. */
export const renderTemplate = (t: Template | null | undefined, code: Rendered, vars: Record<string, string>): Rendered => {
  const all = { ...vars, subject: code.subject, body: code.body }
  if (!t || !t.enabled) return code
  const subject = t.subject.trim() ? render(t.subject, all).replace(/\s+/g, ' ').trim() : code.subject
  const body = t.body.trim() ? render(t.body, all).trim() : code.body
  return { subject: subject || code.subject, body: body || code.body }
}

export const validateTemplate = (t: { subject: string; body: string }, event: string): Record<string, string> => {
  const errors: Record<string, string> = {}
  if (t.subject.length > 200) errors.subject = 'Keep the subject under 200 characters.'
  if (t.body.length > 4000) errors.body = 'Keep the body under 4,000 characters.'
  const bad = [...unknownPlaceholders(t.subject, event), ...unknownPlaceholders(t.body, event)]
  if (bad.length) errors.body = `${errors.body ? `${errors.body} ` : ''}Unknown placeholder${bad.length === 1 ? '' : 's'}: ${[...new Set(bad)].map((b) => `{{${b}}}`).join(', ')}.`
  return errors
}

/** Sample values for the preview on the templates page. */
export const SAMPLE_VARS: Record<string, string> = {
  subject: '(the subject the portal would send)',
  body: '(the text the portal would send)',
  link: 'https://www.k7computing.com/partners/portal',
  portal: 'https://www.k7computing.com/partners/portal',
  recipient: 'Asha Menon',
  partner: 'Example Systems Pvt Ltd',
  partnerId: 'K7P-00042',
  dealId: 'K7D-00130',
  customer: 'Northwind Logistics',
  value: '₹12,00,000',
  closeDate: '15-02-2027',
  protectionEnds: '21-01-2027',
  application: 'K7A-00017',
  company: 'Example Systems Pvt Ltd',
  type: 'Value Added Reseller',
  contact: 'Asha Menon',
  scheme: 'Q2 Growth Accelerator',
  startDate: '01-04-2026',
  endDate: '30-06-2026',
  user: 'Ravi Kumar',
  roles: 'Sales, Technical',
  course: 'Selling K7 Endpoint Security',
  track: 'Sales',
  score: '85%',
  certificate: 'K7P-C-7KQ2MX',
  band: 'Merit',
  issued: '23-10-2026',
  expires: '23-10-2027',
  verifyUrl: 'https://www.k7computing.com/partners/verify/K7P-C-7KQ2MX',
  rule: '1 of 1 on Sales · 1 of 1 on Technical',
  reason: 'The GST registration is under review; ask again once it is confirmed.',
  item: 'K7D-00130',
  kind: 'deal',
  waitingSince: '21-10-2026 10:15',
  hours: '48',
  overdueBy: '6 h',
}

/* ---------- The variables the call sites supply ---------- */

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const dmyOf = (d: string | null | undefined): string => {
  if (!d) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d
}

export const dealVars = (d: { dealId: string; orgName: string; orgPartnerId: string; expectedValue: number; closeDate: string; protectionEnds: string | null; customer: { name: string } }): Record<string, string> => ({
  dealId: d.dealId,
  customer: d.customer.name,
  partner: d.orgName,
  partnerId: d.orgPartnerId,
  value: Number.isFinite(d.expectedValue) ? inr.format(d.expectedValue) : '',
  closeDate: dmyOf(d.closeDate),
  protectionEnds: dmyOf(d.protectionEnds),
})

export const appVars = (a: { number: string; company: { legalName: string }; contact: { name: string } }, typeLabel: string): Record<string, string> => ({ application: a.number, company: a.company.legalName, type: typeLabel, contact: a.contact.name })

export const orgVars = (o: { name: string; tradeName?: string; partnerId: string }): Record<string, string> => ({ partner: o.tradeName || o.name, partnerId: o.partnerId })

export const trainingVars = (c: { title: string; trackName: string }, u: { name: string; email: string }, score: number | null, o?: { name: string; tradeName?: string; partnerId: string }): Record<string, string> => ({ course: c.title, track: c.trackName, user: u.name || u.email, score: score === null ? '' : `${score}%`, ...(o ? orgVars(o) : {}) })

export const certVars = (c: { number: string; courseTitle: string; trackName: string; userName: string; userEmail: string; band: string; issuedAt: string | null; expiresAt: string | null; orgName: string; orgTradeName: string; orgPartnerId: string }, verifyUrl: string, extra: { rule?: string; reason?: string } = {}): Record<string, string> => ({
  certificate: c.number,
  course: c.courseTitle,
  track: c.trackName,
  user: c.userName || c.userEmail,
  band: c.band,
  issued: dmyOf(c.issuedAt),
  expires: dmyOf(c.expiresAt),
  verifyUrl,
  rule: extra.rule ?? '',
  reason: extra.reason ?? '',
  partner: c.orgTradeName || c.orgName,
  partnerId: c.orgPartnerId,
})

export const schemeVars = (sc: { name: string; startDate: string; endDate: string }, o?: { name: string; tradeName?: string; partnerId: string }): Record<string, string> => ({ scheme: sc.name, startDate: dmyOf(sc.startDate), endDate: dmyOf(sc.endDate), ...(o ? orgVars(o) : {}) })

/* ---------- The email ---------- */

const esc = (x: string): string => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The body as paragraphs, the link as a bordered button, the signature beneath: the support mails' plain style. */
export const mailHtml = (o: { body: string; link: string; linkLabel?: string; signature: string }): string => {
  const paras = o.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="font:16px/1.5 Arial,sans-serif;margin:0 0 14px">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
  const button = o.link ? `<p style="margin:22px 0"><a href="${esc(o.link)}" style="display:inline-block;padding:12px 18px;border:1px solid #0a0a09;color:#0a0a09;text-decoration:none;font:600 15px/1 Arial,sans-serif">${esc(o.linkLabel || 'Open in the partner portal')}</a></p>`
    : ''
  return `${paras}${button}<p style="font:13px/1.5 Arial,sans-serif;color:#555;margin:0">${esc(o.signature).replace(/\n/g, '<br>')}</p>`
}

export const mailText = (o: { body: string; link: string; signature: string }): string => `${o.body}${o.link ? `\n\n${o.link}` : ''}\n\n${o.signature}`

export type DigestRow = { subject: string; body: string; link: string; at: string }

/** One message per person with everything that waited for the digest, oldest first. */
export const digestMail = (rows: DigestRow[], o: { signature: string; portal: string }): { subject: string; text: string; html: string } => {
  const n = rows.length
  const subject = n === 1 ? `K7 Partner Programme: ${rows[0]!.subject}` : `K7 Partner Programme: ${n} updates`
  const text = `${rows.map((r) => `• ${r.subject}\n  ${r.body.replace(/\n+/g, ' ').trim()}${r.link ? `\n  ${r.link}` : ''}`).join('\n\n')}\n\nEverything above is on your bell as well: ${o.portal}\n\n${o.signature}`
  const html = `${rows
    .map((r) => `<p style="font:16px/1.5 Arial,sans-serif;margin:0 0 16px"><strong>${esc(r.subject)}</strong><br>${esc(r.body.replace(/\n+/g, ' ').trim())}${r.link ? `<br><a href="${esc(r.link)}" style="color:#0a0a09">Open</a>` : ''}</p>`)
    .join('')}<p style="font:13px/1.5 Arial,sans-serif;color:#555;margin:18px 0 0">Everything above is on your bell as well: <a href="${esc(o.portal)}" style="color:#555">${esc(o.portal)}</a><br>${esc(o.signature)}</p>`
  return { subject, text, html }
}
