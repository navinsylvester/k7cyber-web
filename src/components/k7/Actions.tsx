import Link from 'next/link'
import React from 'react'

import { linkHref } from '@/utilities/linkHref'

type Action = {
  id?: string | null
  link: {
    type?: ('reference' | 'custom') | null
    newTab?: boolean | null
    reference?: { relationTo: 'pages' | 'posts'; value: unknown } | null
    url?: string | null
    label: string
    appearance?: ('primary' | 'line' | 'text') | null
  }
}

const classFor = (a?: string | null) => (a === 'primary' ? 'btn btn-primary' : a === 'text' ? 'link-u' : 'btn btn-line')

/* Button (design-system/components/Button): primary, line, text. Labels end in → where the action leads somewhere. */
export const Actions: React.FC<{ items?: Action[] | null; className?: string; style?: React.CSSProperties }> = ({
  items,
  className = 'actions',
  style,
}) => {
  if (!items?.length) return null
  return (
    <div className={className} style={style}>
      {items.map((a, i) => (
        <Link
          className={classFor(a.link.appearance)}
          href={linkHref(a.link as Parameters<typeof linkHref>[0])}
          key={a.id ?? i}
          {...(a.link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
        >
          {a.link.label}
        </Link>
      ))}
    </div>
  )
}
