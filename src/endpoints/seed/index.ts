import type { Payload, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'

type PageData = RequiredDataFromCollectionSlug<'pages'>

/* Seeds the K7 site: the header menu and footer from the content doc, a home placeholder, and the
   K7 Seventh Sense MDR product page as designed in designs/product/Product-MDR.dc.html. Re-runnable. */

const nav = (label: string, url: string) => ({ label, url })
const col = (label: string, url: string, items: [string, string][] = []) => ({ label, url, items: items.map(([l, u]) => nav(l, u)) })

const slugify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const p = (name: string) => `/${slugify(name)}`

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

const custom = (label: string, url: string, appearance: 'primary' | 'line' | 'text' = 'line') => ({
  link: { type: 'custom' as const, url, label, appearance },
})

const modules = [
  'EDR', 'XDR', 'Centralised Management', 'Next Generation Endpoint Protection', 'API & Access Control', 'Log Collection & Ingestion',
  'Detection Engine', 'Device & Application Control', 'Firewall & Web Control', 'Hunting & Response Essentials', 'Automated Response',
  'Investigation & Forensics', 'Container & Workload Security', 'Cloud & SaaS Telemetry', 'Compliance Mapping',
  'Configuration Assessment & Hardening', 'Vulnerability Visibility', 'Vulnerability Detection', 'Patch Management & Asset Discovery',
]
const addons = [
  'Patch Management', 'Log Retention', 'Immutable & Extended Retention', 'File Integrity Monitoring', 'Data Loss Protection (DLP)',
  'Content-Aware Data Protection', 'Encryption', 'Agentic SOC / AI & Agentic Security', 'Endpoint Remote Monitoring & Management',
  'Endpoint Device Management', 'Mobile Device Management', 'Identity and Access Management (IAM)',
  'Privilege Elevation and Delegation (PEDM)', 'Privileged Account and Session Management (PASM)', 'File Security Monitoring',
]

const mdrPage: PageData = {
  title: 'K7 Seventh Sense MDR',
  slug: 'seventh-sense-mdr',
  _status: 'published' as const,
  meta: {
    title: 'K7 Seventh Sense MDR | Managed Detection and Response',
    description: 'Real-time cybersecurity posture improvement for digitally-enabled organisations: continuous threat discovery, defence assessment and a unified command centre, managed by K7.',
  },
  layout: [
    {
      blockType: 'pageBanner' as const,
      metaLeft: 'Platform · Core',
      metaRight: 'Managed detection and response',
      lede: 'Real-time cybersecurity posture improvement for digitally-enabled organisations.',
      actions: [custom('Enquire →', '#next-step', 'primary'), custom('View brochure', '#modules')],
    },
    {
      blockType: 'intro' as const,
      tabLabel: 'Overview',
      ground: 'panel' as const,
      headline: 'A command centre.',
      dimClause: 'Until now, impossible.',
      lede: 'Enterprises are struggling to manage cybersecurity and compliance across a digital ecosystem of multiple platforms, solutions, services and devices, further complicated by the deployment of multiple cybersecurity solutions.',
      paragraphs: [
        { text: 'Creating a cybersecurity command centre with comprehensive event visibility and proactive threat mitigation across the organisation has been impossible to achieve, until now.' },
        { text: "K7 Seventh Sense MDR enables enterprises to keep pace with the constant evolution of the cyberthreat landscape through continuous threat discovery, defence assessment and cybersecurity posture improvement. Unifying your existing Security Operations Centre (SOC) with proprietary and third-party cybersecurity platforms, K7's services deliver what no single product or activity can: turnkey enterprise cybersecurity across internal and external operating environments." },
      ],
      figure: {
        label: 'How it fits together',
        caption: 'Fig. 01 · MDR architecture',
        cells: [
          { label: 'Response', items: ['Prevention', 'Remediation', 'Real-time detection'].map((name) => ({ name })) },
          { label: 'Services', items: ['Cyber Defence Assessment', 'Red Team Assessment', 'Threat Intel', 'VAPT', 'GRC', 'Information Security Assurance Programme', 'SOC'].map((name) => ({ name })) },
          { label: 'Unified by K7', highlight: true, title: 'K7 Seventh Sense' },
          { label: 'Platforms', items: ['EDR', 'SD-WAN', 'IAM', 'IDS', 'SIEM', 'SOAR'].map((name) => ({ name })) },
          { label: 'Outcomes', items: ['Visibility', 'Compliance', 'Reporting', 'Training'].map((name) => ({ name })) },
        ],
      },
      coverage: {
        label: 'Coverage',
        tags: ['Endpoints', 'Servers', 'Networks', 'Cloud', 'Wireless systems', 'IoT', 'Thick clients', 'Embedded systems', 'POS', 'SCADA', 'Directory services', 'Web applications', 'Mobile applications', 'APIs', 'Blockchain', 'AI', 'Social media', 'App stores', 'Dark web'].map((name) => ({ name })),
      },
    },
    {
      blockType: 'capabilityRows' as const,
      tabLabel: 'Benefits',
      ground: 'auto' as const,
      headline: 'What MDR changes.',
      lede: 'Nine outcomes of one managed service, for protection and for compliance.',
      rows: [
        { icon: 'surface', title: 'Attack Surface Monitoring', text: 'Integration of enterprise SOC, K7 Seventh Sense and third-party platforms for monitoring potential entry points.' },
        { icon: 'shield', title: 'Brand Security', text: 'Protection against impersonation on social media, app stores and other platforms.' },
        { icon: 'grid', title: 'Dual Scope', text: 'Unified service for both protection and compliance.' },
        { icon: 'beacon', title: 'Real-time Threat Detection', text: 'Proactive threat detection and mitigation through real-time processing of threat signals.' },
        { icon: 'bars', title: 'Smart Intervention', text: 'AI and ML based threat models provide the optimum remedial action.' },
        { icon: 'hex', title: 'MITRE ATT&CK Framework', text: 'Cyber defence analysis for protection against APT groups.' },
        { icon: 'certificate', title: 'Assured Compliance', text: 'Regulation-specific policy enforcement and platform security.' },
        { icon: 'pulse', title: 'Accelerated Threat Mitigation', text: 'Reduction in Mean-Time-To-Identify (MTTI) and Mean-Time-To-Response (MTTR).' },
        { icon: 'document', title: 'Investment Rationalisation', text: 'Capex and opex savings by avoiding investment in siloed solutions and talent.' },
      ],
      actions: [custom('Enquire', '#next-step')],
    },
    {
      blockType: 'featureMatrix' as const,
      tabLabel: 'Modules & addons',
      ground: 'contrast' as const,
      headline: 'Everything included.',
      lede: 'K7 Seventh Sense MDR carries every platform module and every add-on, managed by K7.',
      columnLabel: 'Included',
      groups: [
        { title: 'Modules', rows: modules.map((name) => ({ name, included: true })) },
        { title: 'Addons', rows: addons.map((name) => ({ name, included: true })) },
      ],
      actions: [custom('Enquire', '#next-step'), custom('View brochure →', '#modules', 'text')],
    },
    {
      blockType: 'indexRows' as const,
      tabLabel: 'Also in the core',
      ground: 'auto' as const,
      headline: 'Prefer to run it yourself?',
      lede: 'The same platform, without the managed service. Three core solutions on the same agent and console.',
      numbered: true,
      rows: [
        { title: 'K7 Seventh Sense XDR', description: 'AI-enhanced enterprise endpoint protection with XDR and centralised control over applications, devices, networks and cloud accounts.', link: { type: 'custom' as const, url: p('K7 Seventh Sense XDR') } },
        { title: 'K7 Seventh Sense EDR', description: 'Endpoint protection with EDR, delivering centralised visibility and control over enterprise digital infrastructure.', link: { type: 'custom' as const, url: p('K7 Seventh Sense EDR') } },
        { title: 'K7 Seventh Sense EPS', description: 'Unified endpoint security that is light on hardware and network resources, deployed on-premises or through the cloud.', link: { type: 'custom' as const, url: p('K7 Seventh Sense EPS') } },
      ],
    },
    {
      blockType: 'ctaSheet' as const,
      tabLabel: 'Next step',
      headline: 'Security that answers to you.',
      paragraph: 'Tell us about your estate and your SOC, and a K7 engineer will come back with how MDR would run across it.',
      actions: [custom('Enquire →', '#next-step', 'primary'), custom('View brochure', '#modules'), custom('Back to the platform →', '/k7-seventh-sense', 'text')],
    },
  ],
}

const homePage: PageData = {
  title: 'K7 Seventh Sense',
  slug: 'home',
  _status: 'published' as const,
  meta: { title: 'Unified Endpoint-To-SOC Security Platform – K7 CyberSecurity', description: 'K7 Seventh Sense is a Unified Endpoint-To-SOC Security Platform that connects intelligence across endpoints, identities, data, vulnerabilities and behaviour.' },
  layout: [
    {
      blockType: 'pageBanner' as const,
      metaLeft: 'K7 CyberSecurity',
      metaRight: 'Unified Endpoint-To-SOC Security Platform',
      lede: 'Cybersecurity is getting lost in a complex puzzle of technologies and reports. K7 Seventh Sense was created to solve it. The Home template follows; see the MDR product page for the first built template.',
      actions: [custom('K7 Seventh Sense MDR →', '/seventh-sense-mdr', 'primary'), custom('Request demo', '#next-step')],
    },
    {
      blockType: 'ctaSheet' as const,
      tabLabel: 'Next step',
      headline: 'Security that answers to you.',
      paragraph: 'Tell us about your estate and a K7 engineer will come back to you.',
      actions: [custom('Request demo →', '/contact-us', 'primary')],
    },
  ],
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

  for (const page of [homePage, mdrPage]) {
    await payload.delete({ collection: 'pages', req, where: { slug: { equals: page.slug } } })
    await payload.create({ collection: 'pages', req, data: page })
    payload.logger.info(`Seeded page /${page.slug}`)
  }

  payload.logger.info('Seeded K7 site content.')
}
