import type { Block } from 'payload'

import { iconOptions } from '@/components/k7/Icon'
import { rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* PublicationRow: the insight list of a page: icon, title, source, kind and the arrow. */
export const PublicationRows: Block = {
  slug: 'publicationRows',
  dbName: 'pubs', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'PublicationRowsBlock',
  labels: { singular: 'Publication rows (insight)', plural: 'Publication rows' },
  fields: [
    ...sheetFields('Insight'),
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
            { name: 'icon', type: 'select', options: iconOptions, defaultValue: 'document', admin: { width: '30%' } },
            { name: 'title', type: 'text', required: true, admin: { width: '70%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'source', type: 'text', admin: { width: '33%', description: 'e.g. blog.k7computing.com' } },
            { name: 'kind', type: 'text', admin: { width: '33%', description: 'e.g. Case study · PDF' } },
            { name: 'url', type: 'text', required: true, admin: { width: '34%' } },
          ],
        },
      ],
    },
  ],
}
