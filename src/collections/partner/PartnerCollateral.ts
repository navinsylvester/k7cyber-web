import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'
import { COLLATERAL_CATEGORY_OPTIONS } from '../../lib/partner/collateral-model'

import { PARTNER_TYPE_OPTIONS } from './PartnerSettings'

/* The collateral library's items (01-requirements.md §6, 02-build-plan.md M6, decision 9): one row per piece of material, filed
   under a product (or the programme itself) and a category, with the visibility rule of FR-MKT-03 and a state. The files are
   rows of `partner-collateral-files`, one per version, shown here through the join; the newest is what partners download.
   Edited in this admin by the Marketing Admin (a Payload user with the marketing editor role): upload, replace (a new file row),
   version, tag, retire, with no code release (FR-MKT-04). Partners read it through the portal only. */
export const PartnerCollateral: CollectionConfig = {
  slug: 'partner-collateral',
  labels: { singular: 'Collateral item', plural: 'Collateral' },
  access: { create: roleAccess('marketingEditor'), delete: roleAccess('admin'), read: roleAccess('marketingEditor'), update: roleAccess('marketingEditor') },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'product', 'category', 'status', 'updatedAt'],
    group: 'Partner portal',
    description: 'What partners download at /partners/portal/collateral. Create the item, then add its file under Files (each upload is a version; the newest is served). Published items with a file show to the partners the visibility rule allows.',
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'title', type: 'text', required: true, admin: { width: '50%' } },
        { name: 'status', type: 'select', options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }, { label: 'Retired', value: 'retired' }], defaultValue: 'draft', required: true, index: true, admin: { width: '25%', description: 'Only Published shows. Retired keeps the files and the record.' } },
        { name: 'order', type: 'number', defaultValue: 100, admin: { width: '25%', description: 'Within its category; lower first.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'partner-products', index: true, admin: { width: '50%', description: 'Blank: K7 and the programme (brand, programme guides).' } },
        { name: 'category', type: 'select', options: COLLATERAL_CATEGORY_OPTIONS, required: true, defaultValue: 'brochure', index: true, admin: { width: '50%' } },
      ],
    },
    { name: 'description', type: 'textarea', admin: { description: 'One or two lines under the title: what it is, who it is for, when to use it.' } },
    { name: 'tags', type: 'text', hasMany: true, admin: { description: 'Free words the search also matches (e.g. SMB, healthcare, Tamil).' } },
    {
      name: 'visibility',
      type: 'group',
      admin: { description: 'FR-MKT-03. Empty lists mean every partner; the rules that are set must all hold.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'types', type: 'select', hasMany: true, options: PARTNER_TYPE_OPTIONS, admin: { width: '50%', description: 'Partner types that see it. Empty: all.' } },
            { name: 'certified', type: 'checkbox', defaultValue: false, admin: { width: '50%', description: 'Certified organisations only (nobody until the LMS issues certificates, M11).' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'countries', type: 'text', hasMany: true, admin: { width: '50%', description: 'Country names as the organisation records them (India, Sri Lanka). Empty: all.' } },
            { name: 'regions', type: 'text', hasMany: true, admin: { width: '50%', description: 'K7 region codes from the settings (N, S, WCE). Empty: all.' } },
          ],
        },
      ],
    },
    { name: 'files', type: 'join', collection: 'partner-collateral-files', on: 'item', defaultSort: '-createdAt', admin: { description: 'The versions, newest first. Add one to replace what partners download; the earlier ones stay for the record.' } },
    {
      type: 'row',
      fields: [
        { name: 'publishedAt', type: 'date', admin: { width: '50%', readOnly: true, description: 'Set when the state first becomes Published.' } },
        { name: 'retiredAt', type: 'date', admin: { width: '50%', readOnly: true } },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const now = new Date().toISOString()
        const was = (originalDoc as { status?: string } | undefined)?.status
        if (data.status === 'published' && was !== 'published' && !data.publishedAt) data.publishedAt = now
        if (data.status === 'retired' && was !== 'retired') data.retiredAt = now
        if (data.status !== 'retired' && was === 'retired') data.retiredAt = null
        return data
      },
    ],
  },
  timestamps: true,
}
