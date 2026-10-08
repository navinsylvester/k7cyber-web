import type { Block } from 'payload'

import { actions } from '../shared'

export const PageBanner: Block = {
  slug: 'pageBanner',
  dbName: 'banner', // Postgres identifiers are limited to 63 characters; keep block table names short.
  interfaceName: 'PageBannerBlock',
  labels: { singular: 'Page banner', plural: 'Page banners' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'metaLeft', type: 'text', admin: { width: '50%', description: 'Section path, e.g. Platform · Core' } },
        { name: 'metaRight', type: 'text', admin: { width: '50%', description: 'One fact, e.g. Managed detection and response' } },
      ],
    },
    { name: 'compact', type: 'checkbox', defaultValue: false, admin: { description: 'Meta line only (form pages).' } },
    { name: 'title', type: 'text', admin: { description: 'Defaults to the page title.', condition: (_, s) => !s?.compact } },
    { name: 'lede', type: 'textarea', admin: { condition: (_, s) => !s?.compact } },
    actions(2),
  ],
}
