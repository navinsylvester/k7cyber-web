import type { Block } from 'payload'

import { rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* ContactLocation: an office with its address, a ledger of contact rows and a map placeholder. */
export const Locations: Block = {
  slug: 'locations',
  dbName: 'locs', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'LocationsBlock',
  labels: { singular: 'Office locations', plural: 'Office locations' },
  fields: [
    ...sheetFields('Offices'),
    ...sheetHeadFields,
    {
      name: 'offices',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true, admin: { width: '30%', description: 'India' } },
            { name: 'company', type: 'text', required: true, admin: { width: '70%' } },
          ],
        },
        { name: 'address', type: 'textarea', required: true },
        {
          name: 'rows',
          type: 'array',
          admin: { initCollapsed: true, ...rowLabel },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'label', type: 'text', required: true, admin: { width: '25%' } },
                { name: 'value', type: 'text', required: true, admin: { width: '45%' } },
                { name: 'href', type: 'text', admin: { width: '30%', description: 'tel: or mailto:' } },
              ],
            },
          ],
        },
        { name: 'mapCaption', type: 'text', admin: { description: 'Placeholder caption until the map exists, e.g. Map · Chennai' } },
      ],
    },
  ],
}
