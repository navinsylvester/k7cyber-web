import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* What the notification watch last saw of each case (09-portal-guide.md §4g): its owner, its status, when it landed in a bin,
   when its sample went to the Lab, the customer's last message and the SLA states already told. The watch compares each pass
   with this row to find what changed in Dynamics, and keeps the clocks Dynamics does not (pick-up, Lab). Never edited by hand. */
export const SupportCaseWatch: CollectionConfig = {
  slug: 'support-case-watch',
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'ticket', defaultColumns: ['ticket', 'ownerName', 'statuscode', 'binSince', 'labSince', 'seenAt'], group: 'Support portal' },
  fields: [
    { type: 'row', fields: [{ name: 'caseId', type: 'text', required: true, unique: true, index: true }, { name: 'ticket', type: 'text' }] },
    { type: 'row', fields: [{ name: 'ownerId', type: 'text' }, { name: 'ownerName', type: 'text' }, { name: 'ownerKind', type: 'text' }] },
    { type: 'row', fields: [{ name: 'statecode', type: 'number' }, { name: 'statuscode', type: 'number' }] },
    { type: 'row', fields: [{ name: 'binSince', type: 'date' }, { name: 'labSince', type: 'date' }, { name: 'lastInAt', type: 'date' }] },
    { name: 'notified', type: 'json', admin: { description: 'SLA states already told: clock:state:start.' } },
    { type: 'row', fields: [{ name: 'active', type: 'checkbox', defaultValue: true, index: true }, { name: 'seenAt', type: 'date' }] },
  ],
  timestamps: true,
}
