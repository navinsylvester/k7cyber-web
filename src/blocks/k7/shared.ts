import type { Field } from 'payload'

import { linkGroup } from '@/fields/linkGroup'

export const rowLabel = { components: { RowLabel: '@/fields/RowLabel#RowLabel' } }

/* Every content sheet after the banner raises a tab (SheetTab) and sits on a ground that never repeats
   the ground above it. The renderer numbers the tabs and alternates paper/panel when ground is "auto". */
export const sheetFields = (defaultTab: string): Field[] => [
  {
    type: 'row',
    fields: [
      { name: 'tabLabel', type: 'text', defaultValue: defaultTab, required: true, admin: { width: '50%', description: 'The section name in the tab, e.g. Overview.' } },
      {
        name: 'ground',
        type: 'select',
        defaultValue: 'auto',
        admin: { width: '50%' },
        options: [
          { label: 'Auto (alternate paper / panel)', value: 'auto' },
          { label: 'Paper', value: 'paper' },
          { label: 'Panel', value: 'panel' },
          { label: 'Contrast', value: 'contrast' },
        ],
      },
    ],
  },
]

/* SheetHead: the headline (statement, optional dim clause) on the left, the lede on the right. */
export const sheetHeadFields: Field[] = [
  {
    type: 'row',
    fields: [
      { name: 'headline', type: 'text', required: true, admin: { width: '50%' } },
      { name: 'dimClause', type: 'text', admin: { width: '50%', description: 'Optional second clause set at dim opacity.' } },
    ],
  },
  { name: 'lede', type: 'textarea', admin: { description: 'One or two sentences, under 46 characters per line.' } },
]

export const actions = (max = 2, name = 'actions') =>
  linkGroup({ overrides: { name, maxRows: max, admin: { initCollapsed: true, ...rowLabel } } })
