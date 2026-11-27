import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* A finished run of a clock Dynamics does not keep (09-portal-guide.md §4g): a case picked from a bin, a Lab sample closed by the
   case's resolution. Written by the notification watch; the Pick-up SLA and Lab SLA cards count these rows. */
export const SupportClockRuns: CollectionConfig = {
  slug: 'support-clock-runs',
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'ticket', defaultColumns: ['ticket', 'clock', 'startedAt', 'endedAt', 'minutes', 'met'], group: 'Support portal' },
  fields: [
    { type: 'row', fields: [{ name: 'caseId', type: 'text', required: true, index: true }, { name: 'ticket', type: 'text' }] },
    { type: 'row', fields: [{ name: 'clock', type: 'select', options: ['pickup', 'lab'], required: true, index: true }, { name: 'ownerId', type: 'text', index: true }, { name: 'ownerName', type: 'text' }] },
    { type: 'row', fields: [{ name: 'startedAt', type: 'date', required: true }, { name: 'endedAt', type: 'date', required: true, index: true }] },
    { type: 'row', fields: [{ name: 'minutes', type: 'number', admin: { description: 'Working minutes.' } }, { name: 'target', type: 'number' }, { name: 'met', type: 'checkbox' }] },
  ],
  timestamps: true,
}
