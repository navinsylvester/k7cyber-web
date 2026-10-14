import 'server-only'

/* Outbound mail for the portal: one-time codes and case notifications. SMTP when SMTP_URL is set; the console otherwise
   (development). Bodies never include case content beyond the number and title. */

export type Mail = { to: string; subject: string; text: string; html?: string }

export const mailConfigured = (): boolean => Boolean(process.env.SMTP_URL)

export const sendMail = async (m: Mail): Promise<{ sent: boolean }> => {
  const from = process.env.SUPPORT_MAIL_FROM || 'K7 Support <support@k7computing.com>'
  if (!process.env.SMTP_URL) {
    if (process.env.NODE_ENV !== 'production') console.log(`[support mail → ${m.to}] ${m.subject}\n${m.text}`)
    return { sent: false }
  }
  const { createTransport } = await import('nodemailer')
  const t = createTransport(process.env.SMTP_URL)
  await t.sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: m.html })
  return { sent: true }
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
