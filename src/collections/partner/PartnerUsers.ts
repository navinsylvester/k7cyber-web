import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* Partner logins (02-build-plan.md §5, FR-ROLE-01, FR-ROLE-02): one row per person, in exactly one organisation, with one or
   more of the three partner roles. The Partner Admin is created by approval (M2) and adds the others (M3). Sign-in is by
   one-time code to the email here; `status` other than active refuses the code. */
export const PARTNER_USER_ROLE_OPTIONS = [
  { label: 'Partner Admin', value: 'admin' },
  { label: 'Sales user', value: 'sales' },
  { label: 'Technical user', value: 'technical' },
]

export const PartnerUsers: CollectionConfig = {
  slug: 'partner-users',
  labels: { singular: 'Partner user', plural: 'Partner users' },
  access: { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('admin'), update: roleAccess('admin') },
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'name', 'org', 'roles', 'status', 'lastSignInAt'], group: 'Partner portal' },
  fields: [
    { name: 'org', type: 'relationship', relationTo: 'partner-orgs', required: true, index: true, admin: { description: 'The one organisation this person belongs to.' } },
    {
      type: 'row',
      fields: [
        { name: 'email', type: 'email', required: true, unique: true, index: true, admin: { width: '40%' }, hooks: { beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)] } },
        { name: 'name', type: 'text', required: true, admin: { width: '30%' } },
        { name: 'designation', type: 'text', admin: { width: '30%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'mobile', type: 'text', admin: { width: '30%' } },
        { name: 'roles', type: 'select', hasMany: true, options: PARTNER_USER_ROLE_OPTIONS, required: true, defaultValue: ['sales'], admin: { width: '40%' } },
        { name: 'status', type: 'select', options: [{ label: 'Invited', value: 'invited' }, { label: 'Active', value: 'active' }, { label: 'Disabled', value: 'disabled' }], defaultValue: 'invited', required: true, index: true, admin: { width: '30%' } },
      ],
    },
    { type: 'row', fields: [{ name: 'invitedAt', type: 'date', admin: { width: '50%' } }, { name: 'lastSignInAt', type: 'date', admin: { width: '50%' } }] },
  ],
  timestamps: true,
}
