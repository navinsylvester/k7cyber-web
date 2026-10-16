import type { Block } from 'payload'

import { rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* Quote (design-system/components/Quote): the customer's words with initials, name, company and one tag;
   more than one item makes a carousel with the 32×8 dots. With `receiver` the sheet is the Receiver (design-system/components/Receiver). */
export const Testimonials: Block = {
  slug: 'testimonials',
  dbName: 'quotes', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'TestimonialsBlock',
  labels: { singular: 'Testimonials', plural: 'Testimonials' },
  fields: [
    ...sheetFields('Customers'),
    ...sheetHeadFields,
    {
      type: 'row',
      fields: [
        { name: 'receiver', type: 'checkbox', defaultValue: false, admin: { width: '50%', description: 'The receiver (Receiver): stations on a dial, the status line, the scale whose needle sweeps in steps to the next quote. Home page. Off: the plain quote.' } },
        { name: 'dwell', type: 'number', defaultValue: 10, min: 4, max: 60, admin: { width: '50%', description: 'Seconds on each station before the needle reaches the next.', condition: (_, s) => Boolean(s?.receiver) } },
      ],
    },
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
        {
          type: 'row',
          fields: [
            {
              name: 'sentiment',
              type: 'select',
              defaultValue: 'positive',
              options: [
                { label: 'Positive', value: 'positive' },
                { label: 'Negative (interference)', value: 'negative' },
              ],
              admin: { width: '30%', description: 'The band carries the bad with the good. A negative one is named Interference on the status line and shows our reply. To be fed by reviews automatically later.' },
            },
            { name: 'reply', type: 'text', admin: { width: '70%', description: 'One line from K7 under a negative testimonial: plain, light, never defensive.', condition: (_, s) => s?.sentiment === 'negative' } },
          ],
        },
      ],
    },
  ],
}
