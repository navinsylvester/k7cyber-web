import type { Block } from 'payload'

import { actions, rowLabel, sheetFields, sheetHeadFields } from '../shared'

const cell = (name: string, label: string) => ({
  name,
  type: 'textarea' as const,
  label,
  admin: { description: 'One point per line. Start a line with "x " for a gap (✖); anything else is a capability (✔).' },
})

/* ComparisonTable: four columns (criterion, competitor, K7, advantage), rows grouped under section rules. */
export const ComparisonTable: Block = {
  slug: 'comparisonTable',
  dbName: 'cmp', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'ComparisonTableBlock',
  labels: { singular: 'Comparison table', plural: 'Comparison tables' },
  fields: [
    ...sheetFields('Comparison'),
    ...sheetHeadFields,
    {
      type: 'row',
      fields: [
        { name: 'criterionHead', type: 'text', defaultValue: 'Capability', admin: { width: '25%' } },
        { name: 'competitorHead', type: 'text', required: true, admin: { width: '25%' } },
        { name: 'k7Head', type: 'text', defaultValue: 'K7 Seventh Sense', admin: { width: '25%' } },
        { name: 'advantageHead', type: 'text', defaultValue: "K7's advantage", admin: { width: '25%' } },
      ],
    },
    {
      name: 'sections',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'title', type: 'text', required: true, admin: { width: '40%' } },
            { name: 'subtitle', type: 'text', admin: { width: '60%' } },
          ],
        },
        {
          name: 'rows',
          type: 'array',
          required: true,
          admin: { initCollapsed: true, ...rowLabel },
          fields: [{ name: 'title', type: 'text', required: true, label: 'Criterion' }, cell('competitor', 'Competitor'), cell('k7', 'K7'), cell('advantage', 'Advantage')],
        },
      ],
    },
    actions(2),
  ],
}
