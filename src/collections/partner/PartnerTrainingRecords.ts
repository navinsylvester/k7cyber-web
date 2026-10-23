import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* What the portal records about learning (01-requirements.md §4, M10): the watched ranges of every user on every module
   (FR-TRN-03, with the position to resume from, FR-TRN-02) and every test attempt with its drawn paper and the answers
   (FR-TRN-06). Written by `src/lib/partner/training.ts` only, under the organisation scope; read-only in the admin for the
   Training Admin. Nothing here reaches Dynamics. */

const readOnly = { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('trainingEditor'), update: roleAccess('admin') }

export const PartnerProgress: CollectionConfig = {
  slug: 'partner-progress',
  labels: { singular: 'Module progress', plural: 'Module progress' },
  access: readOnly,
  admin: {
    group: 'Partner training',
    defaultColumns: ['user', 'module', 'share', 'completedAt', 'updatedAt'],
    description: 'One row per user and module: the union of the watched ranges, the share and the completion. Written by the portal’s player; do not edit.',
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'user', type: 'relationship', relationTo: 'partner-users', required: true, index: true, admin: { width: '34%' } },
        { name: 'org', type: 'relationship', relationTo: 'partner-orgs', required: true, index: true, admin: { width: '33%' } },
        { name: 'module', type: 'relationship', relationTo: 'partner-modules', required: true, index: true, admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'course', type: 'relationship', relationTo: 'partner-courses', required: true, index: true, admin: { width: '34%' } },
        { name: 'courseVersion', type: 'number', defaultValue: 1, admin: { width: '33%' } },
        { name: 'completedAt', type: 'date', index: true, admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'duration', type: 'number', defaultValue: 0, admin: { width: '25%', description: 'Seconds.' } },
        { name: 'watched', type: 'number', defaultValue: 0, admin: { width: '25%', description: 'Seconds covered.' } },
        { name: 'share', type: 'number', defaultValue: 0, admin: { width: '25%' } },
        { name: 'lastPosition', type: 'number', defaultValue: 0, admin: { width: '25%', description: 'Where to resume.' } },
      ],
    },
    { name: 'ranges', type: 'json', admin: { description: 'The watched ranges, merged: [[start, end], …] in seconds.' } },
  ],
  timestamps: true,
}

export const PartnerAttempts: CollectionConfig = {
  slug: 'partner-attempts',
  labels: { singular: 'Test attempt', plural: 'Test attempts' },
  access: readOnly,
  admin: {
    group: 'Partner training',
    defaultColumns: ['user', 'course', 'status', 'score', 'passed', 'startedAt'],
    description: 'Every test attempt with the paper as drawn and the answers given (FR-TRN-06). Written by the portal; do not edit.',
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'user', type: 'relationship', relationTo: 'partner-users', required: true, index: true, admin: { width: '25%' } },
        { name: 'userName', type: 'text', admin: { width: '25%' } },
        { name: 'org', type: 'relationship', relationTo: 'partner-orgs', required: true, index: true, admin: { width: '25%' } },
        { name: 'course', type: 'relationship', relationTo: 'partner-courses', required: true, index: true, admin: { width: '25%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'status', type: 'select', options: [{ label: 'Open', value: 'open' }, { label: 'Submitted', value: 'submitted' }, { label: 'Expired', value: 'expired' }], defaultValue: 'open', required: true, index: true, admin: { width: '20%' } },
        { name: 'courseVersion', type: 'number', defaultValue: 1, admin: { width: '20%' } },
        { name: 'startedAt', type: 'date', required: true, index: true, admin: { width: '20%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'expiresAt', type: 'date', admin: { width: '20%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'submittedAt', type: 'date', admin: { width: '20%', date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'score', type: 'number', admin: { width: '20%', description: '%' } },
        { name: 'correct', type: 'number', defaultValue: 0, admin: { width: '20%' } },
        { name: 'total', type: 'number', defaultValue: 0, admin: { width: '20%' } },
        { name: 'passMark', type: 'number', defaultValue: 70, admin: { width: '20%' } },
        { name: 'passed', type: 'checkbox', defaultValue: false, index: true, admin: { width: '20%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'seed', type: 'text', admin: { width: '50%', description: 'The draw can be repeated from it.' } },
        { name: 'showAnswers', type: 'checkbox', defaultValue: true, admin: { width: '50%', description: 'The course’s rule at the time.' } },
      ],
    },
    { name: 'paper', type: 'json', admin: { description: 'The questions as drawn, with the shuffled options under letter keys and the correct keys.' } },
    { name: 'answers', type: 'json', admin: { description: 'The keys chosen per question.' } },
  ],
  timestamps: true,
}
