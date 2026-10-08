import type { Block } from 'payload'

import { link } from '@/fields/link'
import { rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* IndexRow: parallel content is a list, not a card grid. Related products, the industry index, services. */
export const IndexRows: Block = {
  slug: 'indexRows',
  interfaceName: 'IndexRowsBlock',
  labels: { singular: 'Index rows (list of links)', plural: 'Index rows' },
  fields: [
    ...sheetFields('Also in the core'),
    ...sheetHeadFields,
    { name: 'numbered', type: 'checkbox', defaultValue: true, admin: { description: 'Number rows only when the order means something.' } },
    {
      name: 'rows',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'textarea', required: true },
        link({ disableLabel: true, appearances: false }),
      ],
    },
  ],
}
