import type { Block } from 'payload'

import { actions } from '../shared'

/* CtaSheet: the one signal sheet a page is allowed, closing every content page before the footer. */
export const CtaSheet: Block = {
  slug: 'ctaSheet',
  interfaceName: 'CtaSheetBlock',
  labels: { singular: 'Closing call to action', plural: 'Closing calls to action' },
  fields: [
    { name: 'tabLabel', type: 'text', defaultValue: 'Next step', required: true },
    { name: 'headline', type: 'text', defaultValue: 'Security that answers to you.', required: true },
    { name: 'paragraph', type: 'textarea', required: true },
    actions(3),
  ],
}
