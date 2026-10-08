import type { Block } from 'payload'

import { actions, rowLabel } from '../shared'

/* Hero (design-system/components/Hero): the home opener. The stair (S4), one redacted word (S3), the lede with two
   actions, the registration pattern (PT1) and the log strip (S6). Home page only. */
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
        { name: 'line3', type: 'text', required: true, admin: { width: '34%', description: 'The last line; its final word is redacted.' } },
      ],
    },
    { name: 'redactNote', type: 'text', defaultValue: '↳ Redacted. Hover or tap to read' },
    { name: 'lede', type: 'textarea', required: true, admin: { description: 'Wrap the platform name in **double asterisks**.' } },
    actions(2),
    {
      name: 'log',
      type: 'array',
      admin: { initCollapsed: true, ...rowLabel, description: 'Log strip entries, newest first: time / detection / outcome.' },
      fields: [{ name: 'text', type: 'text', required: true }],
    },
  ],
}
