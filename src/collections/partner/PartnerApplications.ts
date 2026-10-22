import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

import { PARTNER_TYPE_OPTIONS } from './PartnerSettings'

/* One row per application to the programme (01-requirements.md §3, 02-build-plan.md §5): what the company filled in on
   /partners/join, who verified what, the terms version they accepted, the status machine's state and every decision taken.
   Written by src/lib/partner/registration.ts; admins read the raw rows here. `resumeKey` is the unguessable part of the link
   the applicant gets by email; it is never shown. */

const BAND = (keys: readonly string[]) => keys.map((k) => ({ label: k, value: k }))

export const PartnerApplications: CollectionConfig = {
  slug: 'partner-applications',
  labels: { singular: 'Partner application', plural: 'Partner applications' },
  access: { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('admin'), update: roleAccess('admin') },
  admin: { useAsTitle: 'number', defaultColumns: ['number', 'status', 'type', 'legalName', 'country', 'submittedAt'], group: 'Partner portal' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'number', type: 'text', unique: true, index: true, admin: { width: '25%', description: 'K7A-00001, given at submission.' } },
        { name: 'type', type: 'select', options: PARTNER_TYPE_OPTIONS, required: true, admin: { width: '25%' } },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          index: true,
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Submitted', value: 'submitted' },
            { label: 'Under review', value: 'underReview' },
            { label: 'Clarification needed', value: 'clarification' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
          ],
          admin: { width: '25%' },
        },
        { name: 'orgId', type: 'text', index: true, admin: { width: '25%', description: 'The partner-orgs row created on approval.' } },
      ],
    },
    { type: 'row', fields: [{ name: 'legalName', type: 'text', admin: { width: '50%' } }, { name: 'tradeName', type: 'text', admin: { width: '50%' } }] },
    { name: 'address', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'city', type: 'text', admin: { width: '25%' } },
        { name: 'state', type: 'text', admin: { width: '25%' } },
        { name: 'country', type: 'text', admin: { width: '25%' } },
        { name: 'pin', type: 'text', admin: { width: '25%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'website', type: 'text', admin: { width: '40%' } },
        { name: 'yearOfIncorporation', type: 'number', min: 1900, max: 2100, admin: { width: '20%' } },
        { name: 'size', type: 'select', options: BAND(['1-10', '11-50', '51-200', '201-500', 'gt500']), admin: { width: '20%' } },
        { name: 'turnover', type: 'select', options: BAND(['lt1', '1-5', '6-10', '11-20', '21-40', '41-60', '61-100', 'gt100']), admin: { width: '20%' } },
      ],
    },
    { type: 'row', fields: [{ name: 'gstin', type: 'text', admin: { width: '50%' } }, { name: 'pan', type: 'text', admin: { width: '50%' } }] },
    { name: 'regions', type: 'text', hasMany: true, admin: { description: 'Region codes from the settings.' } },
    {
      name: 'contact',
      type: 'group',
      admin: { description: 'The primary contact (FR-REG-02); becomes the Partner Admin on approval.' },
      fields: [
        { type: 'row', fields: [{ name: 'name', type: 'text', admin: { width: '40%' } }, { name: 'designation', type: 'text', admin: { width: '30%' } }, { name: 'email', type: 'text', index: true, admin: { width: '30%' } }] },
        {
          type: 'row',
          fields: [
            { name: 'mobile', type: 'text', admin: { width: '25%' } },
            { name: 'emailVerifiedAt', type: 'date', admin: { width: '25%' } },
            { name: 'mobileVerifiedAt', type: 'date', admin: { width: '25%' } },
            { name: 'mobileVerification', type: 'select', options: ['none', 'sms', 'skipped'], defaultValue: 'none', admin: { width: '25%', description: 'skipped: no SMS gateway was configured (decision 4).' } },
          ],
        },
      ],
    },
    {
      name: 'terms',
      type: 'group',
      fields: [{ type: 'row', fields: [{ name: 'version', type: 'text', admin: { width: '50%' } }, { name: 'acceptedAt', type: 'date', admin: { width: '50%' } }] }],
    },
    {
      name: 'assignee',
      type: 'group',
      admin: { description: 'The Channel Manager reviewing it.' },
      fields: [{ type: 'row', fields: [{ name: 'email', type: 'text', index: true, admin: { width: '50%' } }, { name: 'name', type: 'text', admin: { width: '50%' } }] }],
    },
    {
      name: 'decisions',
      type: 'array',
      labels: { singular: 'Decision', plural: 'Decisions' },
      admin: { description: 'Every status change with who, when and the comment (FR-REG-08); the audit trail has the same rows.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'to', type: 'text', required: true, admin: { width: '25%' } },
            { name: 'byName', type: 'text', admin: { width: '25%' } },
            { name: 'byEmail', type: 'text', admin: { width: '25%' } },
            { name: 'at', type: 'date', required: true, admin: { width: '25%' } },
          ],
        },
        { name: 'comment', type: 'textarea' },
      ],
    },
    { type: 'row', fields: [{ name: 'resumeKey', type: 'text', index: true, admin: { width: '50%', description: 'The secret in the applicant’s link; never shown on a page.' } }, { name: 'submittedAt', type: 'date', index: true, admin: { width: '25%' } }, { name: 'decidedAt', type: 'date', admin: { width: '25%' } }] },
  ],
  timestamps: true,
}
