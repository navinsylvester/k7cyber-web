import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
import { redirects } from './redirects'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

const nextConfig: NextConfig = {
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'],
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    qualities: [100],
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        }
      }),
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  // Support portal: case attachments travel through server actions (5 MB, Dataverse's default note limit) plus form overhead.
  // The dev server reached through a Cloudflare quick tunnel (docs/support-portal/11-staging-readiness.md §7): the tunnel
  // rewrites Host to localhost:3000, so server-action posts arrive with a browser origin that differs from the host, and Next
  // blocks its own dev assets for any origin it was not started on; both need the tunnel's domain listed.
  experimental: {
    serverActions: { bodySizeLimit: '6mb', allowedOrigins: ['*.trycloudflare.com'] },
  },
  allowedDevOrigins: ['*.trycloudflare.com'],
  redirects,
  // The partner portal's pages and files (docs/partner-portal/05-staging-and-go-live.md §4): framed only by the site itself (a
  // same-origin frame is how a phone width is checked in development), never sniffed, the
  // referrer cut to the origin, no device access. TLS and Strict-Transport-Security belong to the host in front of the app.
  // `/support` can take the same lines when its own hardening pass comes.
  headers: async () => [
    {
      source: '/partners/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      ],
    },
    {
      source: '/api/partners/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Cache-Control', value: 'no-store' },
      ],
    },
  ],
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
