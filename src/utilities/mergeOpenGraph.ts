import type { Metadata } from 'next'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  siteName: 'K7 CyberSecurity',
  title: 'K7 CyberSecurity',
  description: 'K7 Seventh Sense: a unified endpoint-to-SOC security platform, built and supported in-house since 1991.',
  locale: 'en_IN',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => ({
  ...defaultOpenGraph,
  ...og,
})
