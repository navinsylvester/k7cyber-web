import type { Block } from 'payload'

import { iconOptions } from '@/components/k7/Icon'
import { link } from '@/fields/link'
import { rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* IndexRow: parallel content is a list, not a card grid. Related products, the industry index, services. */
export const IndexRows: Block = {
  slug: 'indexRows',
  dbName: 'irows', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'IndexRowsBlock',
  labels: { singular: 'Index rows (list of links)', plural: 'Index rows' },
  fields: [
    ...sheetFields('Also in the core'),
    ...sheetHeadFields,
    {
      type: 'row',
      fields: [
        { name: 'numbered', type: 'checkbox', defaultValue: true, admin: { width: '34%', description: 'Number rows only when the order means something.' } },
        { name: 'pattern', type: 'checkbox', defaultValue: false, admin: { width: '33%', description: 'Seven-hatch texture (PT2); contrast sheet only.' } },
        { name: 'arrow', type: 'text', defaultValue: '→', admin: { width: '33%', description: '→ to leave, + to expand.' } },
      ],
    },
    {
      name: 'rows',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'title', type: 'text', required: true, admin: { width: '70%' } },
            { name: 'icon', type: 'select', options: iconOptions, admin: { width: '30%', description: 'A glyph before the arrow; the industry index carries one per row.' } },
          ],
        },
        { name: 'description', type: 'textarea', required: true },
        link({ disableLabel: true, appearances: false }),
      ],
    },
  ],
}
