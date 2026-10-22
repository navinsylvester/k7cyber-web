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
      name: 'layout',
      type: 'select',
      defaultValue: 'tiles',
      options: [
        { label: 'Tiles (ModuleChips)', value: 'tiles' },
        { label: 'Switchboard: the core filed as one block, the add-ons a ledger with a switch each, the sum beneath', value: 'switchboard' },
      ],
      admin: { description: 'The switchboard (Switchboard) files the core as one block (the names large, each with its line as a mono gloss) and sets the add-ons as a ledger of rows with an Off | On switch each, the sum on a double rule. Icons are not drawn; keep each line to a few words. Home page.' },
    },
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
            { name: 'line', type: 'text', required: true, admin: { description: 'One line under the name; on the switchboard a gloss of a few words (e.g. Endpoint protection platform).' } },
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
    /* The tally (home page): the count of modules that are on steps as add-ons are pressed, and the demo request carries them. */
    { name: 'tally', type: 'checkbox', defaultValue: false, admin: { description: 'Add the tally bar under the grid: the count of modules that are on and a demo request that carries them (home page).' } },
    {
      type: 'row',
      fields: [
        { name: 'tallyNote', type: 'text', defaultValue: '1 agent · 1 console', admin: { width: '50%', condition: (_, s) => Boolean(s?.tally) } },
        { name: 'requestUrl', type: 'text', defaultValue: '/contact-us', admin: { width: '50%', description: 'The request lands here with ?modules=EPP,EDR,…', condition: (_, s) => Boolean(s?.tally) } },
      ],
    },
    actions(2),
  ],
}
