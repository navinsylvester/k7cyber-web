/* Option sets of the case tables, as discovered in UAT on 2026-10-13 (docs/support-portal/03-metadata-summary.md).
   Phase 1 makes no schema changes, so these are constants; relabel here if the CRM admin relabels them. */

export type Option = { value: number; label: string }

export const STATE = { ACTIVE: 0, RESOLVED: 1, CANCELED: 2 } as const

export const STATUS = {
  OPEN: 696720000,
  REASSIGNED: 696720003,
  IN_PROGRESS_SUPPORT: 696720001,
  IN_PROGRESS_CUSTOMER: 2,
  IN_PROGRESS_PRINCIPLE: 1,
  IN_PROGRESS_LAB: 696720002,
  CLOSED_CALL: 5,
  CLOSED_REMOTE: 1000,
  CANCELED: 6,
  MERGED: 2000,
} as const

export const STATUS_REASONS: (Option & { state: 0 | 1 | 2 })[] = [
  { value: STATUS.OPEN, label: 'Open', state: 0 },
  { value: STATUS.REASSIGNED, label: 'Reassigned', state: 0 },
  { value: STATUS.IN_PROGRESS_SUPPORT, label: 'In Progress-Support', state: 0 },
  { value: STATUS.IN_PROGRESS_CUSTOMER, label: 'In Progress-Customer', state: 0 },
  { value: STATUS.IN_PROGRESS_PRINCIPLE, label: 'In Progress-Principle Support', state: 0 },
  { value: STATUS.IN_PROGRESS_LAB, label: 'In Progress-Lab', state: 0 },
  { value: STATUS.CLOSED_CALL, label: 'Closed-Call', state: 1 },
  { value: STATUS.CLOSED_REMOTE, label: 'Closed-Remote', state: 1 },
  { value: STATUS.CANCELED, label: 'Canceled', state: 2 },
  { value: STATUS.MERGED, label: 'Merged', state: 2 },
]
export const ACTIVE_STATUS_REASONS = STATUS_REASONS.filter((s) => s.state === 0)

export const ORIGIN: Option[] = [
  { value: 1, label: 'Phone' },
  { value: 2, label: 'Email' },
  { value: 3, label: 'Web' },
  { value: 696720000, label: 'Chat' },
  { value: 100000000, label: 'Mobile App' },
  { value: 2483, label: 'Facebook' },
  { value: 3986, label: 'Twitter' },
  { value: 700610000, label: 'IoT' },
]
export const ORIGIN_WEB = 3

export const PRIORITY: Option[] = [
  { value: 696720000, label: 'Critical' },
  { value: 1, label: 'High' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Low' },
]
export const PRIORITY_CRITICAL = 696720000

export const CASE_TYPE: Option[] = [
  { value: 1, label: 'Case' },
  { value: 3, label: 'Service Request' },
]

export const VERTICAL: Option[] = [
  { value: 100000000, label: 'Consumer' },
  { value: 100000001, label: 'Business Security' },
  { value: 100000002, label: 'Enterprise' },
  { value: 767340001, label: 'Pro32' },
]
export const VERTICAL_CONSUMER = 100000000
export const VERTICAL_ENTERPRISE = 100000002

export const CUSTOMER_TYPE: Option[] = [
  { value: 100000001, label: 'Existing Customer' },
  { value: 696720005, label: 'New Customer' },
  { value: 100000000, label: 'Potential Customer' },
  { value: 696720002, label: 'Dealer/Reseller' },
  { value: 100000002, label: 'Partner' },
  { value: 696720007, label: 'Large Enterprise (500+)' },
  { value: 696720010, label: 'Managed Security Services' },
  { value: 696720000, label: 'Enterprise Sales Team' },
  { value: 696720003, label: 'Consumer Sales Team' },
  { value: 696720001, label: 'Compuage Sales team' },
  { value: 696720006, label: 'Pro32 Team' },
  { value: 696720004, label: 'Virus Hunter' },
  { value: 696720009, label: 'Malware Fox' },
  { value: 696720008, label: 'Special campaign-HDFC' },
]

export const CONSIDERED_AS: Option[] = [
  { value: 696720000, label: 'FCR' },
  { value: 696720001, label: 'Non-FCR' },
]

export const CATEGORY: Option[] = [
  { value: 100000000, label: 'Issue' },
  { value: 100000001, label: 'Query' },
]

export const RFE_STATUS: Option[] = [
  { value: 696720001, label: 'Open' },
  { value: 696720002, label: 'In-Progress - Accepted' },
  { value: 696720003, label: 'Closed – Rejected' },
  { value: 696720004, label: 'Closed' },
  { value: 696720000, label: 'Status for Principle Support' },
]
export const RFE_TYPE: Option[] = [
  { value: 100000000, label: 'Support RFE' },
  { value: 100000001, label: 'Customer RFE' },
  { value: 100000002, label: 'Pre Sales' },
]

export const SLA_STATUS: Option[] = [
  { value: 1, label: 'In progress' },
  { value: 2, label: 'Nearing non-compliance' },
  { value: 3, label: 'Succeeded' },
  { value: 4, label: 'Non-compliant' },
]

export const ACCOUNT_TYPE: Option[] = [
  { value: 0, label: 'Partner' },
  { value: 1, label: 'Customer' },
  { value: 2, label: 'Distributor' },
  { value: 3, label: 'To be decided' },
  { value: 4, label: 'MSP' },
]

export const label = (set: Option[], value: number | null | undefined): string => set.find((o) => o.value === value)?.label ?? ''
