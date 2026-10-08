import type { GlobalConfig } from 'payload'

import { navLinkFields } from '@/fields/navLink'
import { link } from '@/fields/link'
import { revalidateHeader } from './hooks/revalidateHeader'

const rowLabel = { components: { RowLabel: '@/fields/RowLabel#RowLabel' } }

// The Header Menu table of the content doc: Main Menu → Sub Menu 1 (a mega-menu column) → Sub Menu 2 (its rows).
export const Header: GlobalConfig = {
  slug: 'header',
  access: { read: () => true },
  fields: [
    {
      name: 'navItems',
      label: 'Main menu',
      type: 'array',
      maxRows: 8,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        ...navLinkFields(),
        {
          name: 'columns',
          label: 'Mega-menu columns (Sub Menu 1)',
          type: 'array',
          admin: { initCollapsed: true, ...rowLabel, description: 'Leave empty for a plain link such as Partners or Support.' },
          fields: [
            ...navLinkFields(),
            {
              name: 'items',
              label: 'Pages (Sub Menu 2)',
              type: 'array',
              admin: { initCollapsed: true, ...rowLabel },
              fields: navLinkFields(),
            },
          ],
        },
      ],
    },
    link({ overrides: { name: 'cta', label: 'Primary action' }, appearances: false }),
  ],
  hooks: { afterChange: [revalidateHeader] },
}
