import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* What the prevention workflow did (or would have done): one row per case per rule per sweep. Written by the portal's sweep,
   read on the at-risk board. Never edited by hand. */
export const SupportSlaEvents: CollectionConfig = {
  slug: 'support-sla-events',
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'ticket', defaultColumns: ['ticket', 'rule', 'actions', 'mode', 'createdAt'], group: 'Support portal' },
  fields: [
    { type: 'row', fields: [{ name: 'caseId', type: 'text', required: true, index: true }, { name: 'ticket', type: 'text', required: true, index: true }] },
    { type: 'row', fields: [{ name: 'rule', type: 'text', required: true, index: true }, { name: 'mode', type: 'select', options: ['dry-run', 'live'], required: true }] },
    { name: 'actions', type: 'text', required: true, admin: { description: 'Comma-separated actions taken or planned.' } },
    { name: 'outcome', type: 'select', options: ['planned', 'done', 'failed', 'skipped'], required: true },
    { name: 'detail', type: 'textarea' },
    { name: 'runId', type: 'text', index: true },
    { name: 'actor', type: 'text', admin: { description: 'cron, or the manager who ran the sweep.' } },
  ],
  timestamps: true,
}
