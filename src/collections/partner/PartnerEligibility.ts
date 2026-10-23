import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

import { PARTNER_TYPE_OPTIONS } from './PartnerSettings'

/* One organisation's result on one scheme (01-requirements.md §9.2): the won deals counted from the dashboard's CRM snapshots,
   their sum, the Scheme Admin's adjustment with its reason (FR-ELG-02), the final value set against the slabs (the slab
   reached, the target, the gap; FR-ELG-03, 04), the partner's dispute and its resolution (FR-ELG-05), and the payout's
   state and reference (FR-ELG-06). The partner sees the row only after the scheme's results are published. Written by
   src/lib/partner/schemes.ts only. */
export const PartnerEligibility: CollectionConfig = {
  slug: 'partner-eligibility',
  labels: { singular: 'Eligibility result', plural: 'Eligibility results' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'orgName', defaultColumns: ['orgName', 'scheme', 'final', 'eligible', 'computedAt'], group: 'Partner portal', description: 'Written by the portal when the Scheme Admin computes a closed scheme; reviewed, adjusted, published and paid on the partner desk.' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'scheme', type: 'relationship', relationTo: 'partner-schemes', required: true, index: true, admin: { width: '50%' } },
        { name: 'org', type: 'relationship', relationTo: 'partner-orgs', required: true, index: true, admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'orgPartnerId', type: 'text', index: true, admin: { width: '25%' } },
        { name: 'orgName', type: 'text', admin: { width: '45%' } },
        { name: 'orgType', type: 'select', options: PARTNER_TYPE_OPTIONS, admin: { width: '30%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'achieved', type: 'number', defaultValue: 0, admin: { width: '25%', description: 'The sum of the deals counted, ₹.' } },
        { name: 'final', type: 'number', defaultValue: 0, admin: { width: '25%', description: 'After the adjustment.' } },
        { name: 'eligible', type: 'checkbox', defaultValue: false, index: true, admin: { width: '25%' } },
        { name: 'slabIndex', type: 'number', defaultValue: -1, admin: { width: '25%', description: 'The slab reached, 0-based in threshold order; -1 none.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'target', type: 'number', defaultValue: 0, admin: { width: '33%' } },
        { name: 'gap', type: 'number', defaultValue: 0, admin: { width: '33%', description: 'To the target when not eligible; to the next slab when eligible.' } },
        { name: 'computedAt', type: 'date', admin: { width: '34%', date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    { name: 'dealsCounted', type: 'json', admin: { description: 'The breakdown: dealId, customer, closedOn, value, opportunityNo, products.' } },
    {
      name: 'adjustment',
      type: 'group',
      fields: [{ type: 'row', fields: [{ name: 'amount', type: 'number', defaultValue: 0, admin: { width: '20%', description: '₹, added to the achieved value; negative to reduce.' } }, { name: 'reason', type: 'text', admin: { width: '50%' } }, { name: 'by', type: 'text', admin: { width: '15%' } }, { name: 'at', type: 'date', admin: { width: '15%', date: { pickerAppearance: 'dayAndTime' } } }] }],
    },
    {
      name: 'dispute',
      type: 'group',
      fields: [
        { name: 'status', type: 'select', options: [{ label: 'None', value: 'none' }, { label: 'Open', value: 'open' }, { label: 'Resolved', value: 'resolved' }], defaultValue: 'none', index: true },
        { name: 'text', type: 'textarea' },
        { type: 'row', fields: [{ name: 'raisedBy', type: 'text', admin: { width: '50%' } }, { name: 'raisedAt', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } } }] },
        { name: 'resolution', type: 'textarea' },
        { type: 'row', fields: [{ name: 'resolvedBy', type: 'text', admin: { width: '50%' } }, { name: 'resolvedAt', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } } }] },
      ],
    },
    {
      name: 'payout',
      type: 'group',
      fields: [
        { type: 'row', fields: [{ name: 'status', type: 'select', options: [{ label: 'Pending', value: 'pending' }, { label: 'Processed', value: 'processed' }, { label: 'Paid', value: 'paid' }], defaultValue: 'pending', admin: { width: '25%' } }, { name: 'reference', type: 'text', admin: { width: '35%' } }, { name: 'by', type: 'text', admin: { width: '20%' } }, { name: 'at', type: 'date', admin: { width: '20%', date: { pickerAppearance: 'dayAndTime' } } }] },
        { name: 'note', type: 'text' },
      ],
    },
  ],
  timestamps: true,
}
