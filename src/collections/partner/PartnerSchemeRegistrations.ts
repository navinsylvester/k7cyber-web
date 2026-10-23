import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

import { PARTNER_TYPE_OPTIONS } from './PartnerSettings'

/* An organisation's registration for a scheme (FR-SCH-03, 04): who accepted the terms and when, and K7's decision when the
   scheme asks for one. One row per organisation per scheme. Written by src/lib/partner/schemes.ts only; the partner reads its
   own through the scope, the Scheme Admin reads them all on the desk. */
export const PartnerSchemeRegistrations: CollectionConfig = {
  slug: 'partner-scheme-registrations',
  labels: { singular: 'Scheme registration', plural: 'Scheme registrations' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'orgName', defaultColumns: ['orgName', 'scheme', 'status', 'acceptedAt'], group: 'Partner portal', description: 'Written by the portal. Registrations are decided on the partner desk (/partners/portal/k7/schemes).' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'scheme', type: 'relationship', relationTo: 'partner-schemes', required: true, index: true, admin: { width: '50%' } },
        { name: 'org', type: 'relationship', relationTo: 'partner-orgs', required: true, index: true, admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'orgPartnerId', type: 'text', index: true, admin: { width: '25%' } },
        { name: 'orgName', type: 'text', admin: { width: '45%' } },
        { name: 'orgType', type: 'select', options: PARTNER_TYPE_OPTIONS, admin: { width: '30%' } },
      ],
    },
    { name: 'status', type: 'select', options: [{ label: 'Awaiting K7', value: 'pending' }, { label: 'Registered', value: 'approved' }, { label: 'Declined', value: 'declined' }], required: true, defaultValue: 'pending', index: true },
    {
      name: 'acceptedBy',
      type: 'group',
      admin: { description: 'The Partner Admin who accepted the terms (FR-SCH-03).' },
      fields: [{ type: 'row', fields: [{ name: 'userId', type: 'text', admin: { width: '20%' } }, { name: 'name', type: 'text', admin: { width: '40%' } }, { name: 'email', type: 'text', admin: { width: '40%' } }] }],
    },
    { name: 'acceptedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'decision',
      type: 'group',
      fields: [{ type: 'row', fields: [{ name: 'by', type: 'text', admin: { width: '30%' } }, { name: 'at', type: 'date', admin: { width: '30%', date: { pickerAppearance: 'dayAndTime' } } }, { name: 'note', type: 'text', admin: { width: '40%' } }] }],
    },
  ],
  timestamps: true,
}
