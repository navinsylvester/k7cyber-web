import type { CollectionConfig } from 'payload'

import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { roleAccess } from '../../access/roles'
import { revalidateResearch } from './revalidate'

export const SEVERITIES = ['critical', 'high', 'important', 'medium', 'low', 'informative'] as const
export type Severity = (typeof SEVERITIES)[number]
export const severityLabel: Record<Severity, string> = { critical: 'Critical', high: 'High', important: 'Important', medium: 'Medium', low: 'Low', informative: 'Informative' }

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/* Vulnerability Information: one row per CVE or vendor advisory, published in monthly batches (FR-VI-01 to 08). */
export const Vulnerabilities: CollectionConfig<'vulnerabilities'> = {
  slug: 'vulnerabilities',
  access: { create: roleAccess('labsEditor'), delete: roleAccess('labsEditor'), read: authenticatedOrPublished, update: roleAccess('labsEditor') },
  admin: {
    useAsTitle: 'cveId',
    defaultColumns: ['cveId', 'title', 'severity', 'date', '_status'],
    group: 'K7 Labs',
    listSearchableFields: ['cveId', 'title'],
    components: { beforeListTable: ['@/collections/research/ImportCsv#ImportCsv'] },
  },
  defaultSort: '-date',
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'cveId',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          label: 'CVE or advisory number',
          admin: { width: '40%', description: 'CVE-YYYY-NNNN, or an older advisory number such as MS17-010.' },
          hooks: { beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toUpperCase() : value)] },
        },
        {
          name: 'severity',
          type: 'select',
          required: true,
          options: SEVERITIES.map((v) => ({ label: severityLabel[v], value: v })),
          admin: { width: '30%' },
        },
        { name: 'date', type: 'date', required: true, label: 'Batch date', admin: { width: '30%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd-MM-yyyy' } } },
      ],
    },
    { name: 'title', type: 'text', required: true, label: 'Vulnerability' },
    { name: 'products', type: 'relationship', relationTo: 'products', hasMany: true, admin: { description: 'Pick from the list; add a product under Products if it is new.' } },
    { name: 'detail', type: 'textarea', label: 'Technical information' },
    {
      type: 'row',
      fields: [
        { name: 'advisoryUrl', type: 'text', label: 'Vendor advisory URL', admin: { width: '60%' } },
        { name: 'patchDate', type: 'date', label: 'Patch released', admin: { width: '40%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd-MM-yyyy' } } },
      ],
    },
    { name: 'affectedSoftware', type: 'textarea', admin: { description: 'One product version per line.' } },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'The URL, kept stable across edits.' },
      hooks: { beforeValidate: [({ value, siblingData }) => value || (siblingData?.cveId ? slugify(siblingData.cveId) : undefined)] },
    },
    { name: 'wpId', type: 'number', index: true, admin: { position: 'sidebar', readOnly: true } },
  ],
  hooks: { afterChange: [revalidateResearch('vulnerabilities')], afterDelete: [revalidateResearch('vulnerabilities')] },
  versions: { drafts: true, maxPerDoc: 20 },
}
