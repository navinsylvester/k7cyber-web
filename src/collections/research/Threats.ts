import type { CollectionConfig } from 'payload'

import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { roleAccess } from '../../access/roles'
import { revalidateResearch } from './revalidate'

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/* Top Threats: the detections K7 Labs sees most, with file details, behaviour and removal (FR-TT-01 to 05). */
export const Threats: CollectionConfig<'threats'> = {
  slug: 'threats',
  access: { create: roleAccess('labsEditor'), delete: roleAccess('labsEditor'), read: authenticatedOrPublished, update: roleAccess('labsEditor') },
  admin: {
    useAsTitle: 'detectionName',
    defaultColumns: ['detectionName', 'prevalence', 'lastSeen', 'retired', '_status'],
    group: 'K7 Labs',
    listSearchableFields: ['detectionName', 'aliases', 'md5', 'sha256'],
  },
  defaultSort: '-lastSeen',
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'detectionName', type: 'text', required: true, unique: true, index: true, label: 'K7 detection name', admin: { width: '50%', description: 'e.g. Trojan ( 006d70f91 )' } },
        {
          name: 'affectedOs',
          type: 'select',
          hasMany: true,
          required: true,
          defaultValue: ['windows'],
          options: [
            { label: 'Windows', value: 'windows' },
            { label: 'Android', value: 'android' },
            { label: 'Linux', value: 'linux' },
            { label: 'macOS', value: 'macos' },
          ],
          admin: { width: '25%' },
        },
        { name: 'prevalence', type: 'select', required: true, defaultValue: 'low', options: [{ label: 'Low', value: 'low' }, { label: 'High', value: 'high' }], admin: { width: '25%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'firstSeen', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd-MM-yyyy' } } },
        { name: 'lastSeen', type: 'date', required: true, admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd-MM-yyyy' } } },
        { name: 'avDefinitionVersion', type: 'text', required: true, label: 'AV definition version', admin: { width: '34%' } },
      ],
    },
    {
      type: 'collapsible',
      label: 'File details',
      fields: [
        { type: 'row', fields: [{ name: 'md5', type: 'text', admin: { width: '50%' } }, { name: 'sha256', type: 'text', admin: { width: '50%' } }] },
        {
          type: 'row',
          fields: [
            { name: 'fileSize', type: 'number', label: 'File size (bytes)', admin: { width: '33%' } },
            { name: 'packer', type: 'text', admin: { width: '33%' } },
            { name: 'aliases', type: 'text', admin: { width: '34%' } },
          ],
        },
      ],
    },
    { name: 'behaviourDetails', type: 'textarea', admin: { description: 'Observed behaviour. Registry writes in the form "Adds data <value> under <key>" render as a log.', rows: 10 } },
    { name: 'removalInstructions', type: 'textarea', admin: { description: 'Numbered steps, one per line.', rows: 6 } },
    { name: 'retired', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Leaves the table; the detail page stays up (FR-TT-04).' } },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
      hooks: { beforeValidate: [({ value, siblingData }) => value || (siblingData?.detectionName ? slugify(siblingData.detectionName) : undefined)] },
    },
    { name: 'wpId', type: 'number', index: true, admin: { position: 'sidebar', readOnly: true } },
  ],
  hooks: { afterChange: [revalidateResearch('threats')], afterDelete: [revalidateResearch('threats')] },
  versions: { drafts: true, maxPerDoc: 20 },
}
