import { STATE, STATUS } from './options'

/* Customer-facing status (01-requirements.md §5.3): the ten Dynamics status reasons collapse to four states a customer can act on,
   and merged or cancelled cases are never shown. Agents keep the full status reason. */

export type CustomerState = 'received' | 'in-progress' | 'waiting' | 'closed' | 'hidden'

export const customerState = (statuscode: number | null | undefined, statecode?: number | null): CustomerState => {
  switch (statuscode) {
    case STATUS.OPEN:
    case STATUS.REASSIGNED:
      return 'received'
    case STATUS.IN_PROGRESS_SUPPORT:
    case STATUS.IN_PROGRESS_LAB:
    case STATUS.IN_PROGRESS_PRINCIPLE:
      return 'in-progress'
    case STATUS.IN_PROGRESS_CUSTOMER:
      return 'waiting'
    case STATUS.CLOSED_CALL:
    case STATUS.CLOSED_REMOTE:
      return 'closed'
    case STATUS.CANCELED:
    case STATUS.MERGED:
      return 'hidden'
  }
  if (statecode === STATE.RESOLVED) return 'closed'
  if (statecode === STATE.CANCELED) return 'hidden'
  return 'received'
}

export const CUSTOMER_STATE_LABEL: Record<CustomerState, string> = {
  received: 'Received',
  'in-progress': 'Being worked on',
  waiting: 'Waiting for you',
  closed: 'Closed',
  hidden: 'Closed',
}

/** What the customer should expect next, in one sentence. */
export const CUSTOMER_STATE_HINT: Record<CustomerState, string> = {
  received: 'We have your case. A support engineer will pick it up shortly.',
  'in-progress': 'A support engineer is working on it. We will update you here and by email.',
  waiting: 'We need something from you. Reply below so we can continue.',
  closed: 'This case is closed. Reply within 14 days to reopen it.',
  hidden: 'This case is closed.',
}

/** The four steps of the customer's progress track; `waiting` sits between in-progress and closed. */
export const TRACK: { key: CustomerState; label: string }[] = [
  { key: 'received', label: 'Received' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'waiting', label: 'Your turn' },
  { key: 'closed', label: 'Closed' },
]

export const trackIndex = (s: CustomerState): number => (s === 'hidden' ? 3 : TRACK.findIndex((t) => t.key === s))

/** Days a customer may reopen a closed case from the portal. */
export const REOPEN_WINDOW_DAYS = 14

export const canReopen = (statecode: number | null | undefined, modifiedon: string | null | undefined): boolean => {
  if (statecode !== STATE.RESOLVED || !modifiedon) return false
  return Date.now() - new Date(modifiedon).getTime() <= REOPEN_WINDOW_DAYS * 864e5
}

/** Visible to customers: active and resolved, never cancelled or merged. OData fragment on incident. */
export const CUSTOMER_VISIBLE_FILTER = `(statecode eq ${STATE.ACTIVE} or statecode eq ${STATE.RESOLVED})`
