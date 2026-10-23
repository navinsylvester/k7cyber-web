import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* The CRM writes the portal owes Dynamics (02-build-plan.md decision 2): one row per job, queued by the approval or the deal
   decision, run by the drain (`POST /api/partners/outbox`, the Run button on the K7 side) as the service identity. A job runs
   only when `partner-settings.crm.enabled` is on; the production guard turns a run into `skipped`; a failed run keeps its error
   code and is retried. `result` holds the ids the CRM gave back. Written by src/lib/partner/mirror.ts only. */
export const PartnerOutbox: CollectionConfig = {
  slug: 'partner-outbox',
  labels: { singular: 'CRM job', plural: 'CRM outbox' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'kind', defaultColumns: ['kind', 'objectLabel', 'state', 'attempts', 'lastError', 'updatedAt'], group: 'Partner portal' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'kind', type: 'select', options: [{ label: 'Account + contact (approval)', value: 'account.create' }, { label: 'Opportunity (deal approval)', value: 'opportunity.create' }], required: true, index: true, admin: { width: '30%' } },
        { name: 'state', type: 'select', options: ['pending', 'done', 'failed', 'skipped'], required: true, defaultValue: 'pending', index: true, admin: { width: '20%' } },
        { name: 'attempts', type: 'number', defaultValue: 0, admin: { width: '15%' } },
        { name: 'orgId', type: 'text', index: true, admin: { width: '35%' } },
      ],
    },
    { type: 'row', fields: [{ name: 'object', type: 'text', admin: { width: '30%', description: 'partner-orgs, partner-deals …' } }, { name: 'objectId', type: 'text', index: true, admin: { width: '35%' } }, { name: 'objectLabel', type: 'text', admin: { width: '35%' } }] },
    { name: 'payload', type: 'json', admin: { description: 'What the job needs beyond the object itself (the approver, the settings at the time).' } },
    { name: 'result', type: 'json', admin: { description: 'The ids the CRM gave back.' } },
    { type: 'row', fields: [{ name: 'actor', type: 'text', admin: { width: '34%', description: 'Who queued it.' } }, { name: 'lastError', type: 'text', admin: { width: '33%', description: 'The error code and message, never a request body.' } }, { name: 'doneAt', type: 'date', admin: { width: '33%' } }] },
  ],
  timestamps: true,
}
