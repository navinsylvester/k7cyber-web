import type { CollectionConfig } from 'payload'

import { anyone } from '../../access/anyone'
import { roleAccess } from '../../access/roles'

export const productKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

/* The controlled product list for CVEs. "Microsoft azure" and "Microsoft Azure" are the same product (FR-VI-05). */
export const Products: CollectionConfig = {
  slug: 'products',
  access: { create: roleAccess('labsEditor'), delete: roleAccess('labsEditor'), read: anyone, update: roleAccess('labsEditor') },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'updatedAt'], group: 'K7 Labs' },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'As shown in the table, e.g. Windows Server.' } },
    {
      name: 'key',
      type: 'text',
      unique: true,
      index: true,
      admin: { hidden: true },
      hooks: { beforeValidate: [({ siblingData }) => (siblingData?.name ? productKey(siblingData.name) : undefined)] },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.name) data.name = data.name.trim().replace(/\s+/g, ' ')
        return data
      },
    ],
  },
}
