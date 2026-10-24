import 'server-only'
import { isDeployed } from '@/lib/env'

/* Mobile one-time codes (FR-REG-03) behind an adapter (02-build-plan.md decision 4): email codes exist from day one; SMS is sent
   only when a gateway is configured through PARTNER_SMS_PROVIDER. Until then the join step records the mobile as given and
   marks its verification `skipped`, which the application sheet shows the Channel Manager. Adding a gateway is one case here. */

export type SmsResult = { sent: true; provider: string } | { sent: false; reason: 'no-provider' | 'error'; detail?: string }

export const smsProvider = (): string => (process.env.PARTNER_SMS_PROVIDER ?? '').trim().toLowerCase()
export const smsConfigured = (): boolean => smsProvider() !== '' && smsProvider() !== 'none'

export const sendSms = async (to: string, text: string): Promise<SmsResult> => {
  const p = smsProvider()
  switch (p) {
    case '':
    case 'none':
      return { sent: false, reason: 'no-provider' }
    case 'console':
      // Development only: the code lands in the server log, like mail without SMTP_URL.
      if (!isDeployed()) console.log(`[partner sms → ${to}] ${text}`)
      return { sent: true, provider: 'console' }
    default:
      return { sent: false, reason: 'error', detail: `Unknown SMS provider "${p}"` }
  }
}

export const smsCodeText = (code: string): string => `${code} is your K7 Partner Programme code. It is valid for 10 minutes.`
