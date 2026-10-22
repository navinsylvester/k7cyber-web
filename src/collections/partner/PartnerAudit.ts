import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* The partner portal's trail (02-build-plan.md decision 17): one append-only row per status change or decision. Who, when,
   on what, from which state to which, with the comment. Written by `src/lib/partner/audit.ts` only; never edited. `orgId`
   lets a partner's own history be listed under the organisation scope. */
export const PartnerAudit: CollectionConfig = {
  slug: 'partner-audit',
  labels: { singular: 'Audit row', plural: 'Audit trail' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'action', defaultColumns: ['createdAt', 'actorName', 'object', 'objectLabel', 'action', 'from', 'to'], group: 'Partner portal' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'actorKind', type: 'select', options: ['partner', 'k7', 'system'], required: true, admin: { width: '20%' } },
        { name: 'actorId', type: 'text', index: true, admin: { width: '30%' } },
        { name: 'actorName', type: 'text', admin: { width: '25%' } },
        { name: 'actorEmail', type: 'text', admin: { width: '25%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'object', type: 'text', required: true, index: true, admin: { width: '30%', description: 'The collection slug: partner-orgs, partner-deals …' } },
        { name: 'objectId', type: 'text', required: true, index: true, admin: { width: '35%' } },
        { name: 'objectLabel', type: 'text', admin: { width: '35%', description: 'K7P-00001, K7D-00042 …' } },
      ],
    },
    { type: 'row', fields: [{ name: 'action', type: 'text', required: true, index: true, admin: { width: '40%' } }, { name: 'from', type: 'text', admin: { width: '30%' } }, { name: 'to', type: 'text', admin: { width: '30%' } }] },
    { name: 'orgId', type: 'text', index: true, admin: { description: 'The partner organisation the row belongs to, when it belongs to one.' } },
    { name: 'comment', type: 'textarea' },
    { name: 'meta', type: 'json' },
  ],
  timestamps: true,
}
