import type { RequiredDataFromCollectionSlug } from 'payload'

export type PageData = RequiredDataFromCollectionSlug<'pages'>
export type FormData = RequiredDataFromCollectionSlug<'forms'>

const slugify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const p = (name: string) => `/${slugify(name)}`

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

export const mdrPage: PageData = {
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

const cta = (paragraph: string, actions: ReturnType<typeof custom>[], headline = 'Security that answers to you.') => ({
  blockType: 'ctaSheet' as const,
  tabLabel: 'Next step',
  headline,
  paragraph,
  actions,
})
const names = (list: string[]) => list.map((name) => ({ name }))
const texts = (list: string[]) => list.map((text) => ({ text }))

/* ---------------- Home ---------------- */
const homePage: PageData = {
  title: 'K7 Seventh Sense',
  slug: 'home',
  _status: 'published',
  meta: {
    title: 'Unified Endpoint-To-SOC Security Platform – K7 CyberSecurity',
    description: 'K7 Seventh Sense is a Unified Endpoint-To-SOC Security Platform that connects intelligence across endpoints, identities, data, vulnerabilities and behaviour.',
  },
  layout: [
    {
      blockType: 'homeHero',
      metaLeft: 'The brief',
      liveLabel: 'Threat lab live · Chennai',
      line1: 'Beyond',
      line2: 'the',
      line3: 'obvious.',
      redactNote: '↳ Redacted. Hover or tap to read',
      lede: '**K7 Seventh Sense** is a unified endpoint-to-SOC security platform. It connects intelligence across endpoints, identities, data, vulnerabilities and behaviour, so your organisation can make cybersecurity simpler and trustable.',
      actions: [custom('Request demo →', '/contact-us', 'primary'), custom('Explore platform', '#modular')],
      log: texts([
        '14:02:11 IST / Trojan.Win32.Agent / quarantined',
        '14:02:14 IST / CVE-2026-62820 / patched on 1,284 hosts',
        '14:02:19 IST / DLP / USB write blocked, Chennai-HQ-0412',
        '14:02:23 IST / IAM / privileged login outside policy, held',
      ]),
    },
    {
      blockType: 'intro',
      tabLabel: 'The puzzle',
      ground: 'panel',
      headline: 'Too many tools.',
      dimClause: 'Not enough people.',
      lede: 'Cybersecurity is getting lost in a complex puzzle of technologies and reports, with too many tools and not enough qualified people.',
      paragraphs: texts([
        'K7 Seventh Sense is a unified endpoint-to-SOC security platform that was created to solve this puzzle. Our platform goes beyond the obvious to understand security by connecting intelligence across **endpoints, identities, data, vulnerabilities** and **behaviour**, to help enterprises make cybersecurity simpler and trustable.',
      ]),
      specs: [
        { label: 'Agentic SOC', value: 'Simplified cybersecurity' },
        { label: 'Platform', value: 'Where it all lives' },
        { label: 'Sensor', value: 'Proprietary, unified' },
      ],
    },
    {
      blockType: 'capabilityRows',
      tabLabel: 'Capabilities',
      ground: 'panel',
      headline: 'Four capabilities.',
      lede: 'What the platform does across the estate, and what each capability covers.',
      rows: [
        { icon: 'screen', title: 'Comprehensive Infrastructure Protection', text: 'Prevention, detection and response across your IT ecosystem.', tags: names(['Endpoints', 'Servers', 'Operational technology', 'Network', 'Mobile devices', 'Cloud']) },
        { icon: 'lock', title: 'Security for Sensitive Data', text: 'Complete control over where data lives and moves.', tags: names(['Data loss prevention', 'Compliance-oriented reporting']) },
        { icon: 'hex', title: 'Multi-OS Patch Management', text: 'Close vulnerabilities before they can be exploited.', tags: names(['Vulnerability identification', 'Automated patching']) },
        { icon: 'ledger', title: 'Integrated Compliance', text: 'With one platform, compliance is continuous, auditable and mapped to the frameworks that matter.', tags: names(['DPDP', 'PCI DSS', 'ISO 27001', 'GDPR', 'CBUAE', 'ADHICS']) },
      ],
    },
    {
      blockType: 'moduleGrid',
      tabLabel: 'The platform',
      ground: 'paper',
      headline: 'Modular by design.',
      dimClause: 'Switch on what you need.',
      lede: 'Switch on capabilities as required, managed from the same console. Every module runs on the same proprietary agent.',
      groups: [
        {
          items: [
            { icon: 'certificate', name: 'EPS', on: true, line: 'Unified endpoint security, light on hardware and network resources.' },
            { icon: 'document', name: 'Data Loss Protection', line: 'Protect the crown jewels of enterprise data.' },
            { icon: 'key', name: 'Identity and Access Management', line: 'Access governance and identity lifecycle management.' },
            { icon: 'surface', name: 'EDR', on: true, line: 'Centralised visibility and control over enterprise infrastructure.' },
            { icon: 'hex', name: 'Patch Management', line: 'Automated, cross-platform closing of patching gaps.' },
            { icon: 'devices', name: 'Advanced Endpoint Management', line: 'Identify, provision and secure every device in the network.' },
            { icon: 'grid', name: 'XDR', on: true, line: 'Centralised control over applications, devices, networks and cloud accounts.' },
            { icon: 'bars', name: 'Agentic SOC', line: 'Autonomous, proactive, machine-speed security operations.' },
            { icon: 'archive', name: 'Log Retention', line: 'Short-term and archival log storage for compliance and analysis.' },
            { icon: 'beacon', name: 'MDR', on: true, line: 'Real-time cybersecurity posture improvement, managed by K7.' },
            { icon: 'shield', name: 'File Security Monitoring', line: 'File inspection engine that sanitises every uploaded file.' },
          ],
        },
      ],
      legend: true,
      legendLinkLabel: 'Explore K7 Seventh Sense →',
      legendLinkUrl: '/k7-seventh-sense',
    },
    {
      blockType: 'indexRows',
      tabLabel: 'Industries',
      ground: 'contrast',
      headline: 'Built for your industry.',
      lede: 'Seven sectors, one platform: protection and the compliance frameworks each regulator expects of you.',
      numbered: true,
      pattern: true,
      rows: [
        { title: 'BFSI', description: 'Cybersecurity solutions that enable compliance for BFSI enterprises. PCI DSS · RBI · SEBI · DPDP · CBUAE · SAMA', link: { type: 'custom', url: '/bfsi' } },
        { title: 'Education', description: 'Campus cybersecurity and compliance for institutions of higher learning. PCI DSS · DPDP', link: { type: 'custom', url: '/education' } },
        { title: 'Government', description: 'Cybersecurity and compliance for organisations that drive national and economic development. PCI DSS · DPDP', link: { type: 'custom', url: '/government' } },
        { title: 'Healthcare', description: 'Securing operations and maintaining compliance for healthcare organisations. PCI DSS · DPDP · ADHICS · NABIDH', link: { type: 'custom', url: '/healthcare' } },
        { title: 'Manufacturing', description: 'Reinforcing cybersecurity and maintaining compliance in manufacturing facilities. PCI DSS · DPDP', link: { type: 'custom', url: '/manufacturing' } },
        { title: 'Professional Services', description: 'Cybersecurity and compliance enablement for IT/ITES enterprises. GDPR · PCI DSS · ISO 27001 · ISO 22301 · DPDP · RBI · SEBI · CBUAE · SAMA · ADHICS · NABIDH', link: { type: 'custom', url: '/professional-services' } },
        { title: 'Retail', description: 'Cybersecurity and compliance reinforcement for large-format retail. PCI DSS · DPDP', link: { type: 'custom', url: '/retail' } },
      ],
    },
    {
      blockType: 'intro',
      tabLabel: 'Why K7',
      ground: 'panel',
      headline: 'Trust is earned.',
      dimClause: 'Every day.',
      lede: 'We believe trust must be earned through accountability.',
      facts: [
        { k: 'Since', v: '1991, building our own security technology in-house' },
        { k: 'Partner', v: 'One accountable partner for your data, operations and reputation' },
        { k: 'Promise', v: 'Being there when security matters most' },
      ],
      paragraphs: texts([
        'Organisations do not just buy security technology. They entrust a partner with their data, operations, reputation and business continuity.',
        'We build cybersecurity around one responsibility: protecting our customers and being there when security matters most.',
        'When you trust K7 CyberSecurity, you gain a single accountable partner focused on **customer-centricity, trust and accountability**.',
      ]),
      actions: [custom('About K7 →', '/about-k7', 'text')],
    },
    {
      blockType: 'featurePanels',
      tabLabel: 'The record',
      ground: 'paper',
      headline: 'Globally recognised',
      dimClause: 'cyberthreat research.',
      lede: "K7 Labs is one of the world's leading antimalware research and threat intelligence centres, analysing hundreds of thousands of malware samples every day.",
      panels: [
        {
          media: 'placeholder',
          caption: 'Image · AMTSO award',
          ratio: '4/3',
          label: 'AMTSO',
          title: 'Real Time Threat List Contributor of the Year',
          text: "Awarded by the Anti-Malware Testing Standards Organization for K7 Labs' contribution to the industry's shared real-time threat list.",
          links: [custom('About K7 Labs →', '/research', 'text')],
          onPanel: true,
        },
        {
          media: 'cover',
          cover: { brand: 'K7 Labs', series: 'Cyber Threat Monitor', period: 'Q3', year: '2026', footLeft: 'July to September', footRight: 'Report' },
          label: 'K7 Labs',
          title: 'K7 Cyber Threat Monitor Report',
          text: 'The quarterly record of what our telemetry saw, what we analysed and what we stopped, across regions, sectors and platforms.',
          links: [custom('View reports →', '/research')],
          onPanel: true,
        },
      ],
      stats: [
        { n: '30+ years', d: 'Multi-decade antimalware expertise' },
        { n: 'Millions of devices', d: 'Extensive sources of telemetry' },
        { n: '27 countries', d: 'Geographically distributed threat intelligence' },
      ],
    },
    {
      blockType: 'testimonials',
      tabLabel: 'Customers',
      ground: 'panel',
      headline: 'In their words.',
      lede: 'What the organisations we protect say about working with K7.',
      items: [
        { quote: "We engaged K7 Cyber Security to audit our compliance with CBUAE's IT guidelines on Business Continuity Management and Information Security. We are extremely pleased with the approach, methodology and professionalism demonstrated by the team from K7.", name: 'Arun Henry', company: 'Hadi Express Exchange', tag: 'CBUAE audit' },
        { quote: 'K7 gave us one console for endpoints, patching and compliance reporting. Our audit preparation went from weeks to days.', name: 'Placeholder Customer', company: 'Second testimonial from the content doc', tag: 'Testimonial 2' },
        { quote: 'The K7 team understood our sector and our regulators before they understood our network, which is the right way round.', name: 'Placeholder Customer', company: 'Third testimonial from the content doc', tag: 'Testimonial 3' },
      ],
    },
    cta('One accountable partner for protection, compliance and response. Tell us about your organisation and a K7 engineer will get in touch.', [
      custom('Enquire →', '/contact-us', 'primary'),
      custom('Request demo', '/contact-us'),
      custom('Explore the platform →', '/k7-seventh-sense', 'text'),
    ]),
  ],
}

/* ---------------- Platform ---------------- */
const platformPage: PageData = {
  title: 'K7 Seventh Sense',
  slug: 'k7-seventh-sense',
  _status: 'published',
  meta: { title: 'K7 Seventh Sense | Agentic unified cybersecurity platform', description: 'An agentic unified cybersecurity platform that separates the signal from the noise to surface every threat and close every compliance gap.' },
  layout: [
    {
      blockType: 'pageBanner',
      metaLeft: 'Platform · K7 Seventh Sense',
      metaRight: 'Agentic unified cybersecurity platform',
      lede: 'Beyond the obvious. An agentic unified cybersecurity platform that separates the signal from the noise to surface every threat and close every compliance gap.',
      actions: [custom('Request demo →', '/contact-us', 'primary'), custom('View brochure', '#the-platform')],
    },
    {
      blockType: 'featurePanels',
      tabLabel: 'The platform',
      ground: 'panel',
      headline: 'One platform.',
      dimClause: 'Endpoint to SOC.',
      lede: 'Most cybersecurity tools are designed to detect one part of the problem: an endpoint event, an identity anomaly, a data movement or a threat. Real risk often lies in the connections between them.',
      panels: [
        {
          media: 'placeholder',
          caption: 'Animation · Unified endpoint-to-SOC',
          ratio: '4/3',
          label: 'Unified Endpoint-To-SOC Security Platform',
          title: 'Isolated events, connected.',
          text: 'K7 Seventh Sense goes beyond the obvious to understand security. By connecting intelligence across endpoints, identities, data, vulnerabilities and behaviour, it goes beyond isolated security events to reveal the bigger picture, helping enterprises understand risk earlier, respond faster and stay ahead as threats evolve.',
          bullets: texts(['Endpoints, identities, data, vulnerabilities and behaviour, connected', 'One proprietary agent, one console', 'Switch on capabilities as you need them']),
          links: [custom('View brochure →', '#the-platform', 'text')],
          onPanel: false,
        },
      ],
    },
    {
      blockType: 'moduleGrid',
      tabLabel: 'Modules',
      ground: 'paper',
      headline: 'Modular by design.',
      lede: 'Start with the core security solutions and switch on capabilities as you need them. Every module runs on the same proprietary agent and appears in the same console.',
      groups: [
        {
          label: 'Solutions',
          note: '04 · Core',
          items: [
            { icon: 'beacon', name: 'MDR', on: true, line: 'Real-time cybersecurity posture improvement for digitally-enabled organisations.', url: '/seventh-sense-mdr' },
            { icon: 'grid', name: 'XDR', on: true, line: 'Centralised control over applications, devices, networks and cloud accounts.', url: p('K7 Seventh Sense XDR') },
            { icon: 'surface', name: 'EDR', on: true, line: 'Endpoint protection with visibility and control over enterprise digital infrastructure.', url: p('K7 Seventh Sense EDR') },
            { icon: 'certificate', name: 'EPS', on: true, line: 'Endpoint security that is light on hardware and network resources.', url: p('K7 Seventh Sense EPS') },
          ],
        },
        {
          label: 'Addons',
          note: '07 · Switch on when needed',
          compact: true,
          items: [
            { icon: 'document', name: 'DLP', line: 'Content-aware real-time data use monitoring.', url: '/k7-data-loss-protection' },
            { icon: 'key', name: 'IAM', line: 'Centralised identity management and session monitoring.', url: p('K7 Identity and Access Management') },
            { icon: 'hex', name: 'Patch Management', line: 'Vulnerability patching, for every OS.', url: p('K7 Patch Management') },
            { icon: 'devices', name: 'Advanced Endpoint Management', line: 'Personal and corporate device management.', url: p('K7 Advanced Endpoint Management') },
            { icon: 'bars', name: 'Agentic SOC', line: 'Autonomous 24/7 operations.', url: p('K7 Agentic SOC') },
            { icon: 'archive', name: 'Log Retention', line: 'Searchable log history.', url: p('K7 Log Retention') },
            { icon: 'shield', name: 'File Security Monitoring', line: 'Scanning and content disarmament of uploaded files.', url: p('K7 File Security Monitoring') },
          ],
        },
      ],
      actions: [custom('Request demo', '/contact-us'), custom('Compare the modules →', '/seventh-sense-mdr#modules', 'text')],
    },
    {
      blockType: 'featurePanels',
      tabLabel: 'Industry focus',
      ground: 'contrast',
      headline: 'Industry focus.',
      lede: "Built to match your sector's risk profile and compliance requirements, backed by experts who understand the nuances of each industry's regulatory and threat landscapes.",
      panels: [
        {
          media: 'none',
          label: '01 · Expanded',
          title: 'BFSI',
          text: 'Protection for PII and sensitive enterprise data, banking applications and APIs.',
          links: [custom('Learn more →', '/bfsi', 'text')],
          aside: { listLabel: 'Key capabilities', list: texts(['Unified cybersecurity platform', 'Network security for distributed operations', 'VAPT and GRC services']), tagsLabel: 'Compliance', tags: names(['CBUAE', 'RBI', 'SAMA', 'SEBI', 'DPDP', 'PCI DSS']) },
          onPanel: true,
        },
      ],
      rows: [
        { title: 'Education', description: 'Protection for PII and institutional applications. DPDP · PCI DSS', url: '/education' },
        { title: 'Government', description: 'Protection for PII and government applications. DPDP · PCI DSS', url: '/government' },
        { title: 'Healthcare', description: 'Protection for PPI and PII, and healthcare applications. DPDP · ADHICS · NABIDH · PCI DSS', url: '/healthcare' },
        { title: 'Manufacturing', description: 'Protection for PII, intellectual property and production applications. DPDP · PCI DSS', url: '/manufacturing' },
        { title: 'IT/ITES', description: 'Data breach protection with security for PII, applications and APIs. DPDP · GDPR · UAE IA · CBUAE · RBI · PCI DSS · SAMA · SEBI · ADHICS · NABIDH · ISO 9001 · ISO 22301 · ISO 27001', url: '/professional-services' },
        { title: 'Retail', description: 'Protection for PII and business records, retail applications and APIs. DPDP · PCI DSS', url: '/retail' },
      ],
      rowArrow: '+',
    },
    {
      blockType: 'publicationRows',
      tabLabel: 'Insight',
      ground: 'panel',
      headline: 'Insight.',
      lede: 'A whitepaper, a case study and a note from K7 Labs on what the platform does in practice.',
      rows: [
        { icon: 'archive', title: 'The Unified Security Platform Imperative', source: 'k7computing.com', kind: 'Whitepaper · PDF', url: 'https://www.k7computing.com/in/pdf/K7-Whitepaper-The-Unified-Security-Platform-Imperative.pdf' },
        { icon: 'document', title: 'Multinational Bank', source: 'k7computing.com', kind: 'Case study · PDF', url: 'https://www.k7computing.com/in/pdf/K7-Case-Study-Multinational-Bank.pdf' },
        { icon: 'surface', title: 'How K7 Stops Remote Ransomware with Deception Technology', source: 'blog.k7computing.com', kind: 'Blog · K7 Labs', url: 'https://blog.k7computing.com/how-k7-stops-remote-ransomware-with-deception-technology/' },
      ],
    },
    cta('Request a demo and a K7 engineer will walk you through K7 Seventh Sense on your own endpoints, identities and data.', [custom('Request demo →', '/contact-us', 'primary'), custom('View brochure', '#the-platform'), custom('K7 vs CrowdStrike →', '/k7-vs-crowdstrike', 'text')], 'See it on your estate.'),
  ],
}

/* ---------------- Addon: DLP ---------------- */
const dlpPage: PageData = {
  title: 'K7 Data Loss Protection',
  slug: 'k7-data-loss-protection',
  _status: 'published',
  meta: { title: 'K7 Data Loss Protection | K7 Seventh Sense add-on', description: 'Protect the crown jewels of enterprise data: file integrity monitoring, screen capture protection, content-aware data protection and encryption.' },
  layout: [
    { blockType: 'pageBanner', metaLeft: 'Platform · Addons', metaRight: 'Data loss protection', lede: 'Protect the crown jewels of enterprise data.', actions: [custom('Enquire →', '/contact-us', 'primary'), custom('The platform', '/k7-seventh-sense')] },
    {
      blockType: 'intro',
      tabLabel: 'Overview',
      ground: 'panel',
      headline: 'Volume, velocity, variety.',
      lede: 'The volume, velocity and variety of data generated by data-driven organisations have emphasised the need for secure data storage and access, to protect both Personally Identifiable Information (PII) and confidential business information.',
      paragraphs: texts(['K7 Data Loss Protection ensures critical enterprise data assets are protected from unauthorised access and modification, avoiding penalties for non-compliance with data security regulations and loss of competitive advantage.']),
    },
    {
      blockType: 'capabilityRows',
      tabLabel: 'Highlights',
      ground: 'paper',
      headline: 'Highlights.',
      lede: 'Four controls over where data lives, moves and is shown.',
      rows: [
        { icon: 'document', title: 'File Integrity Monitoring', text: 'Real-time and scheduled monitoring of files and directories, and Windows Registry monitoring.' },
        { icon: 'screen', title: 'Screen Capture Protection', text: 'Screen capture control prevents recording of sensitive data displayed on screens.' },
        { icon: 'certificate', title: 'Content-Aware Data Protection', text: 'Content-aware protection with country-based PII security, print control, and monitoring of data shared with AI.' },
        { icon: 'lock', title: 'Encryption', text: 'Full disk encryption with key management, key rotation, and central encryption enforcement.' },
      ],
    },
    {
      blockType: 'capabilityRows',
      tabLabel: 'Benefits',
      ground: 'contrast',
      headline: 'Benefits.',
      lede: 'What the add-on changes for the organisation and its auditors.',
      rows: [
        { icon: 'ledger', title: 'Regulatory requirements', text: 'Adherence to **regulatory requirements**.' },
        { icon: 'devices', title: 'Stolen or misplaced devices', text: 'Protection of data on **stolen or misplaced devices**.' },
        { icon: 'archive', title: 'Attribution tracking', text: 'Auditable data modification **attribution tracking**.' },
        { icon: 'key', title: 'Encryption integrity', text: 'Maintenance of **encryption integrity**.' },
      ],
    },
    cta('Tell us where your sensitive data lives and a K7 engineer will come back with how Data Loss Protection would cover it.', [custom('Enquire →', '/contact-us', 'primary'), custom('See the platform', '/k7-seventh-sense')]),
  ],
}

/* ---------------- Industry: BFSI ---------------- */
const bfsiPage: PageData = {
  title: 'Cybersecurity for BFSI',
  slug: 'bfsi',
  _status: 'published',
  meta: { title: 'Cybersecurity for BFSI | K7 CyberSecurity', description: 'Cybersecurity solutions that enable compliance for BFSI enterprises: PCI DSS, RBI, SEBI, DPDP, CBUAE and SAMA.' },
  layout: [
    { blockType: 'pageBanner', metaLeft: 'Solutions · Industry', metaRight: 'BFSI', lede: 'Cybersecurity solutions that enable compliance for BFSI enterprises.', actions: [custom('Enquire →', '/contact-us', 'primary'), custom('The platform', '/k7-seventh-sense')] },
    {
      blockType: 'intro',
      tabLabel: 'Overview',
      ground: 'panel',
      headline: 'Interlocking requirements.',
      lede: 'The BFSI sector faces stringent cybersecurity regulations and stakeholder expectations on data security and operational reliability: avoid cyberattacks, and maintain compliance with regulations.',
      paragraphs: texts(["K7's BFSI practice delivers the technology, services and knowhow required to protect the BFSI industry and maintain compliance with regulations spanning multiple regions."]),
    },
    {
      blockType: 'capabilityRows',
      tabLabel: 'Threats',
      ground: 'paper',
      headline: 'The threat stops here.',
      lede: 'Eight things K7 does for BFSI.',
      rows: [
        { icon: 'lock', title: 'Protect Data', text: 'Prevent data breaches and avoid compromise of PII and other sensitive data.' },
        { icon: 'certificate', title: 'Secure Banking Applications', text: 'Ensure financial applications can withstand compromise attempts.' },
        { icon: 'key', title: 'Prevent User Impersonation', text: 'Prevent unauthorised users from gaining access to enterprise digital assets.' },
        { icon: 'network', title: 'Secure APIs', text: 'Prevent integrations from opening the doors to cyberattacks.' },
        { icon: 'pulse', title: 'Maintain Transaction Integrity', text: 'Ensure bulletproof payment systems and protocols.' },
        { icon: 'archive', title: 'Log Retention', text: 'Capture and retain logs for real-time and archived analysis and compliance.' },
        { icon: 'devices', title: 'Flexible Deployment', text: 'On-premises and cloud deployment options to suit technical and compliance requirements.' },
        { icon: 'beacon', title: 'Rapid Response', text: 'Quickly contain and mitigate in the event of a cybersecurity event.' },
      ],
    },
    {
      blockType: 'panelGrid',
      tabLabel: 'Solutions',
      ground: 'contrast',
      headline: 'Solutions for BFSI.',
      lede: 'Platform, network, services and the compliance they map to.',
      minWidth: 280,
      cells: [
        { label: 'Platform', title: 'K7 Seventh Sense', text: "An agentic unified platform that integrates all elements of a BFSI enterprise's digital infrastructure.", listStyle: 'plain', tagGroups: [{ tags: names(['MDR', 'XDR', 'EPS', 'EDM', 'SOC', 'SIEM', 'SOAR', 'IAM', 'UEBA']) }], linkLabel: 'Explore →', linkUrl: '/k7-seventh-sense' },
        { label: 'Network security', title: 'Gateway to cloud', text: 'Gateway security and secure communication between branches, headquarters and the cloud.', listStyle: 'plain', list: texts(['K7 SD-WAN', 'K7 Next Generation Firewall', 'K7 VPN Concentrator', 'K7 Connect 500']), linkLabel: 'Explore →', linkUrl: '/solutions/network' },
        { label: 'Services', title: 'Posture improvement', text: 'Cybersecurity posture improvement through monitoring and assessments conducted by experts.', listStyle: 'plain', list: texts(['Cyber Defence Assessment', 'Red Team Assessment', 'Vulnerability Assessment and Penetration Testing', 'Governance, Risk and Compliance', 'Information Security Assurance Programme', 'Incident Response', 'Threat Intel Feed Service']), linkLabel: 'Explore →', linkUrl: '/services' },
        { label: 'Compliance', title: 'Three jurisdictions', listStyle: 'plain', tagGroups: [{ label: 'Global', tags: names(['PCI DSS']) }, { label: 'India', tags: names(['RBI Guidelines', 'SEBI Guidelines', 'DPDP Act']) }, { label: 'Middle East', tags: names(['CBUAE Regulations', 'SAMA Regulations']) }] },
      ],
      actions: [custom('Enquire', '/contact-us')],
    },
    {
      blockType: 'testimonials',
      tabLabel: 'Customers',
      ground: 'panel',
      headline: 'In their words.',
      lede: 'A BFSI customer on the CBUAE audit.',
      items: [{ quote: "We pride ourselves on maintaining the highest standards in the transfer of funds, as even a single mishap will destroy customer trust. We engaged K7 Cyber Security to audit our compliance with CBUAE's IT guidelines on Business Continuity Management and Information Security, and are extremely pleased with the approach, methodology and professionalism demonstrated by the team from K7.", name: 'Arun Henry', company: 'Hadi Express Exchange', tag: 'CBUAE audit' }],
    },
    {
      blockType: 'publicationRows',
      tabLabel: 'Insight',
      ground: 'paper',
      headline: 'K7 Enterprise Insight.',
      lede: 'Reading for the sector: one blog and two case studies.',
      rows: [
        { icon: 'surface', title: 'Cyberattacks: What The BFSI Sector Should Know And Do', source: 'blog.k7computing.com', kind: 'Blog · K7 Labs', url: 'https://blog.k7computing.com/cyberattacks-what-the-bfsi-sector-should-know-and-do/' },
        { icon: 'document', title: 'Multinational Bank', source: 'k7computing.com', kind: 'Case study · PDF', url: 'https://www.k7computing.com/in/pdf/K7-Case-Study-Multinational-Bank.pdf' },
        { icon: 'document', title: 'Moneyratna Group', source: 'k7computing.com', kind: 'Case study · PDF', url: 'https://www.k7computing.com/in/pdf/K7-Case-Study-Moneyratna-Group.pdf' },
      ],
    },
    cta('Tell us about your institution and the regulators you answer to, and a K7 engineer will come back with a plan.', [custom('Enquire →', '/contact-us', 'primary'), custom('See the platform', '/k7-seventh-sense')]),
  ],
}

/* ---------------- Service: GRC ---------------- */
const grcPage: PageData = {
  title: 'K7 GRC',
  slug: 'k7-grc',
  _status: 'published',
  meta: { title: 'K7 GRC | Governance, risk and compliance consulting', description: 'Optimise digital transformation of infrastructure and processes to enhance enterprise governance, risk management and compliance.' },
  layout: [
    { blockType: 'pageBanner', metaLeft: 'Services · Consulting', metaRight: 'Governance, risk and compliance', lede: 'Optimise digital transformation of infrastructure and processes to enhance enterprise governance, risk management and compliance.', actions: [custom('Enquire →', '/contact-us', 'primary'), custom('View brochure', 'https://www.k7computing.com/in/pdf/k7-grc.pdf')] },
    {
      blockType: 'intro',
      tabLabel: 'Overview',
      ground: 'panel',
      headline: 'Strategy, not paperwork.',
      lede: "The K7 Governance, Risk and Compliance Consulting team leverages K7's multi-decade expertise as a cybersecurity provider to analyse an organisation's digital infrastructure, policies and processes, to achieve enterprise-wide strategic objectives and avoid operational inefficiency, cost escalation, cybersecurity gaps and non-compliance penalties.",
      notice: '**K7 is empanelled by CERT-In** for providing Information Security Auditing Services.',
    },
    {
      blockType: 'capabilityRows',
      tabLabel: 'Benefits',
      ground: 'paper',
      headline: 'Benefits.',
      lede: 'Two kinds of risk, managed.',
      rows: [
        { icon: 'pulse', title: 'Financial Risk Management', text: 'Identify security gaps in financial processes that could result in financial malfeasance and leakage of funds.' },
        { icon: 'ledger', title: 'Operational Risk Management', text: 'Policies, standard operating procedures, operation manuals and cybersecurity training to ensure security policies and standards are maintained.' },
      ],
    },
    {
      blockType: 'panelGrid',
      tabLabel: 'Focus areas',
      ground: 'contrast',
      headline: 'Focus areas.',
      lede: 'Infrastructure, process and compliance, in that order.',
      minWidth: 300,
      cells: [
        { label: '01 · Infrastructure', text: 'K7 GRC evaluates enterprise digital infrastructure by:', listStyle: 'steps', list: texts(['Conducting information security audits', 'Performing Vulnerability Assessment and Penetration Testing', 'Verifying digital communication integrity', 'Assessing cybersecurity risk from Bring Your Own Device (BYOD) and Shadow IT']) },
        { label: '02 · Process', text: 'K7 GRC assesses digital business processes for:', listStyle: 'steps', list: texts(['Adherence to industry best practices', 'Adherence to internal standards and policies', 'Use of appropriate technologies and protocols', 'Hardware and software lifecycle management', 'Business continuity management']) },
        { label: '03 · Compliance', text: 'K7 GRC analyses organisational compliance with regulations spanning multiple industries and jurisdictions.', listStyle: 'steps', tagGroups: [{ label: 'Finance', tags: names(['PCI DSS', 'SAMA', 'Central Bank Compliance']) }, { label: 'Healthcare', tags: names(['ADHICS', 'NABIDH']) }, { label: 'ISO', tags: names(['ISO 9001', 'ISO 22301', 'ISO 27001']) }, { label: 'Data protection', tags: names(['GDPR', 'UAE Information Assurance Regulation', 'DPDP Act']) }] },
      ],
    },
    cta('Tell us about your organisation and the regulations it answers to, and a K7 GRC consultant will get in touch.', [custom('Enquire →', '/contact-us', 'primary'), custom('View brochure', 'https://www.k7computing.com/in/pdf/k7-grc.pdf')]),
  ],
}

export const pages: PageData[] = [homePage, platformPage, mdrPage, dlpPage, bfsiPage, grcPage]
