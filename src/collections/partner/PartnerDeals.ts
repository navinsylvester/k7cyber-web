import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* One row per deal registration (01-requirements.md §7, 02-build-plan.md §5 and M4): what the partner filed (the end customer,
   the products and quantities, the value and the close date, the source, the competitor, the notes), the status machine's
   state (§7.2), the thread of notes and decisions with attachments, the protection window and its one extension, the conflicts
   found at submission, and the CRM ids once the opportunity job has run. Written by src/lib/partner/deals.ts and mirror.ts
   through the local API with access overridden; admins read the raw rows here. The deal's status after approval (won, lost,
   open, on hold) comes from Dynamics through the `crm.snapshot` group that sync.ts fills (M5). */

export const DEAL_STATUS_OPTIONS = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'Information requested', value: 'infoRequested' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Extension requested', value: 'extensionRequested' },
  { label: 'Expired', value: 'expired' },
  { label: 'Withdrawn', value: 'withdrawn' },
]

export const DEAL_SOURCE_OPTIONS = [
  { label: 'Own prospecting', value: 'prospecting' },
  { label: 'Customer enquiry', value: 'enquiry' },
  { label: 'Existing customer', value: 'existing' },
  { label: 'K7 referral', value: 'k7Referral' },
  { label: 'Event or campaign', value: 'event' },
  { label: 'Tender', value: 'tender' },
  { label: 'Other', value: 'other' },
]

const person = (name: string) => ({
  name,
  type: 'group' as const,
  fields: [{ type: 'row' as const, fields: [{ name: 'userId', type: 'text' as const, admin: { width: '34%' } }, { name: 'name', type: 'text' as const, admin: { width: '33%' } }, { name: 'email', type: 'text' as const, admin: { width: '33%' } }] }],
})

export const PartnerDeals: CollectionConfig = {
  slug: 'partner-deals',
  labels: { singular: 'Deal registration', plural: 'Deal registrations' },
  access: { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('admin'), update: roleAccess('admin') },
  admin: { useAsTitle: 'dealId', defaultColumns: ['dealId', 'status', 'orgPartnerId', 'customerName', 'expectedValue', 'protectionEnds', 'submittedAt'], group: 'Partner portal' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'dealId', type: 'text', unique: true, index: true, required: true, admin: { width: '25%', description: 'K7D-00001, given at submission; the registration ID of FR-DEAL-06 once approved.' } },
        { name: 'status', type: 'select', options: DEAL_STATUS_OPTIONS, required: true, defaultValue: 'submitted', index: true, admin: { width: '25%' } },
        { name: 'org', type: 'relationship', relationTo: 'partner-orgs', required: true, index: true, admin: { width: '25%' } },
        { name: 'orgPartnerId', type: 'text', index: true, admin: { width: '25%', description: 'The organisation’s K7P number, copied for the ledgers.' } },
      ],
    },
    { type: 'row', fields: [{ name: 'orgName', type: 'text', admin: { width: '50%' } }, { name: 'orgType', type: 'text', admin: { width: '50%', description: 'The partner type at submission; a Distributor names the reseller (FR-DEAL-03).' } }] },
    person('registeredBy'),
    {
      name: 'reseller',
      type: 'group',
      admin: { description: 'For a Distributor’s deal: the reseller it is for (FR-DEAL-03, appendix 14). Linked to an organisation when the name matches one; the reseller does not see the deal.' },
      fields: [{ type: 'row', fields: [{ name: 'name', type: 'text', admin: { width: '50%' } }, { name: 'orgId', type: 'text', admin: { width: '25%' } }, { name: 'orgPartnerId', type: 'text', admin: { width: '25%' } }] }],
    },
    { type: 'row', fields: [{ name: 'customerName', type: 'text', required: true, index: true, admin: { width: '50%' } }, { name: 'customerKey', type: 'text', index: true, admin: { width: '50%', description: 'The name normalised for the conflict check (lower case, no punctuation or legal suffix).' } }] },
    {
      name: 'customer',
      type: 'group',
      admin: { description: 'The end customer (FR-DEAL-02).' },
      fields: [
        { type: 'row', fields: [{ name: 'industry', type: 'text', admin: { width: '34%' } }, { name: 'city', type: 'text', admin: { width: '33%' } }, { name: 'state', type: 'text', admin: { width: '33%' } }] },
        { type: 'row', fields: [{ name: 'contactName', type: 'text', admin: { width: '50%' } }, { name: 'designation', type: 'text', admin: { width: '50%' } }] },
        { type: 'row', fields: [{ name: 'email', type: 'text', index: true, admin: { width: '34%' } }, { name: 'emailDomain', type: 'text', index: true, admin: { width: '33%', description: 'For the conflict check; blank for a public mail domain.' } }, { name: 'phone', type: 'text', admin: { width: '33%' } }] },
      ],
    },
    {
      name: 'products',
      type: 'array',
      labels: { singular: 'Product line', plural: 'Product lines' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'product', type: 'relationship', relationTo: 'partner-products', required: true, admin: { width: '40%' } },
            { name: 'sku', type: 'text', admin: { width: '30%', description: 'Copied at submission.' } },
            { name: 'quantity', type: 'number', min: 1, required: true, admin: { width: '30%' } },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'expectedValue', type: 'number', min: 0, required: true, index: true, admin: { width: '25%', description: '₹, the partner’s estimate; K7 may correct it (FR-DEAL-05, FR-DEAL-09).' } },
        { name: 'closeDate', type: 'date', required: true, admin: { width: '25%' } },
        { name: 'source', type: 'select', options: DEAL_SOURCE_OPTIONS, admin: { width: '25%' } },
        { name: 'competitor', type: 'text', admin: { width: '25%' } },
      ],
    },
    { name: 'notes', type: 'textarea', admin: { description: 'The partner’s notes at submission.' } },
    {
      name: 'thread',
      type: 'array',
      labels: { singular: 'Entry', plural: 'Thread' },
      admin: { description: 'Decisions, notes and extension requests in order, with their attachments. The audit trail carries the status moves too.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'kind', type: 'select', options: ['submitted', 'decision', 'note', 'extension', 'amendment', 'system'], required: true, admin: { width: '20%' } },
            { name: 'side', type: 'select', options: ['partner', 'k7', 'system'], required: true, admin: { width: '15%' } },
            { name: 'byName', type: 'text', admin: { width: '20%' } },
            { name: 'byEmail', type: 'text', admin: { width: '25%' } },
            { name: 'at', type: 'date', required: true, admin: { width: '20%' } },
          ],
        },
        { type: 'row', fields: [{ name: 'to', type: 'text', admin: { width: '50%', description: 'The status this entry moved the deal to, if any.' } }, { name: 'title', type: 'text', admin: { width: '50%' } }] },
        { name: 'text', type: 'textarea' },
        { name: 'files', type: 'relationship', relationTo: 'partner-deal-files', hasMany: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'submittedAt', type: 'date', index: true, admin: { width: '25%' } },
        { name: 'decidedAt', type: 'date', admin: { width: '25%' } },
        { name: 'protectionEnds', type: 'date', index: true, admin: { width: '25%', description: 'From approval, the settings’ protection days; one extension (decision 15).' } },
        { name: 'endingNoticeAt', type: 'date', admin: { width: '25%', description: 'When the protection-ending notice went out.' } },
      ],
    },
    {
      name: 'extension',
      type: 'group',
      admin: { description: 'The one extension a partner may ask for before the protection ends (FR-DEAL-07, decision 15).' },
      fields: [
        { type: 'row', fields: [{ name: 'requestedAt', type: 'date', admin: { width: '34%' } }, { name: 'requestedBy', type: 'text', admin: { width: '33%' } }, { name: 'reason', type: 'text', admin: { width: '33%' } }] },
        { type: 'row', fields: [{ name: 'decidedAt', type: 'date', admin: { width: '34%' } }, { name: 'decidedBy', type: 'text', admin: { width: '33%' } }, { name: 'granted', type: 'checkbox', admin: { width: '33%' } }] },
        { name: 'note', type: 'text' },
      ],
    },
    { name: 'conflicts', type: 'json', admin: { description: 'Possible conflicts found at submission against the portal’s own deals (FR-DEAL-04): the other deal, its organisation, what matched. Shown to the approver only; the sheet runs the check again live.' } },
    {
      name: 'crm',
      type: 'group',
      admin: { description: 'Filled by the outbox when the opportunity job runs (03-dynamics-exploration.md §7); the snapshot by the sync (§8, M5).' },
      fields: [
        { type: 'row', fields: [{ name: 'opportunityId', type: 'text', index: true, admin: { width: '40%' } }, { name: 'opportunityNo', type: 'text', index: true, admin: { width: '20%', description: 'alletec_opportunityno, OPP-YYMM-NNNNN.' } }, { name: 'customerAccountId', type: 'text', admin: { width: '20%' } }, { name: 'customerContactId', type: 'text', admin: { width: '20%' } }] },
        { name: 'noteId', type: 'text', admin: { description: 'The annotation that carries the registration; a retry does not write it twice.' } },
        {
          name: 'snapshot',
          type: 'group',
          admin: { description: 'What Dynamics says about the opportunity, read back by src/lib/partner/sync.ts on the schedule (FR-DASH-05; 03-dynamics-exploration.md §8). The dashboard reads this and nothing live; on stage or value the CRM wins (FR-DASH-11) and the difference is in the audit.' },
          fields: [
            { type: 'row', fields: [{ name: 'syncedAt', type: 'date', index: true, admin: { width: '34%', date: { pickerAppearance: 'dayAndTime' } } }, { name: 'modifiedOn', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } } }, { name: 'name', type: 'text', admin: { width: '33%', description: 'The opportunity’s topic as the CRM names it.' } }] },
            { type: 'row', fields: [{ name: 'statecode', type: 'number', index: true, admin: { width: '25%', description: '0 Open · 1 Won · 2 Lost.' } }, { name: 'statuscode', type: 'number', admin: { width: '25%', description: 'The status reason; 2 = On Hold while open.' } }, { name: 'statusLabel', type: 'text', admin: { width: '50%' } }] },
            { type: 'row', fields: [{ name: 'stage', type: 'number', admin: { width: '25%', description: 'alletec_stage, 260760000 Pre Sales … 260760005 Closure.' } }, { name: 'stageLabel', type: 'text', admin: { width: '35%' } }, { name: 'stepName', type: 'text', admin: { width: '40%', description: 'The business process flow’s step.' } }] },
            { type: 'row', fields: [{ name: 'estimatedValue', type: 'number', admin: { width: '34%' } }, { name: 'actualValue', type: 'number', admin: { width: '33%', description: 'Set on win.' } }, { name: 'invoiceAmount', type: 'number', admin: { width: '33%', description: 'alletec_nvoiceamount.' } }] },
            { type: 'row', fields: [{ name: 'estimatedCloseDate', type: 'date', admin: { width: '34%' } }, { name: 'actualCloseDate', type: 'date', index: true, admin: { width: '33%' } }, { name: 'error', type: 'text', admin: { width: '33%', description: 'Why the last read-back could not fill this row (not found, refused); blank when it could.' } }] },
          ],
        },
      ],
    },
  ],
  timestamps: true,
}
