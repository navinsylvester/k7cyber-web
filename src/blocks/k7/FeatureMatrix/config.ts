import type { Block } from 'payload'

import { actions, rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* FeatureMatrix: the Modules & Addons tables of a product page. A pixel where a module is included, an em dash where not. */
export const FeatureMatrix: Block = {
  slug: 'featureMatrix',
  interfaceName: 'FeatureMatrixBlock',
  labels: { singular: 'Feature matrix (modules & addons)', plural: 'Feature matrices' },
  fields: [
    ...sheetFields('Modules & addons'),
    ...sheetHeadFields,
    { name: 'columnLabel', type: 'text', defaultValue: 'Included', admin: { description: 'The product column head.' } },
    {
      name: 'groups',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 2,
      admin: { initCollapsed: true, ...rowLabel, description: 'One table per group, side by side from 840px.' },
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'rows',
          type: 'array',
          required: true,
          admin: { initCollapsed: true, ...rowLabel },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'name', type: 'text', required: true, admin: { width: '70%' } },
                { name: 'included', type: 'checkbox', defaultValue: true, admin: { width: '30%' } },
              ],
            },
          ],
        },
      ],
    },
    actions(2),
  ],
}
