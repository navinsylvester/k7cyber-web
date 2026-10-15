import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* One case linked to one product item (10-product-desk.md §5): the demand behind an item, with the facts the desk needs copied in
   (no contact details; the account name for B2B only). `caseChoice` says whether the case waits for the fix or was resolved with a
   workaround; `toldAt` records when the customer heard about the release. Written by the portal only. */
export const ProductItemCases: CollectionConfig = {
  slug: 'product-item-cases',
  labels: { singular: 'Item case link', plural: 'Item case links' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'ticket', defaultColumns: ['ticket', 'itemNumber', 'caseChoice', 'toldAt', 'linkedAt'], group: 'Product desk' },
  fields: [
    { type: 'row', fields: [{ name: 'itemId', type: 'text', required: true, index: true }, { name: 'itemNumber', type: 'text', index: true }, { name: 'caseId', type: 'text', required: true, index: true }, { name: 'ticket', type: 'text', required: true, index: true }] },
    { name: 'title', type: 'text' },
    { type: 'row', fields: [{ name: 'productName', type: 'text' }, { name: 'vertical', type: 'number' }, { name: 'casePriority', type: 'number' }] },
    { type: 'row', fields: [{ name: 'customerKind', type: 'select', options: ['account', 'contact'] }, { name: 'accountName', type: 'text', admin: { description: 'B2B only; never a contact.' } }] },
    { type: 'row', fields: [{ name: 'supportOwnerId', type: 'text', index: true }, { name: 'supportOwnerName', type: 'text' }, { name: 'supportOwnerEmail', type: 'text' }] },
    { type: 'row', fields: [{ name: 'caseChoice', type: 'select', options: ['keep-open', 'workaround-resolved'], required: true, defaultValue: 'keep-open' }, { name: 'toldAt', type: 'date', index: true }] },
    { type: 'row', fields: [{ name: 'linkedById', type: 'text' }, { name: 'linkedByName', type: 'text' }, { name: 'linkedAt', type: 'date', required: true }, { name: 'unlinkedAt', type: 'date', index: true }] },
  ],
  timestamps: true,
}
