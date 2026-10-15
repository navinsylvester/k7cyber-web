import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* The outbox of CRM writes the product desk owes Dataverse (10-product-desk.md §6): one row per operation on one case. A write that
   succeeded on the spot is recorded `done`; one the production guard refused is `skipped`; one that failed waits as `pending` for the
   sweep's drain (phase B) or a retry from the item page. `lastError` carries a code, never a body. Written by the portal only. */
export const ProductMirror: CollectionConfig = {
  slug: 'product-mirror',
  labels: { singular: 'Mirror write', plural: 'Mirror writes' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'op', defaultColumns: ['itemNumber', 'ticket', 'op', 'state', 'attempts', 'updatedAt'], group: 'Product desk' },
  fields: [
    { type: 'row', fields: [{ name: 'itemId', type: 'text', required: true, index: true }, { name: 'itemNumber', type: 'text', index: true }, { name: 'caseId', type: 'text', index: true }, { name: 'ticket', type: 'text' }] },
    { type: 'row', fields: [{ name: 'op', type: 'select', options: ['status', 'note', 'task', 'rfe', 'defect', 'yodiz'], required: true }, { name: 'state', type: 'select', options: ['pending', 'done', 'failed', 'skipped'], required: true, index: true }, { name: 'attempts', type: 'number', defaultValue: 0 }] },
    { name: 'body', type: 'json', admin: { description: 'The operation as the model produced it.' } },
    { type: 'row', fields: [{ name: 'actor', type: 'text', admin: { description: 'Who the write ran as: the agent, the service identity, or nobody yet.' } }, { name: 'lastError', type: 'text' }, { name: 'doneAt', type: 'date' }] },
  ],
  timestamps: true,
}
