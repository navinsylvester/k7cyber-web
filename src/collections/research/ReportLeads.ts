import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* Who asked for a gated report. Written by the download route, never by the public API. */
export const ReportLeads: CollectionConfig = {
  slug: 'report-leads',
  access: { create: () => false, delete: roleAccess('marketingEditor'), read: roleAccess('marketingEditor'), update: () => false },
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'company', 'report', 'createdAt'], group: 'K7 Labs' },
  fields: [
    { type: 'row', fields: [{ name: 'name', type: 'text', required: true }, { name: 'email', type: 'email', required: true, index: true }] },
    { type: 'row', fields: [{ name: 'company', type: 'text', required: true }, { name: 'country', type: 'text', required: true }] },
    { name: 'consent', type: 'checkbox', required: true },
    { name: 'report', type: 'relationship', relationTo: 'threat-reports', required: true },
  ],
}
