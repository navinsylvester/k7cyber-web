import type { Block } from 'payload'

import { iconOptions } from '@/components/k7/Icon'

import { actions, rowLabel, sheetFields, sheetHeadFields } from '../shared'

/* FeaturePanel: the cut panel with a figure (placeholder or report cover) beside a body, or two bodies.
   Optional stat row (conf-list) and index rows below it: the home "record" sheet, the platform sheet, industry focus. */
export const FeaturePanels: Block = {
  slug: 'featurePanels',
  dbName: 'fpanel', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'FeaturePanelsBlock',
  labels: { singular: 'Feature panels', plural: 'Feature panels' },
  fields: [
    ...sheetFields('The record'),
    ...sheetHeadFields,
    {
      name: 'panels',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'media',
              type: 'select',
              defaultValue: 'placeholder',
              options: [
                { label: 'Placeholder figure', value: 'placeholder' },
                { label: 'Report cover', value: 'cover' },
                { label: 'None (second body column)', value: 'none' },
              ],
              admin: { width: '34%' },
            },
            { name: 'caption', type: 'text', admin: { width: '33%', description: 'Placeholder caption, e.g. Image · AMTSO award', condition: (_, s) => s?.media === 'placeholder' } },
            { name: 'ratio', type: 'text', defaultValue: '4/3', admin: { width: '33%', condition: (_, s) => s?.media === 'placeholder' } },
          ],
        },
        {
          name: 'cover',
          type: 'group',
          admin: { condition: (_, s) => s?.media === 'cover' },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'brand', type: 'text', defaultValue: 'K7 Labs', admin: { width: '25%' } },
                { name: 'series', type: 'text', defaultValue: 'Cyber Threat Monitor', admin: { width: '25%' } },
                { name: 'period', type: 'text', defaultValue: 'Q3', admin: { width: '25%' } },
                { name: 'year', type: 'text', defaultValue: '2026', admin: { width: '25%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'footLeft', type: 'text', defaultValue: 'July to September', admin: { width: '50%' } },
                { name: 'footRight', type: 'text', defaultValue: 'Report', admin: { width: '50%' } },
              ],
            },
            { name: 'icon', type: 'select', options: iconOptions, defaultValue: 'archive', admin: { description: 'The glyph on the cover\'s tab: archive for a report, certificate for an award.' } },
          ],
        },
        { name: 'label', type: 'text', admin: { description: 'The panel\'s tab (S7): a mono label with the evidence, e.g. AMTSO · award. Without it the panel has no tab.' } },
        { name: 'title', type: 'text', required: true },
        { name: 'text', type: 'textarea' },
        { name: 'bullets', type: 'array', admin: { initCollapsed: true, ...rowLabel }, fields: [{ name: 'text', type: 'text', required: true }] },
        actions(2, 'links'),
        {
          name: 'aside',
          type: 'group',
          label: 'Second column (when media is none)',
          admin: { condition: (_, s) => s?.media === 'none' },
          fields: [
            { name: 'listLabel', type: 'text' },
            { name: 'list', type: 'array', admin: { ...rowLabel }, fields: [{ name: 'text', type: 'text', required: true }] },
            { name: 'tagsLabel', type: 'text' },
            { name: 'tags', type: 'array', admin: { ...rowLabel }, fields: [{ name: 'name', type: 'text', required: true }] },
          ],
        },
        { name: 'onPanel', type: 'checkbox', defaultValue: true, admin: { description: 'Panel ground (off: paper).' } },
      ],
    },
    {
      name: 'stats',
      type: 'array',
      admin: { initCollapsed: true, ...rowLabel, description: 'Optional figures under the panels: 30+ years · Multi-decade expertise.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'n', type: 'text', required: true, admin: { width: '40%' } },
            { name: 'd', type: 'text', required: true, admin: { width: '60%' } },
          ],
        },
      ],
    },
    {
      name: 'rows',
      type: 'array',
      admin: { initCollapsed: true, ...rowLabel, description: 'Optional index rows under the panel (industry focus).' },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'textarea', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    { name: 'rowArrow', type: 'text', defaultValue: '→', admin: { description: '→ to leave, + to expand.' } },
    actions(2),
  ],
}
