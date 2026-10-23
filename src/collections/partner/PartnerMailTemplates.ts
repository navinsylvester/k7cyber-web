import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

import { EVENTS } from '../../lib/partner/notify-model'

/* The editable notification templates (FR-NTF-01 "templates K7 can edit", 02-build-plan.md M8): one row per event at most,
   written by the Channel Manager's templates page (/partners/portal/k7/notifications/templates) and readable raw here.
   A missing row means the code's own text and the catalogue's delivery rule. Placeholders are `{{name}}`; the page lists
   the ones each event supplies. */
export const PartnerMailTemplates: CollectionConfig = {
  slug: 'partner-mail-templates',
  labels: { singular: 'Notification template', plural: 'Notification templates' },
  access: { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('admin'), update: roleAccess('admin') },
  admin: { useAsTitle: 'event', defaultColumns: ['event', 'enabled', 'delivery', 'subject', 'updatedAt'], group: 'Partner portal', description: 'Edited on the partner desk (Notifications → Templates); this is the raw form.' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'event', type: 'select', options: EVENTS.map((e) => ({ label: `${e.label} (${e.key})`, value: e.key })), required: true, unique: true, index: true, admin: { width: '50%' } },
        { name: 'enabled', type: 'checkbox', defaultValue: true, admin: { width: '20%', description: 'Off: the code’s own text is sent.' } },
        {
          name: 'delivery',
          type: 'select',
          options: [
            { label: 'Email at once', value: 'immediate' },
            { label: 'In the daily digest', value: 'digest' },
            { label: 'Bell only', value: 'bell' },
          ],
          required: true,
          defaultValue: 'immediate',
          admin: { width: '30%' },
        },
      ],
    },
    { name: 'subject', type: 'text', maxLength: 200, admin: { description: 'Blank keeps the code’s subject. {{subject}} is the code’s own.' } },
    { name: 'body', type: 'textarea', maxLength: 4000, admin: { description: 'Blank keeps the code’s body. {{body}} is the code’s own; {{link}} where the row leads; {{recipient}} the reader’s name.' } },
    { name: 'updatedBy', type: 'text', admin: { readOnly: true } },
  ],
  timestamps: true,
}
