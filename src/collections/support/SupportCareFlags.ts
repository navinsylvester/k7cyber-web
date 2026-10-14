import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* A manager's "handle with care" flag on a customer (account or contact), shown to every agent beside the customer's name until it
   is cleared or expires. Cleared flags stay as history (active = false). Written by the portal; never edited by hand. */
export const SupportCareFlags: CollectionConfig = {
  slug: 'support-care-flags',
  labels: { singular: 'Care flag', plural: 'Care flags' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'customerName', defaultColumns: ['customerName', 'level', 'active', 'setBy', 'until'], group: 'Support portal' },
  fields: [
    { type: 'row', fields: [{ name: 'customerId', type: 'text', required: true, index: true }, { name: 'customerName', type: 'text' }, { name: 'customerKind', type: 'select', options: ['account', 'contact'] }] },
    { type: 'row', fields: [{ name: 'level', type: 'select', options: ['high', 'watch'], required: true }, { name: 'active', type: 'checkbox', defaultValue: true, index: true }, { name: 'until', type: 'date' }] },
    { name: 'reason', type: 'textarea' },
    { type: 'row', fields: [{ name: 'setBy', type: 'text' }, { name: 'setById', type: 'text' }, { name: 'clearedBy', type: 'text' }, { name: 'clearedAt', type: 'date' }] },
  ],
  timestamps: true,
}
