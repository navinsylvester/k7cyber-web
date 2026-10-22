/* The partner portal's status machines (02-build-plan.md decision 17), pure and tested without a tenant.

   Applications (01-requirements.md §3.2): Submitted → Under review → Approved | Rejected | Clarification needed → Submitted.
   `draft` is the portal's own pre-state while the applicant is still on the join pages; it is not in the requirements table and
   never reaches the queue. Organisations: Approved ↔ Suspended (M3 adds the pages). Every move writes one audit row and one
   notification (FR-REG-08); the writers are in registration.ts. */

export const APPLICATION_STATUSES = ['draft', 'submitted', 'underReview', 'clarification', 'approved', 'rejected'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  underReview: 'Under review',
  clarification: 'Clarification needed',
  approved: 'Approved',
  rejected: 'Rejected',
}

/** What the applicant reads under the status. */
export const APPLICATION_STATUS_HINT: Record<ApplicationStatus, string> = {
  draft: 'Not sent yet. Finish the steps to submit it.',
  submitted: 'With K7. A Channel Manager will pick it up; we email you at every step.',
  underReview: 'A Channel Manager is reviewing it. We email you when they decide.',
  clarification: 'K7 needs something from you. Read the note, edit the application and resubmit.',
  approved: 'Welcome to the programme. Your Partner Admin can sign in now.',
  rejected: 'This application was not accepted. The reason is below.',
}

const APPLICATION_NEXT: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  draft: ['submitted'],
  submitted: ['underReview'],
  underReview: ['approved', 'rejected', 'clarification'],
  clarification: ['submitted'],
  approved: [],
  rejected: [],
}

export const canMoveApplication = (from: ApplicationStatus, to: ApplicationStatus): boolean => APPLICATION_NEXT[from]?.includes(to) ?? false

/** The states a Channel Manager's queue lists by default: everything not yet decided. */
export const OPEN_APPLICATION_STATUSES: readonly ApplicationStatus[] = ['submitted', 'underReview', 'clarification']
export const isOpenApplication = (s: ApplicationStatus): boolean => OPEN_APPLICATION_STATUSES.includes(s)
export const isDecided = (s: ApplicationStatus): boolean => s === 'approved' || s === 'rejected'

/** A decision a Channel Manager can take on an application under review (FR-REG-05). */
export type Decision = 'approve' | 'reject' | 'clarify'
export const DECISION_TO: Record<Decision, ApplicationStatus> = { approve: 'approved', reject: 'rejected', clarify: 'clarification' }
export const DECISION_LABEL: Record<Decision, string> = { approve: 'Approve', reject: 'Reject', clarify: 'Send back for clarification' }
/** Rejection and clarification carry a reason the applicant reads; approval may. */
export const decisionNeedsComment = (d: Decision): boolean => d !== 'approve'

/** The steps a decision takes from the current state: deciding on a Submitted application assigns it first (Under review), so
    the trail shows both moves. Empty when the decision is not allowed from here. */
export const decisionPath = (from: ApplicationStatus, d: Decision): ApplicationStatus[] => {
  const to = DECISION_TO[d]
  if (canMoveApplication(from, to)) return [to]
  if (from === 'submitted' && canMoveApplication('underReview', to)) return ['underReview', to]
  return []
}

/* ---------- Organisations ---------- */

export const ORG_STATUSES = ['approved', 'suspended'] as const
export type OrgStatus = (typeof ORG_STATUSES)[number]
export const ORG_STATUS_LABEL: Record<OrgStatus, string> = { approved: 'Approved', suspended: 'Suspended' }

export const canMoveOrg = (from: OrgStatus, to: OrgStatus): boolean => from !== to
