import type { CollectionConfig } from 'payload'

import {
  BlocksFeature,
  defaultEditorFeatures,
  EXPERIMENTAL_TableFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { slugField } from 'payload'

import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { roleAccess } from '../../access/roles'
import { Banner } from '../../blocks/Banner/config'
import { Code } from '../../blocks/Code/config'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { revalidateDelete, revalidatePost } from './hooks/revalidatePost'

import { MetaDescriptionField, MetaImageField, MetaTitleField, OverviewField, PreviewField } from '@payloadcms/plugin-seo/fields'

/** Plain-text excerpt from a Lexical tree: the first ~200 characters of paragraph text. */
export const excerptFromLexical = (content: unknown, max = 220): string => {
  const out: string[] = []
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return
    const node = n as { type?: string; text?: string; children?: unknown[] }
    if (node.type === 'text' && node.text) out.push(node.text)
    if (node.type === 'paragraph' && out.join(' ').length > max) return
    node.children?.forEach(walk)
  }
  walk((content as { root?: unknown })?.root)
  const text = out.join(' ').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return cut.slice(0, Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '))).trim().replace(/[,;:]$/, '') + '…'
}

/* The Lab Blog (FR-LB-01 to 08). Slugs are preserved from WordPress; the excerpt is generated when left empty. */
export const Posts: CollectionConfig<'posts'> = {
  slug: 'posts',
  access: { create: roleAccess('labsEditor'), delete: roleAccess('labsEditor'), read: authenticatedOrPublished, update: roleAccess('labsEditor') },
  defaultPopulate: { title: true, slug: true, categories: true, publishedAt: true, excerpt: true, featuredImage: true, authors: true, meta: { image: true, description: true } },
  admin: {
    defaultColumns: ['title', 'authors', 'publishedAt', 'featured', '_status'],
    group: 'K7 Labs',
    listSearchableFields: ['title', 'excerpt'],
    livePreview: { url: ({ data, req }) => generatePreviewPath({ slug: data?.slug, collection: 'posts', req }) },
    preview: (data, { req }) => generatePreviewPath({ slug: data?.slug as string, collection: 'posts', req }),
    useAsTitle: 'title',
  },
  defaultSort: '-publishedAt',
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            { name: 'featuredImage', type: 'upload', relationTo: 'media', admin: { description: 'Used on the listing, in Recent Posts and as the share image.' } },
            { name: 'excerpt', type: 'textarea', admin: { description: 'Shown on the listing. Generated from the body when left empty.' } },
            {
              name: 'content',
              type: 'richText',
              required: true,
              label: false,
              editor: lexicalEditor({
                // The full editor: uploads, lists, quotes, inline code and links, plus tables and code blocks.
                features: () => [
                  ...defaultEditorFeatures,
                  HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
                  EXPERIMENTAL_TableFeature(),
                  BlocksFeature({ blocks: [Code, Banner] }),
                  FixedToolbarFeature(),
                  InlineToolbarFeature(),
                  HorizontalRuleFeature(),
                ],
              }),
            },
          ],
        },
        {
          label: 'Detections',
          fields: [
            {
              name: 'detections',
              type: 'relationship',
              relationTo: 'threats',
              hasMany: true,
              admin: { description: 'K7 detections this post references; they link to Top Threats from the post.' },
            },
          ],
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({ titlePath: 'meta.title', descriptionPath: 'meta.description', imagePath: 'meta.image' }),
            MetaTitleField({ hasGenerateFn: true }),
            MetaImageField({ relationTo: 'media' }),
            MetaDescriptionField({}),
            PreviewField({ hasGenerateFn: true, titlePath: 'meta.title', descriptionPath: 'meta.description' }),
          ],
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' }, position: 'sidebar' },
      hooks: { beforeChange: [({ siblingData, value }) => (siblingData._status === 'published' && !value ? new Date() : value)] },
    },
    { name: 'authors', type: 'relationship', relationTo: 'authors', hasMany: true, required: true, admin: { position: 'sidebar' } },
    { name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true, admin: { position: 'sidebar' } },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Shown in Featured Posts on the sidebar (three at most).' } },
    slugField(),
    { name: 'wpId', type: 'number', index: true, admin: { position: 'sidebar', readOnly: true } },
    // Plain text of the body, kept for search across title, body and categories (FR-LB-06).
    { name: 'searchText', type: 'textarea', admin: { hidden: true } }, // no btree index: bodies exceed the 2704-byte row limit; search uses ILIKE
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data && !data.excerpt?.trim() && data.content) data.excerpt = excerptFromLexical(data.content)
        if (data?.content) data.searchText = excerptFromLexical(data.content, 20000)
        return data
      },
    ],
    afterChange: [revalidatePost],
    afterDelete: [revalidateDelete],
  },
  versions: { drafts: { autosave: { interval: 100 }, schedulePublish: true }, maxPerDoc: 50 },
}
