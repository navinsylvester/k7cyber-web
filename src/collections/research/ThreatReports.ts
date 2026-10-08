import type { CollectionConfig } from 'payload'
import { slugField } from 'payload'

import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { roleAccess } from '../../access/roles'
import { revalidateResearch } from './revalidate'

/* Threat Reports: the Cyber Threat Monitor and other periodic reports (FR-TR-01 to 05). */
export const ThreatReports: CollectionConfig<'threat-reports'> = {
  slug: 'threat-reports',
  access: { create: roleAccess('marketingEditor'), delete: roleAccess('marketingEditor'), read: authenticatedOrPublished, update: roleAccess('marketingEditor') },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'period', 'publishedAt', 'gated', '_status'], group: 'K7 Labs' },
  defaultSort: '-publishedAt',
  fields: [
    { name: 'title', type: 'text', required: true, admin: { description: 'e.g. Cyber Threat Monitor Report' } },
    {
      type: 'row',
      fields: [
        { name: 'reportType', type: 'text', defaultValue: 'Cyber Threat Monitor Report', admin: { width: '50%' } },
        { name: 'period', type: 'text', required: true, admin: { width: '25%', description: 'Q2 2026 or Annual 2025; drives the cover.' } },
        { name: 'periodRange', type: 'text', admin: { width: '25%', description: 'April to June' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'publishedAt', type: 'date', required: true, admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd-MM-yyyy' } } },
        {
          name: 'year',
          type: 'number',
          admin: { width: '50%', description: 'Filter year; defaults to the publish year.' },
          hooks: { beforeValidate: [({ value, siblingData }) => value || (siblingData?.publishedAt ? new Date(siblingData.publishedAt).getFullYear() : undefined)] },
        },
      ],
    },
    { name: 'summary', type: 'textarea', required: true },
    { name: 'cover', type: 'upload', relationTo: 'media', admin: { description: 'Optional. Without one, the series cover is drawn from the period.' } },
    { name: 'pdf', type: 'upload', relationTo: 'report-files', required: true },
    { name: 'gated', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Ask for contact details before the download.' } },
    { name: 'downloads', type: 'number', defaultValue: 0, admin: { position: 'sidebar', readOnly: true } },
    slugField({ position: 'sidebar' }),
  ],
  hooks: { afterChange: [revalidateResearch('threat-reports')], afterDelete: [revalidateResearch('threat-reports')] },
  versions: { drafts: true, maxPerDoc: 20 },
}
