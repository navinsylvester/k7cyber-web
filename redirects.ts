import type { NextConfig } from 'next'

/* MG-05: permanent redirects from every labs.k7computing.com URL pattern to its new home under /research.
   One-off exceptions (duplicate slugs that merged) live in migration/redirects.csv and the Redirects collection. */
export const redirects: NextConfig['redirects'] = async () => {
  const r = (source: string, destination: string) => ({ source, destination, permanent: true })
  return [
    r('/index.php/vulnerability/:slug', '/research/vulnerability/:slug'),
    r('/index.php/virusthreat/:slug', '/research/top-threats/:slug'),
    r('/index.php/category/:path*', '/research/lab-blog/category/:path*'),
    r('/index.php/tag/:slug', '/research/lab-blog'),
    r('/index.php/lab-blog', '/research/lab-blog'),
    r('/index.php/vulnerability-information', '/research/vulnerability-information'),
    r('/index.php/top-threats', '/research/top-threats'),
    r('/index.php/k7-labs', '/research'),
    r('/index.php/about', '/research'),
    r('/index.php/sitemap', '/research'),
    r('/index.php/:slug', '/research/lab-blog/:slug'),
    r('/index.php', '/research'),
    r('/vulnerability/:slug', '/research/vulnerability/:slug'),
    r('/virusthreat/:slug', '/research/top-threats/:slug'),
    r('/lab-blog', '/research/lab-blog'),
    r('/vulnerability-information', '/research/vulnerability-information'),
    r('/top-threats', '/research/top-threats'),
    r('/threat-reports', '/research/threat-reports'),
  ]
}
