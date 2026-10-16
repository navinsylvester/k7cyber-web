import type { Block } from 'payload'

import { actions, rowLabel } from '../shared'

/* Hero (design-system/components/Hero): the home opener. The product name flush left on three lines, the lede with two
   actions, the stack figure (sensor, platform, agentic SOC) on the right, the registration pattern (PT1) and the log
   strip (S6). The stair and the redaction (S4, S3) belong to the sheet after it. Home page only. */
export const HomeHero: Block = {
  slug: 'homeHero',
  dbName: 'hhero', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'HomeHeroBlock',
  labels: { singular: 'Home hero', plural: 'Home heroes' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'metaLeft', type: 'text', defaultValue: 'The brief', admin: { width: '50%' } },
        { name: 'liveLabel', type: 'text', defaultValue: 'Threat lab live · Chennai', admin: { width: '50%', description: 'Shown with the blinking pixel.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'line1', type: 'text', required: true, admin: { width: '33%' } },
        { name: 'line2', type: 'text', required: true, admin: { width: '33%' } },
        { name: 'line3', type: 'text', required: true, admin: { width: '34%', description: 'The headline is the product name, one word per line, flush left.' } },
      ],
    },
    { name: 'lede', type: 'textarea', required: true, admin: { description: 'Wrap the platform name in **double asterisks**.' } },
    actions(2),
    {
      name: 'figure',
      type: 'array',
      maxRows: 3,
      admin: { initCollapsed: true, ...rowLabel, description: 'The stack on the right, foot first: sensor, platform, agentic SOC. Exactly three rows draw it; fewer draw nothing.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', required: true, admin: { width: '40%', description: 'e.g. 01 · Sensor' } },
            { name: 'value', type: 'text', required: true, admin: { width: '60%', description: 'e.g. Proprietary, unified' } },
          ],
        },
        { name: 'note', type: 'text', admin: { description: 'Optional mono line, e.g. EPP · EDR · XDR · MDR' } },
      ],
    },
    {
      name: 'log',
      type: 'array',
      admin: { initCollapsed: true, ...rowLabel, description: 'Log strip entries, newest first: time / detection / outcome.' },
      fields: [{ name: 'text', type: 'text', required: true }],
    },
  ],
}
