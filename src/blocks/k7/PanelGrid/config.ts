import type { Block } from 'payload'

import { actions, rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* A hairline-gridded set of panels: "Solutions for BFSI", a service's focus areas. Each cell carries a label,
   a title, copy, a plain or numbered list, grouped tags and one text link. */
export const PanelGrid: Block = {
  slug: 'panelGrid',
  dbName: 'panels', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'PanelGridBlock',
  labels: { singular: 'Panel grid', plural: 'Panel grids' },
  fields: [
    ...sheetFields('Solutions'),
    ...sheetHeadFields,
    {
      name: 'cells',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', required: true, admin: { width: '50%', description: 'Mono label in acc-ink, e.g. Platform or 01 · Infrastructure' } },
            { name: 'title', type: 'text', admin: { width: '50%' } },
          ],
        },
        { name: 'text', type: 'textarea' },
        {
          type: 'row',
          fields: [
            {
              name: 'listStyle',
              type: 'select',
              defaultValue: 'plain',
              options: [
                { label: 'Plain list', value: 'plain' },
                { label: 'Numbered steps', value: 'steps' },
              ],
              admin: { width: '50%' },
            },
          ],
        },
        { name: 'list', type: 'array', admin: { initCollapsed: true, ...rowLabel }, fields: [{ name: 'text', type: 'text', required: true }] },
        {
          name: 'tagGroups',
          type: 'array',
          admin: { initCollapsed: true, ...rowLabel, description: 'Tags, optionally under a muted label (Global, India, Middle East).' },
          fields: [
            { name: 'label', type: 'text' },
            { name: 'tags', type: 'array', admin: { ...rowLabel }, fields: [{ name: 'name', type: 'text', required: true }] },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'linkLabel', type: 'text', admin: { width: '50%', description: 'e.g. Explore →' } },
            { name: 'linkUrl', type: 'text', admin: { width: '50%' } },
          ],
        },
      ],
    },
    { name: 'minWidth', type: 'number', defaultValue: 280, admin: { description: 'Minimum cell width in px before the grid wraps.' } },
    actions(2),
  ],
}
