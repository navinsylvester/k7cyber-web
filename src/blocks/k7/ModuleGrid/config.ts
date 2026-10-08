import type { Block } from 'payload'

import { iconOptions } from '@/components/k7/Icon'
import { actions, rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* ModuleChips: "Modular by design". Groups of toggle tiles with an icon, a ✓ or + state, the name and one line. */
export const ModuleGrid: Block = {
  slug: 'moduleGrid',
  dbName: 'mods', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'ModuleGridBlock',
  labels: { singular: 'Module grid', plural: 'Module grids' },
  fields: [
    ...sheetFields('The platform'),
    ...sheetHeadFields,
    {
      name: 'groups',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 2,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', admin: { width: '40%', description: 'Optional head, e.g. Solutions' } },
            { name: 'note', type: 'text', admin: { width: '40%', description: 'e.g. 04 · Core' } },
            { name: 'compact', type: 'checkbox', admin: { width: '20%', description: 'Narrower tiles' } },
          ],
        },
        {
          name: 'items',
          type: 'array',
          required: true,
          admin: { initCollapsed: true, ...rowLabel },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'icon', type: 'select', options: iconOptions, defaultValue: 'grid', admin: { width: '25%' } },
                { name: 'name', type: 'text', required: true, admin: { width: '45%' } },
                { name: 'on', type: 'checkbox', label: 'Core (on)', admin: { width: '30%' } },
              ],
            },
            { name: 'line', type: 'text', required: true },
            { name: 'url', type: 'text', admin: { description: 'Where the tile leads; leave empty for a toggle.' } },
          ],
        },
      ],
    },
    { name: 'legend', type: 'checkbox', defaultValue: false, admin: { description: 'Add the legend cell (✓ core, + add-on) with the link below.' } },
    {
      type: 'row',
      fields: [
        { name: 'legendLinkLabel', type: 'text', admin: { width: '50%', condition: (_, s) => Boolean(s?.legend) } },
        { name: 'legendLinkUrl', type: 'text', admin: { width: '50%', condition: (_, s) => Boolean(s?.legend) } },
      ],
    },
    actions(2),
  ],
}
