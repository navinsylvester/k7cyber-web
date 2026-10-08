import type { Block } from 'payload'

import { actions, rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* The overview sheet of a product, addon, industry or service page: the sheet head, one or two columns of
   body copy, an optional architecture figure (the MDR "how it fits together" grid) and an optional coverage tag row. */
export const Intro: Block = {
  slug: 'intro',
  dbName: 'intro', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'IntroBlock',
  labels: { singular: 'Intro copy', plural: 'Intro copy' },
  fields: [
    ...sheetFields('Overview'),
    ...sheetHeadFields,
    {
      name: 'paragraphs',
      type: 'array',
      maxRows: 4,
      admin: { description: 'Two columns of body copy, or a stack beside the fact ledger.', ...rowLabel },
      fields: [{ name: 'text', type: 'textarea', required: true }],
    },
    { name: 'notice', type: 'text', admin: { description: 'Optional framed advisory with a pixel, e.g. **K7 is empanelled by CERT-In** for …' } },
    {
      name: 'specs',
      type: 'array',
      admin: { initCollapsed: true, ...rowLabel, description: 'Optional spec strip beside the first paragraph: label + value (Agentic SOC · Simplified cybersecurity).' },
      fields: [{ type: 'row', fields: [{ name: 'label', type: 'text', required: true, admin: { width: '40%' } }, { name: 'value', type: 'text', required: true, admin: { width: '60%' } }] }],
    },
    {
      name: 'facts',
      type: 'array',
      admin: { initCollapsed: true, ...rowLabel, description: 'Optional fact ledger beside the paragraphs: key + value (Since · 1991, building …).' },
      fields: [{ type: 'row', fields: [{ name: 'k', type: 'text', required: true, admin: { width: '30%' } }, { name: 'v', type: 'text', required: true, admin: { width: '70%' } }] }],
    },
    {
      name: 'figure',
      type: 'group',
      admin: { description: 'Optional: a hairline-gridded figure of labelled lists, e.g. the MDR architecture.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', admin: { width: '50%' } },
            { name: 'caption', type: 'text', admin: { width: '50%', description: 'e.g. Fig. 01 · MDR architecture' } },
          ],
        },
        {
          name: 'cells',
          type: 'array',
          admin: { initCollapsed: true, ...rowLabel },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'label', type: 'text', required: true, admin: { width: '60%' } },
                { name: 'highlight', type: 'checkbox', label: 'Inverted cell (the K7 cell)', admin: { width: '40%' } },
              ],
            },
            { name: 'title', type: 'text', admin: { description: 'Large text for an inverted cell.', condition: (_, s) => Boolean(s?.highlight) } },
            { name: 'items', type: 'array', admin: { ...rowLabel, condition: (_, s) => !s?.highlight }, fields: [{ name: 'name', type: 'text', required: true }] },
          ],
        },
      ],
    },
    {
      name: 'coverage',
      type: 'group',
      fields: [
        { name: 'label', type: 'text', admin: { description: 'e.g. Coverage' } },
        { name: 'tags', type: 'array', admin: { initCollapsed: true, ...rowLabel }, fields: [{ name: 'name', type: 'text', required: true }] },
      ],
    },
    actions(2),
  ],
}
