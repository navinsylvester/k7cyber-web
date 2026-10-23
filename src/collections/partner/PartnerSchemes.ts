import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

import { PARTNER_TYPE_OPTIONS } from './PartnerSettings'

/* Incentive schemes (01-requirements.md §9.1, 02-build-plan.md M7, decisions 9 and 16): the catalogue the Scheme Admin writes in
   this admin (FR-SCH-01: name, description, terms, dates, the registration deadline, the partner types, regions and products it
   applies to, a PDF, whether K7 approves registrations) with the slabs of appendix 15 (threshold value → benefit). The portal
   reads it: partners see published schemes that apply to them (FR-SCH-02), register, follow their progress and, after the
   close, their result. Registrations are rows of `partner-scheme-registrations`, results rows of `partner-eligibility`; the
   `results` group here records when the Scheme Admin computed and published them, written by the portal's K7 pages only. */
export const PartnerSchemes: CollectionConfig = {
  slug: 'partner-schemes',
  labels: { singular: 'Scheme', plural: 'Schemes' },
  access: { create: roleAccess('marketingEditor'), delete: roleAccess('admin'), read: roleAccess('marketingEditor'), update: roleAccess('marketingEditor') },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'startDate', 'endDate', 'registrationDeadline', 'approvalRequired'],
    group: 'Partner portal',
    description: 'Incentive schemes partners register for at /partners/portal/schemes. Published schemes show to the partner types and regions named (empty: everyone). Registrations, results and payouts are handled on the partner desk, not here.',
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, admin: { width: '60%' } },
        { name: 'status', type: 'select', options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }, { label: 'Archived', value: 'archived' }], defaultValue: 'draft', required: true, index: true, admin: { width: '40%', description: 'Only Published shows. Archived hides a closed scheme and keeps its results.' } },
      ],
    },
    { name: 'description', type: 'textarea', admin: { description: 'Two or three lines on the listing: what the scheme rewards and for whom.' } },
    { name: 'terms', type: 'textarea', required: true, admin: { description: 'The terms and conditions the Partner Admin accepts to register (FR-SCH-03). Plain text; paragraphs separated by a blank line.' } },
    {
      type: 'row',
      fields: [
        { name: 'startDate', type: 'date', required: true, index: true, admin: { width: '33%', date: { pickerAppearance: 'dayOnly' }, description: 'Deals closed from this day count.' } },
        { name: 'endDate', type: 'date', required: true, index: true, admin: { width: '33%', date: { pickerAppearance: 'dayOnly' }, description: 'The last day that counts; results are computed after it.' } },
        { name: 'registrationDeadline', type: 'date', required: true, admin: { width: '34%', date: { pickerAppearance: 'dayOnly' }, description: 'The last day to register; the scheme is "open" until then.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'types', type: 'select', hasMany: true, options: PARTNER_TYPE_OPTIONS, admin: { width: '50%', description: 'Partner types it applies to. Empty: all.' } },
        { name: 'regions', type: 'text', hasMany: true, admin: { width: '50%', description: 'K7 region codes from the settings (N, S, WCE). Empty: all.' } },
      ],
    },
    { name: 'products', type: 'relationship', relationTo: 'partner-products', hasMany: true, admin: { description: 'Only deals with one of these products count. Empty: every product.' } },
    {
      type: 'row',
      fields: [
        { name: 'approvalRequired', type: 'checkbox', defaultValue: false, admin: { width: '50%', description: 'FR-SCH-04: a Scheme Admin approves each registration. Off: registering is immediate.' } },
        { name: 'disputeDays', type: 'number', min: 0, admin: { width: '50%', description: 'Days after publication in which a partner may dispute the result. Blank: the portal setting (default 14).' } },
      ],
    },
    { name: 'attachment', type: 'upload', relationTo: 'partner-scheme-files', admin: { description: 'The scheme document (PDF), served to registered-eligible partners through the portal only.' } },
    {
      name: 'slabs',
      type: 'array',
      labels: { singular: 'Slab', plural: 'Slabs' },
      admin: { description: 'Appendix 15: thresholds of won order value (₹) and what each earns. The lowest threshold is the target; the highest slab reached is the benefit. Order does not matter; they are sorted by threshold.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'threshold', type: 'number', required: true, min: 1, admin: { width: '30%', description: '₹ won in the window.' } },
            { name: 'benefit', type: 'text', required: true, admin: { width: '45%', description: 'What it earns, in words (e.g. 3% back-end rebate, a trip for two).' } },
            { name: 'amount', type: 'number', min: 0, admin: { width: '25%', description: '₹, when the benefit is money.' } },
          ],
        },
      ],
    },
    {
      name: 'results',
      type: 'group',
      admin: { description: 'Written by the partner desk when the Scheme Admin computes and publishes the results. Do not edit here.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'computedAt', type: 'date', admin: { width: '25%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'computedBy', type: 'text', admin: { width: '25%', readOnly: true } },
            { name: 'publishedAt', type: 'date', index: true, admin: { width: '25%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'publishedBy', type: 'text', admin: { width: '25%', readOnly: true } },
          ],
        },
      ],
    },
  ],
  timestamps: true,
}
