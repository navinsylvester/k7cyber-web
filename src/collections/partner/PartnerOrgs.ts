import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

import { PARTNER_TYPE_OPTIONS } from './PartnerSettings'

/* Approved partner organisations (02-build-plan.md §5): created by the approval of an application (M2), never by hand. The
   partner ID is the portal's; the CRM account and contact ids arrive from the outbox. Suspension (M3) blocks every user's
   sign-in and ends their sessions on the next request; a legal-identity edit waits in `pendingLegalEdit` until a Channel Manager
   decides (FR-REG-07). Written by the portal through the local API with access overridden; admins read the raw rows here. */
export const PartnerOrgs: CollectionConfig = {
  slug: 'partner-orgs',
  labels: { singular: 'Partner organisation', plural: 'Partner organisations' },
  access: { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('admin'), update: roleAccess('admin') },
  admin: { useAsTitle: 'name', defaultColumns: ['partnerId', 'name', 'type', 'status', 'country', 'updatedAt'], group: 'Partner portal' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'partnerId', type: 'text', required: true, unique: true, index: true, admin: { width: '25%', description: 'K7P-00001' } },
        { name: 'type', type: 'select', options: PARTNER_TYPE_OPTIONS, required: true, admin: { width: '25%' } },
        { name: 'status', type: 'select', options: [{ label: 'Approved', value: 'approved' }, { label: 'Suspended', value: 'suspended' }], defaultValue: 'approved', required: true, index: true, admin: { width: '25%' } },
        { name: 'applicationId', type: 'text', index: true, admin: { width: '25%', description: 'The partner-applications row this came from (M2).' } },
      ],
    },
    { type: 'row', fields: [{ name: 'name', type: 'text', required: true, admin: { width: '50%', description: 'Legal name.' } }, { name: 'tradeName', type: 'text', admin: { width: '50%' } }] },
    { type: 'row', fields: [{ name: 'gstin', type: 'text', admin: { width: '50%' } }, { name: 'pan', type: 'text', admin: { width: '50%' } }] },
    { name: 'address', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'city', type: 'text', admin: { width: '25%' } },
        { name: 'state', type: 'text', admin: { width: '25%' } },
        { name: 'country', type: 'text', admin: { width: '25%' } },
        { name: 'pin', type: 'text', admin: { width: '25%' } },
      ],
    },
    { type: 'row', fields: [{ name: 'website', type: 'text', admin: { width: '50%' } }, { name: 'regions', type: 'text', hasMany: true, admin: { width: '50%', description: 'Region codes from the settings.' } }] },
    {
      name: 'crm',
      type: 'group',
      admin: { description: 'Filled by the outbox when the mirror creates the account and the primary contact (03-dynamics-exploration.md §6).' },
      fields: [
        { type: 'row', fields: [{ name: 'accountId', type: 'text', admin: { width: '40%' } }, { name: 'accountCode', type: 'text', admin: { width: '30%', description: 'alletec_accountid, the CRM number.' } }, { name: 'contactId', type: 'text', admin: { width: '30%' } }] },
      ],
    },
    {
      name: 'certificate',
      type: 'group',
      admin: { description: 'The organisation certificate (M11). Until then: none, and the deal gate ignores it.' },
      fields: [
        { type: 'row', fields: [{ name: 'status', type: 'select', options: ['none', 'valid', 'expired', 'revoked'], defaultValue: 'none', admin: { width: '50%' } }, { name: 'until', type: 'date', admin: { width: '50%' } }] },
      ],
    },
    { type: 'row', fields: [{ name: 'waiverUntil', type: 'date', admin: { width: '50%', description: 'The Channel Manager may let an uncertified organisation register deals until this date (decision 8).' } }, { name: 'suspendedAt', type: 'date', admin: { width: '50%' } }] },
    { name: 'suspendedReason', type: 'textarea', admin: { description: 'Why the Channel Manager suspended it (M3); every user of the organisation reads it.' } },
    { name: 'pendingLegalEdit', type: 'json', admin: { description: 'A legal-identity edit (legal name, GSTIN, PAN) awaiting K7 re-approval (FR-REG-07, M3): the proposed values, who proposed them, when, why. Written by the portal; null when none.' } },
  ],
  timestamps: true,
}
