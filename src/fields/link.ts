import type { Field, GroupField } from 'payload'

import deepMerge from '@/utilities/deepMerge'

// K7 Design Language 2.1, Button: primary (signal, cut), line (1px), text (underline).
export type LinkAppearances = 'primary' | 'line' | 'text'

export const appearanceOptions: Record<LinkAppearances, { label: string; value: string }> = {
  primary: { label: 'Primary (signal)', value: 'primary' },
  line: { label: 'Line', value: 'line' },
  text: { label: 'Text link', value: 'text' },
}

type LinkType = (options?: {
  appearances?: LinkAppearances[] | false
  disableLabel?: boolean
  overrides?: Partial<GroupField>
}) => Field

export const link: LinkType = ({ appearances, disableLabel = false, overrides = {} } = {}) => {
  const linkResult: GroupField = {
    name: 'link',
    type: 'group',
    admin: { hideGutter: true },
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'type',
            type: 'radio',
            admin: { layout: 'horizontal', width: '50%' },
            defaultValue: 'reference',
            options: [
              { label: 'Internal link', value: 'reference' },
              { label: 'Custom URL', value: 'custom' },
            ],
          },
          {
            name: 'newTab',
            type: 'checkbox',
            admin: { style: { alignSelf: 'flex-end' }, width: '50%' },
            label: 'Open in new tab',
          },
        ],
      },
    ],
  }

  const linkTypes: Field[] = [
    {
      name: 'reference',
      type: 'relationship',
      admin: { condition: (_, siblingData) => siblingData?.type === 'reference', width: '50%' },
      label: 'Document to link to',
      relationTo: ['pages', 'posts'],
      required: true,
    },
    {
      name: 'url',
      type: 'text',
      admin: { condition: (_, siblingData) => siblingData?.type === 'custom', width: '50%' },
      label: 'Custom URL',
      required: true,
    },
  ]

  if (!disableLabel) {
    linkResult.fields.push({
      type: 'row',
      fields: [
        ...linkTypes,
        { name: 'label', type: 'text', admin: { width: '50%' }, label: 'Label', required: true },
      ],
    })
  } else {
    linkResult.fields = [...linkResult.fields, ...linkTypes]
  }

  if (appearances !== false) {
    let appearanceOptionsToUse = [appearanceOptions.primary, appearanceOptions.line, appearanceOptions.text]
    if (appearances) appearanceOptionsToUse = appearances.map((a) => appearanceOptions[a])

    linkResult.fields.push({
      name: 'appearance',
      type: 'select',
      admin: { description: 'Primary is the one signal button a view gets; line is the alternative beside it.' },
      defaultValue: 'line',
      options: appearanceOptionsToUse,
    })
  }

  return deepMerge(linkResult, overrides)
}
