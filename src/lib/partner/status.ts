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

/* ---------- Deals (01-requirements.md §7.2; M4) ---------- */

export const DEAL_STATUSES = ['submitted', 'infoRequested', 'approved', 'rejected', 'extensionRequested', 'expired', 'withdrawn'] as const
export type DealStatus = (typeof DEAL_STATUSES)[number]

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  submitted: 'Submitted',
  infoRequested: 'Information requested',
  approved: 'Approved',
  rejected: 'Rejected',
  extensionRequested: 'Extension requested',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
}

/** What the partner reads under the status. */
export const DEAL_STATUS_HINT: Record<DealStatus, string> = {
  submitted: 'With K7. A Deal Desk Approver will review it; we tell you when they decide.',
  infoRequested: 'K7 needs something from you. Read the note, edit the registration and resubmit.',
  approved: 'Registered and protected. The sales stage now comes from K7’s CRM.',
  rejected: 'Not accepted. The reason is in the thread.',
  extensionRequested: 'Your extension request is with K7.',
  expired: 'The protection period ended. Register the deal again if it is still live.',
  withdrawn: 'You withdrew this registration.',
}

const DEAL_NEXT: Record<DealStatus, readonly DealStatus[]> = {
  submitted: ['infoRequested', 'approved', 'rejected', 'withdrawn'],
  infoRequested: ['submitted', 'withdrawn'],
  approved: ['extensionRequested', 'expired', 'withdrawn'],
  extensionRequested: ['approved', 'expired', 'withdrawn'],
  rejected: [],
  expired: [],
  withdrawn: [],
}

export const canMoveDeal = (from: DealStatus, to: DealStatus): boolean => DEAL_NEXT[from]?.includes(to) ?? false

/** Waiting on K7: the approver's queue by default. */
export const OPEN_DEAL_STATUSES: readonly DealStatus[] = ['submitted', 'extensionRequested']
/** Live: registered or on its way, not closed; these take part in the conflict check (open or inside protection). */
export const LIVE_DEAL_STATUSES: readonly DealStatus[] = ['submitted', 'infoRequested', 'approved', 'extensionRequested']
/** Protected: approved and inside the window (an extension request keeps the protection while it waits). */
export const PROTECTED_DEAL_STATUSES: readonly DealStatus[] = ['approved', 'extensionRequested']
export const isClosedDeal = (s: DealStatus): boolean => s === 'rejected' || s === 'expired' || s === 'withdrawn'

/** The Deal Desk Approver's decisions on a submitted deal (FR-DEAL-05). "Approve with changes" is approval with the corrected
    value, close date or customer name recorded. */
export type DealDecision = 'approve' | 'approveWithChanges' | 'requestInfo' | 'reject'
export const DEAL_DECISION_TO: Record<DealDecision, DealStatus> = { approve: 'approved', approveWithChanges: 'approved', requestInfo: 'infoRequested', reject: 'rejected' }
export const DEAL_DECISION_LABEL: Record<DealDecision, string> = { approve: 'Approve', approveWithChanges: 'Approve with changes', requestInfo: 'Request more information', reject: 'Reject' }
/** A rejection and a request carry a note the partner reads; an approval with changes must say what changed. */
export const dealDecisionNeedsComment = (d: DealDecision): boolean => d !== 'approve'
/** The four decisions are taken on a submitted deal only: an extension request moves to approved too, but through the extension decision, never the approval. */
export const canDecideDeal = (from: DealStatus, d: DealDecision): boolean => from === 'submitted' && canMoveDeal(from, DEAL_DECISION_TO[d])

/* ---------- The same decision twice (B-03) ---------- */

/* Approving writes to Dynamics and can take 10 to 20 seconds; a second click on "Record the decision" then lands after the first
   has moved the record. When the record already stands where the same decision takes it, the decision is made: the action says
   so in the ok flash and changes nothing. A genuinely different decision still meets the machines' rules above. */

/** The application already stands where this decision takes it (approve on Approved, reject on Rejected, clarify on Clarification needed). */
export const isRepeatedDecision = (from: ApplicationStatus, d: Decision): boolean => from === DECISION_TO[d]
/** The deal already stands where this decision takes it; both approvals count as approval. */
export const isRepeatedDealDecision = (from: DealStatus, d: DealDecision): boolean => from === DEAL_DECISION_TO[d]
/** The extension has been decided the same way and nothing new is waiting. */
export const isRepeatedExtension = (from: DealStatus, ext: { decidedAt: string | null; granted: boolean }, grant: boolean): boolean => from !== 'extensionRequested' && Boolean(ext.decidedAt) && ext.granted === grant

const DONE: Record<Decision | DealDecision, string> = { approve: 'approved', approveWithChanges: 'approved', reject: 'rejected', clarify: 'sent back for clarification', requestInfo: 'sent back for more information' }
/** The ok flash for a repeated decision: "Already approved by Asha." */
export const alreadyLine = (d: Decision | DealDecision | 'grant' | 'decline', by = ''): string => `Already ${d === 'grant' ? 'extended' : d === 'decline' ? 'declined' : DONE[d]}${by.trim() ? ` by ${by.trim()}` : ''}.`
