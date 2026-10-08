import type { Block } from 'payload'

import { rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* Quote (design-system/components/Quote): the customer's words with initials, name, company and one tag.
   More than one item makes a carousel with the 32×8 dots. */
export const Testimonials: Block = {
  slug: 'testimonials',
  dbName: 'quotes', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'TestimonialsBlock',
  labels: { singular: 'Testimonials', plural: 'Testimonials' },
  fields: [
    ...sheetFields('Customers'),
    ...sheetHeadFields,
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        { name: 'quote', type: 'textarea', required: true },
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true, admin: { width: '40%' } },
            { name: 'company', type: 'text', admin: { width: '40%' } },
            { name: 'tag', type: 'text', admin: { width: '20%', description: 'e.g. CBUAE audit' } },
          ],
        },
      ],
    },
  ],
}
