import 'server-only'
import { isDeployed } from '@/lib/env'

/* Outbound mail for the portal: one-time codes and case notifications. SMTP when SMTP_URL is set; the console otherwise
   (development). Bodies never include case content beyond the number and title.

   SUPPORT_MAIL_ALLOWLIST (11-staging-readiness.md item 11): on a shared test host UAT holds real customers' addresses from the
   seed, so when the list is set the portal writes only to the addresses and domains on it and logs everything else as
   suppressed. The one-time-code steps use the same list to decide who may ask for a code at all. Unset = no restriction. */

export type MailAttachment = { filename: string; content: Buffer; contentType: string }
export type Mail = { to: string; subject: string; text: string; html?: string; /** Overrides SUPPORT_MAIL_FROM (the partner portal writes as its own sender). */ from?: string; /** Files carried with the message (M11: the certificate PDF). */ attachments?: MailAttachment[] }
export type SendResult = { sent: boolean; suppressed?: string[] }

export const mailConfigured = (): boolean => Boolean(process.env.SMTP_URL)

/** The allowlist as entries: `name@domain` (one address) or `@domain` / `domain` (every address there); null when unset. */
export const mailAllowlist = (raw = process.env.SUPPORT_MAIL_ALLOWLIST): string[] | null => {
  const items = (raw ?? '')
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .map((x) => (x.includes('@') ? x : `@${x}`))
  return items.length ? items : null
}

/** Whether the portal may write to this address under the allowlist. Accepts `Name <x@y>` as well as bare addresses. */
export const mailAllowed = (address: string, allow: string[] | null = mailAllowlist()): boolean => {
  if (!allow) return true
  const a = (address.match(/<([^>]+)>\s*$/)?.[1] ?? address).trim().toLowerCase()
  const at = a.lastIndexOf('@')
  if (at < 1) return false
  const domain = a.slice(at)
  return allow.some((e) => (e.startsWith('@') ? e === domain : e === a))
}

export const sendMail = async (m: Mail): Promise<SendResult> => {
  const from = m.from || process.env.SUPPORT_MAIL_FROM || 'K7 Support <support@k7computing.com>'
  const recipients = m.to.split(',').map((x) => x.trim()).filter(Boolean)
  const allow = mailAllowlist()
  const suppressed = recipients.filter((r) => !mailAllowed(r, allow))
  const to = recipients.filter((r) => mailAllowed(r, allow)).join(', ')
  const extra = suppressed.length ? { suppressed } : {}
  if (suppressed.length) {
    // Addresses only outside production; the body never.
    console.log(`[support mail] suppressed by SUPPORT_MAIL_ALLOWLIST: ${!isDeployed() ? suppressed.join(', ') : `${suppressed.length} recipient(s)`} · ${m.subject}`)
  }
  if (!to) return { sent: false, ...extra }
  if (!process.env.SMTP_URL) {
    if (!isDeployed()) console.log(`[support mail → ${to}] ${m.subject}${m.attachments?.length ? ` (+${m.attachments.map((a) => a.filename).join(', ')})` : ''}\n${m.text}`)
    return { sent: false, ...extra }
  }
  const { createTransport } = await import('nodemailer')
  const t = createTransport(process.env.SMTP_URL)
  await t.sendMail({ from, to, subject: m.subject, text: m.text, html: m.html, attachments: m.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) })
  return { sent: true, ...extra }
}

export const otpMail = (code: string, purpose: 'sign-in' | 'register'): Omit<Mail, 'to'> => ({
  subject: `${code} is your K7 Support code`,
  text: `Your one-time code is ${code}. It is valid for 10 minutes.\n\nUse it to ${purpose === 'register' ? 'finish creating' : 'sign in to'} your K7 Support account. If you did not ask for this, ignore this email.\n\nK7 Computing`,
  html: `<p style="font:16px/1.5 Arial,sans-serif">Your one-time code is</p><p style="font:600 32px/1 'Courier New',monospace;letter-spacing:.2em">${code}</p><p style="font:14px/1.5 Arial,sans-serif;color:#555">Valid for 10 minutes. Use it to ${purpose === 'register' ? 'finish creating' : 'sign in to'} your K7 Support account. If you did not ask for this, ignore this email.</p>`,
})

export const caseCreatedMail = (ticket: string, title: string, url: string): Omit<Mail, 'to'> => ({
  subject: `Case ${ticket} received: ${title}`,
  text: `We have received your case ${ticket} "${title}". A support engineer will pick it up shortly.\n\nFollow it here: ${url}\n\nK7 Support`,
})

/* ---------- Customer satisfaction (09-portal-guide.md §4d) ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The survey invitation: one question, five answers, each a link that lands on the survey with the score pre-selected. */
export const csatInviteMail = (ticket: string, title: string, url: string, o: { reminder?: boolean } = {}): Omit<Mail, 'to'> => {
  const scores = [1, 2, 3, 4, 5]
  const links = scores.map((n) => `${url}${url.includes('?') ? '&' : '?'}score=${n}`)
  return {
    subject: o.reminder ? `A quick word on case ${ticket}?` : `How did we do on case ${ticket}?`,
    text: `${o.reminder ? 'We asked a few days ago and would still like to know: how' : 'Your case'} ${ticket} "${title}" ${o.reminder ? 'did we do?' : 'is closed. How did we do?'}\n\nRate us from 1 (very unhappy) to 5 (very happy):\n${scores.map((n, i) => `  ${n}  ${links[i]}`).join('\n')}\n\nIt takes ten seconds and a manager reads every low score.\n\nK7 Support`,
    html: `<p style="font:16px/1.5 Arial,sans-serif">${o.reminder ? 'We asked a few days ago and would still like to know how we did on' : 'Your case'} <strong>${esc(ticket)}</strong> &ldquo;${esc(title)}&rdquo;${o.reminder ? '.' : ' is closed. How did we do?'}</p><p style="font:14px/1.5 Arial,sans-serif;color:#555">1 is very unhappy, 5 is very happy.</p><p>${scores.map((n, i) => `<a href="${links[i]}" style="display:inline-block;margin:0 6px 6px 0;padding:12px 18px;border:1px solid #0a0a09;color:#0a0a09;text-decoration:none;font:600 18px/1 'Courier New',monospace">${n}</a>`).join('')}</p><p style="font:13px/1.5 Arial,sans-serif;color:#555">It takes ten seconds and a manager reads every low score.<br>K7 Support</p>`,
  }
}

/** To the managers when a low score arrives. */
export const csatLowScoreMail = (p: { ticket: string; title: string; score: number; comment: string; customer: string; owner: string; product?: string; reason?: string; url: string }): Omit<Mail, 'to'> => ({
  subject: `[CSAT ${p.score}/5] ${p.ticket}: ${p.customer || 'a customer'} needs a call back`,
  text: `${p.customer || 'A customer'} rated case ${p.ticket} "${p.title}" ${p.score}/5.${p.comment ? `\n\n"${p.comment}"` : ''}${p.reason ? `\n\nThey say it was about: ${p.reason.toLowerCase()}.` : ''}\n\nHandled by ${p.owner || 'unassigned'}${p.product ? ` · ${p.product}` : ''}. Follow up from the manager view:\n${p.url}\n\nK7 Support portal`,
})

/** To the managers when an unhappy customer has waited past the follow-up target. */
export const csatOverdueMail = (rows: { ticket: string; customer: string; score: number; waited: string }[], url: string): Omit<Mail, 'to'> => ({
  subject: `[CSAT] ${rows.length} unhappy ${rows.length === 1 ? 'customer is' : 'customers are'} past the follow-up target`,
  text: `${rows.map((r) => `${r.ticket}  ${r.customer || 'customer'}  ${r.score}/5  waiting ${r.waited}`).join('\n')}\n\nFollow up from the manager view:\n${url}\n\nK7 Support portal`,
})

/* ---------- Product desk (10-product-desk.md §9): number, title, state and the link; never the hand-off. ---------- */

export const productRaisedMail = (p: { number: string; title: string; kind: string; ticket: string; by: string; url: string }): Omit<Mail, 'to'> => ({
  subject: `[${p.number}] New ${p.kind} from support: ${p.title}`,
  text: `${p.by || 'An agent'} raised ${p.number} "${p.title}" (${p.kind}) from case ${p.ticket}. It is waiting for triage.\n\nOpen it on the product desk:\n${p.url}\n\nK7 Support portal`,
})

export const productAcceptedMail = (p: { number: string; title: string; team: string; priority: string; by: string; trackerKey: string; url: string }): Omit<Mail, 'to'> => ({
  subject: `[${p.number}] Accepted for ${p.team} at ${p.priority}: ${p.title}`,
  text: `${p.by || 'Principal support'} accepted ${p.number} "${p.title}" for ${p.team} at ${p.priority}${p.trackerKey ? ` (tracker ${p.trackerKey})` : ''}.\n\n${p.url}\n\nK7 Support portal`,
})

export const productChangeMail = (p: { number: string; title: string; what: string; by: string; detail: string; url: string }): Omit<Mail, 'to'> => ({
  subject: `[${p.number}] ${p.what}: ${p.title}`,
  text: `${p.number} "${p.title}" ${p.what.toLowerCase()}${p.by ? ` (${p.by})` : ''}.${p.detail ? `\n\n${p.detail}` : ''}\n\n${p.url}\n\nK7 Support portal`,
})
