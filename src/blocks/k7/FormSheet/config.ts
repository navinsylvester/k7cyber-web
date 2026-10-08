import type { Block } from 'payload'

import { sheetFields } from '../shared'

/* EnquiryForm: a form from the form builder on the K7 field language (label, underline control, square checks). */
export const FormSheet: Block = {
  slug: 'formSheet',
  dbName: 'fsheet', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'FormSheetBlock',
  labels: { singular: 'Form', plural: 'Forms' },
  fields: [
    ...sheetFields('Enquiry'),
    { name: 'tabNote', type: 'text', admin: { description: 'Right-hand label in the tab, e.g. the product (XDR).' } },
    { name: 'headline', type: 'text', required: true },
    { name: 'note', type: 'text', defaultValue: 'Fields marked * are mandatory.' },
    { name: 'form', type: 'relationship', relationTo: 'forms', required: true },
    { name: 'privacyUrl', type: 'text', defaultValue: '/privacy-policy' },
    { name: 'maxWidth', type: 'number', admin: { description: 'Optional, px. The quote form uses 960.' } },
  ],
}
