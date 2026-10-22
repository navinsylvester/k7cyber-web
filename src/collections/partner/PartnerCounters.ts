import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* One row per identifier kind (src/lib/partner/ids.ts): the last number given out. Advanced by compare-and-swap; never edited
   by hand except to skip a range. */
export const PartnerCounters: CollectionConfig = {
  slug: 'partner-counters',
  labels: { singular: 'Counter', plural: 'Counters' },
  access: { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('admin'), update: roleAccess('admin') },
  admin: { useAsTitle: 'kind', defaultColumns: ['kind', 'value', 'updatedAt'], group: 'Partner portal' },
  fields: [
    { type: 'row', fields: [{ name: 'kind', type: 'text', required: true, unique: true, index: true, admin: { width: '50%', description: 'partner · application · deal' } }, { name: 'value', type: 'number', required: true, defaultValue: 0, min: 0, admin: { width: '50%' } }] },
  ],
  timestamps: true,
}
