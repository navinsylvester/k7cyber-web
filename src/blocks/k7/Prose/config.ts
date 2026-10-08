import type { Block } from 'payload'

import { FixedToolbarFeature, HeadingFeature, InlineToolbarFeature, lexicalEditor } from '@payloadcms/richtext-lexical'

import { sheetFields } from '../shared'

/* Prose: long-form copy at 18px/1.65 in a 40rem column. Compliance pages, About K7, legal pages. */
export const Prose: Block = {
  slug: 'prose',
  interfaceName: 'ProseBlock',
  labels: { singular: 'Prose (rich text)', plural: 'Prose' },
  fields: [
    ...sheetFields('The detail'),
    {
      type: 'row',
      fields: [
        { name: 'headline', type: 'text', admin: { width: '50%', description: 'Optional sheet head above the column.' } },
        { name: 'dimClause', type: 'text', admin: { width: '50%' } },
      ],
    },
    { name: 'lede', type: 'textarea' },
    {
      name: 'richText',
      type: 'richText',
      required: true,
      editor: lexicalEditor({
        features: ({ rootFeatures }) => [...rootFeatures, HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }), FixedToolbarFeature(), InlineToolbarFeature()],
      }),
    },
  ],
}
