import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* The case summary on the timeline (TR-24, 09-portal-guide.md §3): the latest summary Dynamics' Copilot wrote for a case from its
   title, description, notes and emails, one row per case, shared by every agent who opens it. Written by the portal when an agent
   asks for it; never edited by hand. */
export const SupportCaseSummaries: CollectionConfig = {
  slug: 'support-case-summaries',
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'ticket', defaultColumns: ['ticket', 'byName', 'madeAt'], group: 'Support portal' },
  fields: [
    { type: 'row', fields: [{ name: 'caseId', type: 'text', required: true, unique: true, index: true }, { name: 'ticket', type: 'text' }] },
    { name: 'summary', type: 'textarea', required: true },
    { type: 'row', fields: [{ name: 'madeAt', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } }, { name: 'partial', type: 'checkbox' }] },
    { type: 'row', fields: [{ name: 'byId', type: 'text' }, { name: 'byName', type: 'text' }] },
  ],
  timestamps: true,
}
