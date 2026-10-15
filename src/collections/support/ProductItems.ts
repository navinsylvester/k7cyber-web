import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* The product desk's bridge record (docs/support-portal/10-product-desk.md §3, §5): one item per thing engineering or the Lab has to
   decide on, raised from one or more cases. Facts about the case are copied in at raise time; the tracker fields are filled by
   principal support (or the Yodiz adapter in phase B). Written by the portal only; never edited by hand. */
export const ProductItems: CollectionConfig = {
  slug: 'product-items',
  labels: { singular: 'Product item', plural: 'Product items' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'number', defaultColumns: ['number', 'kind', 'team', 'state', 'priority', 'title', 'caseCount', 'lastActivityAt'], group: 'Product desk' },
  fields: [
    { type: 'row', fields: [{ name: 'seq', type: 'number', required: true, unique: true, index: true }, { name: 'number', type: 'text', required: true, unique: true, index: true }] },
    {
      type: 'row',
      fields: [
        { name: 'kind', type: 'select', options: ['defect', 'enhancement', 'detection'], required: true, index: true },
        { name: 'team', type: 'select', options: ['engineering', 'lab'], required: true, index: true },
        { name: 'state', type: 'select', options: ['raised', 'tracked', 'needs-info', 'fixed', 'released', 'declined', 'closed'], required: true, index: true },
        { name: 'askedFrom', type: 'select', options: ['raised', 'tracked'] },
        { name: 'priority', type: 'select', options: ['P1', 'P2', 'P3', 'P4'], required: true, index: true },
      ],
    },
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'textarea', admin: { description: 'The hand-off the agent wrote: what happens, steps, expected vs actual, workaround.' } },
    { type: 'row', fields: [{ name: 'severityHint', type: 'select', options: ['blocks', 'degraded', 'cosmetic'] }, { name: 'customerImpact', type: 'text' }] },
    {
      type: 'row',
      fields: [
        { name: 'productId', type: 'text' },
        { name: 'productName', type: 'text' },
        { name: 'productFamily', type: 'text', index: true },
        { name: 'affectedVersion', type: 'text' },
        { name: 'platform', type: 'text' },
      ],
    },
    { type: 'row', fields: [{ name: 'issueCategory', type: 'text' }, { name: 'subCategory', type: 'text' }, { name: 'vertical', type: 'number' }, { name: 'casePriority', type: 'number' }] },
    {
      name: 'tracker',
      type: 'group',
      admin: { description: 'The engineering record: the issue in the tracker (Yodiz) this item is worked in.' },
      fields: [
        { type: 'row', fields: [{ name: 'kind', type: 'select', options: ['none', 'yodiz'], defaultValue: 'none' }, { name: 'projectId', type: 'text' }, { name: 'id', type: 'text' }, { name: 'key', type: 'text', index: true }] },
        { type: 'row', fields: [{ name: 'url', type: 'text' }, { name: 'status', type: 'text' }, { name: 'category', type: 'text' }, { name: 'syncedAt', type: 'date' }] },
      ],
    },
    { type: 'row', fields: [{ name: 'fixedVersion', type: 'text' }, { name: 'releasedVersion', type: 'text' }, { name: 'showReleaseToCustomer', type: 'checkbox', defaultValue: false }] },
    { name: 'releaseNote', type: 'textarea' },
    { type: 'row', fields: [{ name: 'declineReason', type: 'select', options: ['duplicate', 'by-design', 'wont-fix', 'cannot-reproduce', 'not-a-bug'] }, { name: 'declineNote', type: 'text' }] },
    { type: 'row', fields: [{ name: 'raisedById', type: 'text' }, { name: 'raisedByName', type: 'text' }, { name: 'raisedByEmail', type: 'text' }, { name: 'raisedAt', type: 'date', required: true, index: true }] },
    { type: 'row', fields: [{ name: 'triagedById', type: 'text' }, { name: 'triagedByName', type: 'text' }, { name: 'triagedByEmail', type: 'text' }, { name: 'triagedAt', type: 'date' }] },
    { type: 'row', fields: [{ name: 'supportOwnerId', type: 'text', index: true }, { name: 'supportOwnerName', type: 'text' }, { name: 'supportOwnerEmail', type: 'text' }, { name: 'productOwner', type: 'text' }] },
    { type: 'row', fields: [{ name: 'fixedAt', type: 'date' }, { name: 'releasedAt', type: 'date', index: true }, { name: 'closedAt', type: 'date' }, { name: 'lastActivityAt', type: 'date', required: true, index: true }] },
    { type: 'row', fields: [{ name: 'caseCount', type: 'number', defaultValue: 0 }, { name: 'crmRfeId', type: 'text' }, { name: 'crmDefectId', type: 'text' }, { name: 'crmRef', type: 'text', admin: { description: 'The RFE or defect number in the CRM (RF0224, DF0094).' } }] },
  ],
  timestamps: true,
}
