import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* The thread and the activity of a product item in one stream (10-product-desk.md §5): comments from either side, questions and
   answers, state changes, case links, tracker changes and mirror results. Evidence files hang off the entry that brought them.
   Written by the portal only. */
export const ProductItemEvents: CollectionConfig = {
  slug: 'product-item-events',
  labels: { singular: 'Item event', plural: 'Item events' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'kind', defaultColumns: ['itemNumber', 'kind', 'side', 'byName', 'createdAt'], group: 'Product desk' },
  fields: [
    { type: 'row', fields: [{ name: 'itemId', type: 'text', required: true, index: true }, { name: 'itemNumber', type: 'text', index: true }] },
    {
      type: 'row',
      fields: [
        { name: 'kind', type: 'select', options: ['handoff', 'comment', 'tracker-comment', 'state', 'tracker-status', 'route', 'priority', 'link', 'unlink', 'ask', 'answer', 'told', 'sample', 'mirror'], required: true, index: true },
        { name: 'side', type: 'select', options: ['support', 'principal', 'engineering', 'lab', 'system'], required: true },
        { name: 'from', type: 'text' },
        { name: 'to', type: 'text' },
      ],
    },
    { type: 'row', fields: [{ name: 'byId', type: 'text' }, { name: 'byName', type: 'text' }, { name: 'byEmail', type: 'text' }, { name: 'caseTicket', type: 'text' }] },
    { name: 'text', type: 'textarea' },
    { name: 'externalId', type: 'text', index: true, admin: { description: 'The tracker comment or change this entry mirrors, so a poll never writes it twice.' } },
    { name: 'evidence', type: 'relationship', relationTo: 'product-evidence', hasMany: true },
  ],
  timestamps: true,
}
