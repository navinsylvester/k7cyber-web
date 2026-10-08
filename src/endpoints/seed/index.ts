import type { Payload, PayloadRequest } from 'payload'

import { forms } from './forms'
import { pages } from './pages'
import { morePages } from './pages2'

/* Seeds the K7 site: the header menu and footer from the content doc, a home placeholder, and the
   K7 Seventh Sense MDR product page as designed in designs/product/Product-MDR.dc.html. Re-runnable. */

const nav = (label: string, url: string) => ({ label, url })
const col = (label: string, url: string, items: [string, string][] = []) => ({ label, url, items: items.map(([l, u]) => nav(l, u)) })

const p = (name: string) => `/${name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

const headerMenu = [
  {
    label: 'Platform',
    url: '/k7-seventh-sense',
    columns: [
      col('Core', '/k7-seventh-sense', [
        ['K7 Seventh Sense MDR', '/seventh-sense-mdr'],
        ['K7 Seventh Sense XDR', p('K7 Seventh Sense XDR')],
        ['K7 Seventh Sense EDR', p('K7 Seventh Sense EDR')],
        ['K7 Seventh Sense EPS', p('K7 Seventh Sense EPS')],
      ]),
      col('Addons', '/k7-seventh-sense#addons', [
        ['K7 Data Loss Protection', p('K7 Data Loss Protection')],
        ['K7 Identity and Access Management', p('K7 Identity and Access Management')],
        ['K7 Patch Management', p('K7 Patch Management')],
        ['K7 Advanced Endpoint Management', p('K7 Advanced Endpoint Management')],
        ['K7 Agentic SOC', p('K7 Agentic SOC')],
        ['K7 Log Retention', p('K7 Log Retention')],
        ['K7 File Security Monitoring', p('K7 File Security Monitoring')],
      ]),
    ],
  },
  {
    label: 'Solutions',
    url: '/solutions',
    columns: [
      col('Compliance Solutions', '/solutions/compliance', [['ADHICS', '/adhics'], ['CBUAE', '/cbuae'], ['DPDP', '/dpdp']]),
      col('File Security Solution', '/file-security-solution'),
      col('Industry Solutions', '/solutions/industry', [
        ['BFSI', '/bfsi'], ['Education', '/education'], ['Government', '/government'], ['Healthcare', '/healthcare'],
        ['Manufacturing', '/manufacturing'], ['Professional Services', '/professional-services'], ['Retail', '/retail'],
      ]),
      col('Network Security Solutions', '/solutions/network', [
        ['K7 SD-WAN', '/k7-sd-wan'], ['K7 Next Generation Firewall', '/k7-next-generation-firewall'],
        ['K7 VPN Concentrator', '/k7-vpn-concentrator'], ['K7 Connect 500', '/k7-connect-500'], ['K7 AAA', '/k7-aaa'],
      ]),
    ],
  },
  {
    label: 'Services',
    url: '/services',
    columns: [
      col('Consulting Services', '/services/consulting', [['K7 GRC', '/k7-grc'], ['K7 vCISO', '/k7-vciso'], ['K7 Enterprise Risk Management', '/k7-enterprise-risk-management'], ['K7 Incident Response', '/k7-incident-response']]),
      col('Security Assessment Services', '/services/assessment', [['K7 Cyber Defence Assessment', '/k7-cyber-defence-assessment'], ['K7 Red Team Assessment', '/k7-red-team-assessment'], ['K7 VAPT', '/k7-vapt']]),
      col('Managed Security Services', '/managed-security-services'),
      col('AI Security Services', '/services/ai', [['K7 AI Readiness Assessment', '/k7-ai-readiness-assessment'], ['K7 AI Maturity Assessment', '/k7-ai-maturity-assessment']]),
      col('K7 ISAP', '/k7-isap'),
    ],
  },
  { label: 'Partners', url: '/partners', columns: [] },
  {
    label: 'Resources',
    url: '/insight',
    columns: [
      col('Insight', '/insight'),
      col('Research', '/research'),
      col('Media Room', '/media-room', [['News', '/news'], ['Press Releases', '/press-releases'], ['Events', '/events'], ['Media Centre', '/media-centre']]),
    ],
  },
  {
    label: 'About Us',
    url: '/about-k7',
    columns: [col('About K7', '/about-k7'), col('Leadership', '/leadership'), col('Careers', '/careers'), col('Contact Us', '/contact-us')],
  },
  {
    label: 'Why K7',
    url: '/why-k7',
    columns: [col('Competitor Comparison', '/compare', [['K7 vs CrowdStrike', '/k7-vs-crowdstrike']]), col('Certifications', '/certifications'), col('Testimonials', '/testimonials')],
  },
  { label: 'Support', url: '/support', columns: [] },
]

const footer = {
  tagline: 'Security that answers to you. Superior cybersecurity since 1991, built and supported in-house.',
  columns: [
    { heading: 'Company', links: [nav('Home', '/'), nav('About Us', '/about-k7'), nav('Careers', '/careers'), nav('Contact Us', '/contact-us')] },
    { heading: 'Offer', links: [nav('Platform', '/k7-seventh-sense'), nav('Solutions', '/solutions'), nav('Services', '/services'), nav('Partners', '/partners')] },
    { heading: 'Resources', links: [nav('Insight', '/insight'), nav('Research', '/research'), nav('Media Room', '/media-room'), nav('Support', '/support')] },
    { heading: 'Legal', links: [nav('Privacy Policy', '/privacy-policy'), nav('EULA', '/eula')] },
  ],
  socials: [
    { code: 'in', name: 'LinkedIn', url: 'https://www.linkedin.com/company/k7-computing' },
    { code: 'X', name: 'X', url: 'https://x.com/k7computing' },
    { code: 'YT', name: 'YouTube', url: 'https://www.youtube.com/@K7Computing' },
    { code: 'IG', name: 'Instagram', url: 'https://www.instagram.com/k7computing' },
    { code: 'FB', name: 'Facebook', url: 'https://www.facebook.com/k7computing' },
  ],
  legal: '© 2026 K7 Enterprise Security Private Limited. All Rights Reserved.',
  offices: 'Chennai · Singapore · Dubai',
}

export const seed = async ({ payload, req }: { payload: Payload; req: PayloadRequest }): Promise<void> => {
  payload.logger.info('Seeding K7 site content...')

  await payload.updateGlobal({
    slug: 'header',
    req,
    data: {
      navItems: headerMenu,
      cta: { type: 'custom', url: '/contact-us', label: 'Request demo →' },
    },
  })
  await payload.updateGlobal({ slug: 'footer', req, data: footer })

  const formIds: Record<string, number> = {}
  // Forms are updated in place so existing submissions keep their reference.
  for (const form of forms) {
    const existing = await payload.find({ collection: 'forms', req, where: { title: { equals: form.title } }, limit: 1, pagination: false })
    const doc = existing.docs[0]
      ? await payload.update({ collection: 'forms', req, id: existing.docs[0].id, data: form })
      : await payload.create({ collection: 'forms', req, data: form })
    formIds[form.title] = doc.id
    payload.logger.info(`Seeded form "${form.title}"`)
  }

  for (const page of [...pages, ...morePages(formIds)]) {
    await payload.delete({ collection: 'pages', req, where: { slug: { equals: page.slug } } })
    await payload.create({ collection: 'pages', req, data: page })
    payload.logger.info(`Seeded page /${page.slug}`)
  }

  payload.logger.info('Seeded K7 site content.')
}
