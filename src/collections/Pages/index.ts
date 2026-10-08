import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { CapabilityRows } from '../../blocks/k7/CapabilityRows/config'
import { ComparisonTable } from '../../blocks/k7/ComparisonTable/config'
import { CtaSheet } from '../../blocks/k7/CtaSheet/config'
import { FeatureMatrix } from '../../blocks/k7/FeatureMatrix/config'
import { FeaturePanels } from '../../blocks/k7/FeaturePanels/config'
import { FormSheet } from '../../blocks/k7/FormSheet/config'
import { HomeHero } from '../../blocks/k7/HomeHero/config'
import { IndexRows } from '../../blocks/k7/IndexRows/config'
import { Intro } from '../../blocks/k7/Intro/config'
import { Locations } from '../../blocks/k7/Locations/config'
import { ModuleGrid } from '../../blocks/k7/ModuleGrid/config'
import { PageBanner } from '../../blocks/k7/PageBanner/config'
import { PanelGrid } from '../../blocks/k7/PanelGrid/config'
import { Prose } from '../../blocks/k7/Prose/config'
import { PublicationRows } from '../../blocks/k7/PublicationRows/config'
import { Testimonials } from '../../blocks/k7/Testimonials/config'
import { slugField } from 'payload'
import { populatePublishedAt } from '../../hooks/populatePublishedAt'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { revalidateDelete, revalidatePage } from './hooks/revalidatePage'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

export const Pages: CollectionConfig<'pages'> = {
  slug: 'pages',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  // This config controls what's populated by default when a page is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'pages'>
  defaultPopulate: {
    title: true,
    slug: true,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'pages',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'pages',
        req,
      }),
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              // A page is a stack of sheets: the banner first, the closing call to action last (docs/page-shapes.md).
              blocks: [
                PageBanner,
                HomeHero,
                Intro,
                CapabilityRows,
                ModuleGrid,
                FeaturePanels,
                PanelGrid,
                FeatureMatrix,
                ComparisonTable,
                IndexRows,
                PublicationRows,
                Testimonials,
                Locations,
                Prose,
                FormSheet,
                CtaSheet,
              ],
              required: true,
              admin: {
                initCollapsed: true,
              },
            },
          ],
          label: 'Sheets',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    slugField(),
  ],
  hooks: {
    afterChange: [revalidatePage],
    beforeChange: [populatePublishedAt],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100, // We set this interval for optimal live preview
      },
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
