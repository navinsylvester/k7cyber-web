import type { RequiredDataFromCollectionSlug } from 'payload'

// Shown at / until a page with the slug "home" exists. The real Home template follows the designs/home artboards.
export const homeStatic: RequiredDataFromCollectionSlug<'pages'> = {
  slug: 'home',
  _status: 'published',
  title: 'K7 Seventh Sense',
  layout: [
    {
      blockType: 'pageBanner',
      metaLeft: 'K7 CyberSecurity',
      metaRight: 'Unified Endpoint-To-SOC Security Platform',
      lede: 'This site is being built. Open the admin panel to create the home page, or seed the sample content from the dashboard.',
      actions: [{ link: { type: 'custom', url: '/admin', label: 'Open admin →', appearance: 'primary' } }],
    },
  ],
  meta: { title: 'K7 CyberSecurity', description: 'Unified Endpoint-To-SOC Security Platform' },
}
