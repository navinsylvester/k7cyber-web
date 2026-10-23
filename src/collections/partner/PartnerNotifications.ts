import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

import { STAFF_ROLE_OPTIONS } from './PartnerSettings'

/* The bell (FR-NTF-01, 02-build-plan.md §5): one row per recipient per event. A partner user's rows carry `userId` and `orgId`;
   K7 staff rows carry the role they were sent to, and every holder of that role reads them. `emailedAt` records the copy that
   went by mail (through SMTP_URL and the allowlist). Written by `src/lib/partner/notify.ts` only. */
export const PartnerNotifications: CollectionConfig = {
  slug: 'partner-notifications',
  labels: { singular: 'Notification', plural: 'Notifications' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'subject', defaultColumns: ['createdAt', 'audience', 'event', 'subject', 'readAt', 'emailedAt'], group: 'Partner portal' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'audience', type: 'select', options: [{ label: 'Partner user', value: 'user' }, { label: 'K7 staff role', value: 'staff' }], required: true, index: true, admin: { width: '25%' } },
        { name: 'userId', type: 'text', index: true, admin: { width: '25%' } },
        { name: 'orgId', type: 'text', index: true, admin: { width: '25%' } },
        { name: 'staffRole', type: 'select', options: STAFF_ROLE_OPTIONS, index: true, admin: { width: '25%' } },
      ],
    },
    { type: 'row', fields: [{ name: 'event', type: 'text', required: true, index: true, admin: { width: '40%', description: 'application.submitted, deal.decided …' } }, { name: 'href', type: 'text', admin: { width: '60%', description: 'Where the row leads inside the portal.' } }] },
    {
      type: 'row',
      fields: [
        { name: 'delivery', type: 'select', options: [{ label: 'Email at once', value: 'immediate' }, { label: 'In the daily digest', value: 'digest' }, { label: 'Bell only', value: 'bell' }], defaultValue: 'immediate', index: true, admin: { width: '50%', description: 'The template’s rule at the time (M8).' } },
        { name: 'digestAt', type: 'date', index: true, admin: { width: '50%', description: 'When the digest that carried this row went out.' } },
      ],
    },
    { name: 'subject', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'readAt', type: 'date', index: true, admin: { width: '25%' } },
        { name: 'emailedAt', type: 'date', admin: { width: '25%' } },
        { name: 'emailTo', type: 'text', admin: { width: '25%' } },
        { name: 'emailError', type: 'text', admin: { width: '25%' } },
      ],
    },
  ],
  timestamps: true,
}
