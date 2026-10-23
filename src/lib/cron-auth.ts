import { timingSafeEqual } from 'node:crypto'

/* The scheduled routes' door (docs/partner-portal/05-staging-and-go-live.md §3): `Authorization: Bearer <CRON_SECRET>`,
   compared in constant time, refused when the secret is unset or too short to be a secret. Pure, so the partner and support
   routes and their tests share one rule. */

export const CRON_SECRET_MIN_LENGTH = 16

/** Whether the configured secret is usable at all: set, and at least 16 characters. */
export const cronSecretUsable = (secret = process.env.CRON_SECRET): boolean => typeof secret === 'string' && secret.length >= CRON_SECRET_MIN_LENGTH

/** The request carries the cron secret. Unset or short secrets open nothing; the comparison leaks nothing by timing. */
export const cronAuthorised = (req: { headers: { get(name: string): string | null } }, secret = process.env.CRON_SECRET): boolean => {
  if (!cronSecretUsable(secret)) return false
  const given = req.headers.get('authorization') ?? ''
  const expect = `Bearer ${secret}`
  const a = Buffer.from(given)
  const b = Buffer.from(expect)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
