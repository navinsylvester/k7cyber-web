import 'server-only'
import { cookies } from 'next/headers'

import { loadByKey } from './registration'
import type { Application } from './registration-model'

/* The join flow's cookie (02-build-plan.md M2): an httpOnly cookie scoped to /partners/join carries the draft's resume key, the
   same secret the emailed status link carries, so the step pages and "resume after a clarification" read one row. */

export const JOIN_COOKIE = 'k7-partner-join'
export const JOIN_OTP_COOKIE = 'k7-partner-join-otp'
export const JOIN_DEVCODE_COOKIE = 'k7-partner-join-devcode'
export const JOIN_PATH = '/partners/join'

/** The application the visitor's cookie points at, whatever its state; null without a cookie or a row. */
export const currentDraft = async (): Promise<Application | null> => {
  const jar = await cookies()
  return loadByKey(jar.get(JOIN_COOKIE)?.value)
}
