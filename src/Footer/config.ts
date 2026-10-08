import type { GlobalConfig } from 'payload'

import { navLinkFields } from '@/fields/navLink'
import { revalidateFooter } from './hooks/revalidateFooter'

const rowLabel = { components: { RowLabel: '@/fields/RowLabel#RowLabel' } }

// SiteFooter: the white logo and one sentence, the link columns from the Footer table, the social row, the legal line.
export const Footer: GlobalConfig = {
  slug: 'footer',
  access: { read: () => true },
  fields: [
    { name: 'tagline', type: 'textarea', defaultValue: 'Security that answers to you. Superior cybersecurity since 1991, built and supported in-house.' },
    {
      name: 'columns',
      type: 'array',
      maxRows: 5,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        { name: 'heading', type: 'text', required: true },
        { name: 'links', type: 'array', admin: { initCollapsed: true, ...rowLabel }, fields: navLinkFields() },
      ],
    },
    {
      name: 'socials',
      type: 'array',
      admin: { initCollapsed: true, ...rowLabel, description: 'Two-letter mono labels in 36px frames: in, X, YT, IG, FB.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'code', type: 'text', required: true, maxLength: 3, admin: { width: '20%' } },
            { name: 'name', type: 'text', required: true, admin: { width: '30%' } },
            { name: 'url', type: 'text', required: true, admin: { width: '50%' } },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'legal', type: 'text', defaultValue: '© 2026 K7 Enterprise Security Private Limited. All Rights Reserved.', admin: { width: '60%' } },
        { name: 'offices', type: 'text', defaultValue: 'Chennai · Singapore · Dubai', admin: { width: '40%' } },
      ],
    },
  ],
  hooks: { afterChange: [revalidateFooter] },
}
