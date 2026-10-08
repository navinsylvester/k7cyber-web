import type { CollectionConfig } from 'payload'
import { slugField } from 'payload'

import { anyone } from '../../access/anyone'
import { roleAccess } from '../../access/roles'

/* Lab Blog authors: a name and photo reused across posts (FR-LB author field). */
export const Authors: CollectionConfig = {
  slug: 'authors',
  access: { create: roleAccess('labsEditor'), delete: roleAccess('labsEditor'), read: anyone, update: roleAccess('labsEditor') },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'role', 'updatedAt'], group: 'K7 Labs' },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField({ fieldToUse: 'name', position: undefined }),
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'role', type: 'text', defaultValue: 'Threat researcher at K7 Labs', admin: { description: 'One line under the name in the author block.' } },
    { name: 'bio', type: 'textarea' },
    { name: 'wpLogin', type: 'text', index: true, admin: { position: 'sidebar', readOnly: true, description: 'WordPress login, used by the migration.' } },
  ],
}
