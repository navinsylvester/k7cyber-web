import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { adminOnlyField } from '../../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['admin'],
      required: true,
      access: { update: adminOnlyField },
      admin: { description: 'Labs editors publish posts, CVEs and threats; marketing editors own threat reports.' },
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Labs editor', value: 'labsEditor' },
        { label: 'Marketing editor', value: 'marketingEditor' },
      ],
    },
  ],
  timestamps: true,
}
