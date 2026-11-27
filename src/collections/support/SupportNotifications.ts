import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* The workspace bell (09-portal-guide.md §4g): one row per person per notification, written by notify() in
   src/lib/support/notify.ts. `agentId` is the Dynamics systemuserid; `dedupe` keeps one clock state or event from being told
   twice. The email columns say what happened to the copy by mail (sent, waiting for the shift-end digest, or why not). */
export const SupportNotifications: CollectionConfig = {
  slug: 'support-notifications',
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'subject', defaultColumns: ['subject', 'agentEmail', 'event', 'delivery', 'readAt', 'createdAt'], group: 'Support portal' },
  fields: [
    { type: 'row', fields: [{ name: 'agentId', type: 'text', required: true, index: true }, { name: 'agentEmail', type: 'text', index: true }, { name: 'agentName', type: 'text' }] },
    { type: 'row', fields: [{ name: 'event', type: 'text', required: true, index: true }, { name: 'dedupe', type: 'text', index: true }] },
    { name: 'subject', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'href', type: 'text' },
    { type: 'row', fields: [{ name: 'caseId', type: 'text', index: true }, { name: 'ticket', type: 'text' }] },
    { name: 'delivery', type: 'select', options: ['immediate', 'digest', 'bell'], required: true },
    { name: 'readAt', type: 'date', index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { type: 'row', fields: [{ name: 'emailedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } }, { name: 'digestAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } }] },
    { type: 'row', fields: [{ name: 'emailTo', type: 'text' }, { name: 'emailError', type: 'text' }] },
  ],
  timestamps: true,
}
