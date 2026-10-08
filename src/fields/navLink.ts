import type { Field } from 'payload'

// A compact link for menus: a label plus either a page or a URL. Used by the header and footer globals.
export const navLinkFields = (): Field[] => [
  { name: 'label', type: 'text', required: true },
  {
    type: 'row',
    fields: [
      { name: 'page', type: 'relationship', relationTo: 'pages', admin: { width: '50%' } },
      { name: 'url', type: 'text', admin: { width: '50%', description: 'Used when no page is chosen.' } },
    ],
  },
]
