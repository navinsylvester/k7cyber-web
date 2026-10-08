import type { Block } from 'payload'

import { iconOptions } from '@/components/k7/Icon'
import { actions, rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* CapabilityRow: what the content doc's Highlights and Benefits grids become. A two-column ledger of icon, title, sentence. */
export const CapabilityRows: Block = {
  slug: 'capabilityRows',
  interfaceName: 'CapabilityRowsBlock',
  labels: { singular: 'Capability rows (highlights / benefits)', plural: 'Capability rows' },
  fields: [
    ...sheetFields('Benefits'),
    ...sheetHeadFields,
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
            { name: 'icon', type: 'select', options: iconOptions, defaultValue: 'grid', admin: { width: '30%' } },
            { name: 'title', type: 'text', required: true, admin: { width: '70%', description: 'Four words at most.' } },
          ],
        },
        { name: 'text', type: 'textarea', required: true, admin: { description: 'One sentence. Wrap one term in **double asterisks** to keep it bold.' } },
      ],
    },
    actions(2),
  ],
}
