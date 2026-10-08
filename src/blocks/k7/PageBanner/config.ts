import type { Block } from 'payload'

import { actions } from '../shared'

export const PageBanner: Block = {
  slug: 'pageBanner',
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
    { name: 'title', type: 'text', admin: { description: 'Defaults to the page title.' } },
    { name: 'lede', type: 'textarea', required: true },
    actions(2),
  ],
}
