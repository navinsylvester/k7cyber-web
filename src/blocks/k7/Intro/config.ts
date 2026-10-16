import type { Block } from 'payload'

import { iconOptions } from '@/components/k7/Icon'
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
      type: 'row',
      fields: [
        { name: 'stair', type: 'checkbox', defaultValue: false, admin: { width: '33%', description: 'Set the headline as the stair (S4): one word per line, stepping onto the 7. Not for the first sheet.' } },
        { name: 'redact', type: 'checkbox', defaultValue: false, admin: { width: '33%', description: 'Redact the last word (S3); hover or tap declassifies. Home page only.' } },
        { name: 'redactNote', type: 'text', defaultValue: '↳ Redacted. Hover or tap to read', admin: { width: '34%', condition: (_, s) => Boolean(s?.redact) } },
      ],
    },
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
    { name: 'symbol', type: 'select', options: iconOptions, admin: { description: 'Optional glyph beside the paragraphs, drawn on the icon rules (home page: puzzle). With a glyph the lede sets above the headline and the paragraphs at lede size on the right, their **terms** as inverted blocks.' } },
    {
      name: 'facts',
      type: 'array',
      admin: { initCollapsed: true, ...rowLabel, description: 'Optional fact ledger beside the paragraphs: key + value (Since · 1991, building …).' },
      fields: [{ type: 'row', fields: [{ name: 'k', type: 'text', required: true, admin: { width: '30%' } }, { name: 'v', type: 'text', required: true, admin: { width: '70%' } }] }],
    },
    {
      name: 'account',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'The account (Account): the facts sum. Each value sets large, the last fact is the total under a double rule, stamped as a block, and the paragraphs sit beside at lede size with their **terms** as blocks. Home page, Why K7.', condition: (_, s) => (s?.facts?.length ?? 0) > 1 },
    },
    {
      name: 'panel',
      type: 'group',
      admin: { description: 'With the account: the paragraphs sit in a filed panel beside a drawn cover, as the record sheet files its report. Leave the series empty for no panel.', condition: (_, s) => Boolean(s?.account) },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', defaultValue: 'K7 CyberSecurity · commitment', admin: { width: '60%', description: 'The panel\'s tab (S7).' } },
            { name: 'icon', type: 'select', options: iconOptions, defaultValue: 'shield', admin: { width: '40%', description: 'The glyph on the cover\'s tab.' } },
          ],
        },
        {
          name: 'cover',
          type: 'group',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'brand', type: 'text', defaultValue: 'K7 CyberSecurity', admin: { width: '25%' } },
                { name: 'series', type: 'text', admin: { width: '25%', description: 'e.g. Accountability' } },
                { name: 'period', type: 'text', defaultValue: 'Since', admin: { width: '25%' } },
                { name: 'year', type: 'text', defaultValue: '1991', admin: { width: '25%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'footLeft', type: 'text', admin: { width: '50%' } },
                { name: 'footRight', type: 'text', admin: { width: '50%' } },
              ],
            },
          ],
        },
      ],
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
