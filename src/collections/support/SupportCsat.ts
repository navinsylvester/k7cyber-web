import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* One satisfaction survey per case (09-portal-guide.md §4d): created when the survey is sent or the customer rates on the portal,
   updated with the score, and carrying the follow-up a manager closes when the score was low. Facts about the case are copied in
   at the time, so the report never has to go back to Dataverse. Written by the portal only; never edited by hand. */
export const SupportCsat: CollectionConfig = {
  slug: 'support-csat',
  labels: { singular: 'CSAT response', plural: 'CSAT responses' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'ticket', defaultColumns: ['ticket', 'customerName', 'score', 'status', 'followUp', 'respondedAt'], group: 'Support portal' },
  fields: [
    { type: 'row', fields: [{ name: 'caseId', type: 'text', required: true, index: true, unique: true }, { name: 'ticket', type: 'text', required: true, index: true }] },
    { name: 'title', type: 'text' },
    {
      type: 'row',
      fields: [
        { name: 'customerId', type: 'text', index: true, admin: { description: 'The account or contact the case names as its customer.' } },
        { name: 'customerName', type: 'text' },
        { name: 'customerKind', type: 'select', options: ['account', 'contact'] },
      ],
    },
    { type: 'row', fields: [{ name: 'contactId', type: 'text', index: true }, { name: 'email', type: 'text' }] },
    { type: 'row', fields: [{ name: 'ownerId', type: 'text', index: true }, { name: 'ownerName', type: 'text' }] },
    { type: 'row', fields: [{ name: 'product', type: 'text' }, { name: 'issue', type: 'text' }] },
    { type: 'row', fields: [{ name: 'vertical', type: 'number' }, { name: 'priority', type: 'number' }, { name: 'origin', type: 'number' }] },
    {
      type: 'row',
      fields: [
        { name: 'status', type: 'select', options: ['invited', 'responded'], required: true, index: true },
        { name: 'source', type: 'select', options: ['portal', 'email', 'agent'] },
        { name: 'score', type: 'number', min: 1, max: 5, index: true },
      ],
    },
    { name: 'comment', type: 'textarea' },
    { type: 'row', fields: [{ name: 'resolvedAt', type: 'date' }, { name: 'invitedAt', type: 'date' }, { name: 'remindedAt', type: 'date' }, { name: 'respondedAt', type: 'date', index: true }] },
    {
      type: 'row',
      fields: [
        { name: 'followUp', type: 'select', options: ['none', 'pending', 'in-progress', 'done'], required: true, defaultValue: 'none', index: true },
        { name: 'followUpOwnerId', type: 'text' },
        { name: 'followUpOwnerName', type: 'text' },
        { name: 'followUpAt', type: 'date' },
      ],
    },
    { name: 'followUpNote', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'customerReason', type: 'text', admin: { description: 'What the customer said it was about, picked on the survey (a reason key from csat-model.ts).' } },
        { name: 'reason', type: 'text', index: true, admin: { description: 'The desk\'s classification: a manager closing the follow-up, or an agent. Wins over the customer\'s pick.' } },
        { name: 'reasonBy', type: 'text' },
        { name: 'reasonAt', type: 'date' },
      ],
    },
  ],
  timestamps: true,
}
