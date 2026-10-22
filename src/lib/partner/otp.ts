import 'server-only'

/* The partner door's one-time code: the support portal's signed-code primitives (src/lib/support/otp.ts) with the partner's own
   purpose and cookie, so a code issued at one door never opens the other (decision 3). Mobile OTP (FR-REG-03) arrives in M2
   behind the SMS adapter. */

export { OTP_TTL_SECONDS, canSend, isEmail, issueOtp, normaliseEmail, verifyOtp, type OtpPayload, type OtpResult } from '@/lib/support/otp'

export const PARTNER_OTP_COOKIE = 'k7-partner-otp'
export const PARTNER_DEVCODE_COOKIE = 'k7-partner-devcode'
export const PARTNER_OTP_PURPOSE = 'partner-sign-in' as const
