import type { PageData } from './pages'

const custom = (label: string, url: string, appearance: 'primary' | 'line' | 'text' = 'line') => ({
  link: { type: 'custom' as const, url, label, appearance },
})
const lines = (list: string[]) => list.join('\n')

/* ---------------- Comparison: K7 vs CrowdStrike ---------------- */
const comparisonPage: PageData = {
  title: 'K7 vs CrowdStrike',
  slug: 'k7-vs-crowdstrike',
  _status: 'published',
  meta: { title: 'K7 vs CrowdStrike | K7 Seventh Sense compared with Falcon Insight XDR', description: 'K7 Seventh Sense compared with CrowdStrike Falcon Insight XDR, capability by capability: twelve criteria across four themes.' },
  layout: [
    { blockType: 'pageBanner', metaLeft: 'Why K7 · Competitor comparison', metaRight: 'K7 Seventh Sense vs CrowdStrike Falcon Insight XDR', lede: 'K7 Seventh Sense compared with CrowdStrike Falcon Insight XDR, capability by capability.', actions: [custom('Request demo →', '/contact-us', 'primary'), custom('Explore platform', '/k7-seventh-sense')] },
    {
      blockType: 'intro',
      tabLabel: 'Why K7',
      ground: 'panel',
      headline: 'Stops it. Undoes it. Proves it.',
      lede: 'CrowdStrike Falcon Insight XDR tells you what is vulnerable, but does not patch it; tells you what it detected, but not which regulation that evidences. Such capabilities require a handover to another tool, team or line on your budget.',
      paragraphs: [{ text: 'K7 Seventh Sense stops an attack, undoes it and proves it, from inside your own environment, on a fully proprietary platform, on a detection engine K7 builds and owns. K7 delivers what your Board and auditors want, with no handovers that require additional licences, specialists and costs.' }],
    },
    {
      blockType: 'comparisonTable',
      tabLabel: 'Comparison',
      ground: 'paper',
      headline: 'Twelve capabilities.',
      lede: 'Four themes, twelve criteria, and what each difference means for the organisation. ✔ is a capability; ✖ is a gap.',
      criterionHead: 'Capability',
      competitorHead: 'CrowdStrike Falcon Insight XDR',
      k7Head: 'K7 Seventh Sense',
      advantageHead: "K7's advantage",
      sections: [
        {
          title: 'Threat protection',
          subtitle: 'Knowing your exposure, stopping attacks, and containing them without stopping the business',
          rows: [
            { title: 'Knowing what you own, and what is actually protected', competitor: lines(['x Counts installed agents, not assets; cannot report the gap between agents and assets', 'x Agent does not cover phones and tablets', 'x Does not identify unregistered machines']), k7: lines(['Complete inventory of hardware, software, and what is actually running on every managed machine', 'Change tracking from the base licence', 'Unmanaged and network devices are discovered by a module of the same platform', 'What you own and what is vulnerable are one record; no reconciliation required']), advantage: lines(['Numbers provided to the Board correspond to numbers on the network', 'Security decisions and budgets reflect ground reality']) },
            { title: 'Stopping attacks, including ransomware, before they spread', competitor: lines(['Blocks malware and exploits on Windows, macOS and Linux', 'Isolates infected machines', 'Prevents ransomware spreading over SMB', 'x Does not perform file recovery']), k7: lines(['On-device detection protects even when the cloud link is interrupted', 'Multi-layered ransomware protection', 'Backed-up files are restored from the same console']), advantage: lines(['Attacks do not turn into business interruption', 'Unknown ransomware variants are identified and blocked', 'Backup restoration does not require a separate product or project']) },
            { title: 'Closing identified weaknesses', competitor: lines(['Lists vulnerabilities on Windows, macOS and Linux', 'Ranks likelihood of exploitation', 'x Does not fix; requires a separate product for patching']), k7: lines(['Exposure is visible from the base licence', 'Vulnerability detection flows from inventory, eliminating the scan window', 'Patching runs on that same console, administered by the same team']), advantage: lines(['Quick vulnerability mitigation, as finding and fixing are part of the same solution managed under the same team']) },
            { title: 'Accepting documents from external sources without risk', competitor: lines(['On-device file scanning', 'Cloud-based sandbox detonation (also offered on premises)', 'x Does not evaluate files for PII or prohibited content', 'x No audit trail for accept/reject with rule and approver']), k7: lines(['K7 File Security Monitoring runs entirely within the perimeter as a platform module', 'Air-gapped, if required by regulators', 'Danger and permissibility judged together', 'Removal of active content to disarm files']), advantage: lines(['No per-platform sandbox estate to maintain', 'Accept, review, hold or reject decisions for every document with rules, evidence and approver, written to a tamper-evident record']) },
            { title: 'Knowing what is coming, not only what has already arrived', competitor: lines(['Attacker attribution for detected threats', 'x Proactive reporting requires a separate intelligence offering']), k7: lines(['K7 Ecosystem Threat Intelligence feeds, specific to your sector or your region, delivered as STIX2']), advantage: lines(["Threat intelligence built around K7 Labs' research and K7's protection telemetry from more than 40 million devices across the globe", 'Dual consumer and business estates enable gathering of intelligence from regional campaigns before they reach enterprise targets']) },
          ],
        },
        {
          title: 'Data and access',
          subtitle: 'What is sensitive, where it can go, and who can reach it',
          rows: [
            { title: 'Knowing what information is sensitive', competitor: lines(['Finds and classifies sensitive data across machines, browsers, cloud and SaaS applications', 'Windows, macOS: discovery and classification on the endpoint', 'Linux: served by Falcon Data Protection for Cloud, for cloud workloads and containers', 'x No data classification for Linux servers that are not cloud workloads']), k7: lines(['Rules based on file content, not file name', 'Classification and enforcement are one policy on one console']), advantage: lines(['No gap between what the platform knows is sensitive and what it will stop']) },
            { title: 'Controlling where information is allowed to go', competitor: lines(['USB control on Windows and macOS', 'Data transmission via upload, cloud storage or AI tools is handled by Falcon Data Protection on Windows and macOS endpoints, and Falcon Data Protection for Cloud for Linux cloud workloads', 'x Does not cover Linux file server, application server or database host']), k7: lines(['Transfer (uploads, copy and paste, cloud storage, printing, pasting into public AI tools) is blocked the moment it happens by the agent on the machine and, where required, at the perimeter']), advantage: lines(['One policy, one log, whatever the channel']) },
            { title: 'Proving what someone with legitimate access actually did', competitor: lines(['Indicates who changed a file, and grants administrator rights, on Windows, macOS and Linux', 'x Does not include privileged session recording', 'x Behavioural analysis runs on identity and SIEM products, not on the endpoint record']), k7: lines(['Continuous record of every change, with the acting user, process and parent process attached', 'Real-time scan on Windows and Linux, scheduled scan on macOS']), advantage: lines(['Establishes, even months later, what a user touched, even with a valid login']) },
          ],
        },
        {
          title: 'Compliance and proving control',
          subtitle: 'Evidencing controls, hardening systems, and keeping the proof',
          rows: [
            { title: 'Proving to auditors and regulators that controls are working', competitor: lines(['Compliance dashboards for your cloud, and those your team builds in the SIEM', "x Laptops and servers: nothing is mapped to a regulation; Falcon's reports have to be manually linked to auditors' requests"]), k7: lines(['Every detection rule already carries the control it evidences', 'Each framework has a live view, not an export']), advantage: lines(['Ships with PCI DSS, GDPR, HIPAA, NIST 800-53 and SOC 2 ready-mapped', 'Compliance reporting is a by-product of detection, not a separate exercise']) },
            { title: 'Keeping systems hardened, and proving they stay hardened', competitor: lines(['Checks your machines against CIS and STIG benchmarks', 'Indicates what is misconfigured and how to fix it, and can fix some of it automatically', 'x Does not indicate which regulation has been violated; audit answers require manual compilation']), k7: lines(['Pass or fail against CIS for every machine is tracked over time', 'Every failed check carries the associated regulation', "Regulator's, or your own, baseline can be configured as policy; feature changes are not required"]), advantage: lines(['Output is audit evidence, not a to-do list', 'Enables quick identification of drift from standards']) },
          ],
        },
        {
          title: 'Security economics',
          subtitle: 'What the platform costs to run and to staff',
          rows: [
            { title: 'The real cost of a security platform is people, not licences', competitor: lines(['One agent, one console on Windows, macOS and Linux', 'x Mobile security is on a different console', 'x Exposure management, identity, next-gen SIEM and automation each need someone who knows them', 'x Incident analysis requires assembling events across functions, by people who each know only one part']), k7: lines(['One platform, one console, one record', 'Machine, person, what changed, and the response associated with an event are recorded together']), advantage: lines(['Incident reconstruction is a query, not a project', "Savings in hours spent monitoring each console and reconciling one system's account against another's"]) },
            { title: 'Running security on your terms: on-premises, cloud or managed', competitor: lines(["Falcon is delivered from CrowdStrike's cloud", "Falcon Complete adds round-the-clock monitoring and response, using CrowdStrike's own experts", 'x No on-premises deployment', 'x If your telemetry cannot leave your environment, Falcon is not a candidate at any price, in any region', 'x Falcon Complete is staffed by CrowdStrike alone; the partner who knows your estate leaves the response chain']), k7: lines(['One product, three deployment models: on-premises, regional cloud, K7-operated regional cloud', 'K7 owns detection and response; your local partner keeps the relationship, the deployment and first-line support', 'MDR runs on the cloud model']), advantage: lines(['Deployment factor is not a constraint', 'K7 has a solution if you need nothing to leave your environment', 'K7 also has a solution if you need someone to manage cybersecurity 24/7']) },
          ],
        },
      ],
      actions: [custom('Explore platform', '/k7-seventh-sense'), custom('Request demo →', '/contact-us', 'text')],
    },
    {
      blockType: 'ctaSheet',
      tabLabel: 'Next step',
      headline: 'See the difference on your estate.',
      paragraph: 'Request a demo and a K7 engineer will walk through these twelve criteria on your own endpoints, identities and data.',
      actions: [custom('Request demo →', '/contact-us', 'primary'), custom('Explore platform', '/k7-seventh-sense')],
    },
  ],
}

/* ---------------- Contact ---------------- */
const contactPage = (formId: number): PageData => ({
  title: 'Contact Us',
  slug: 'contact-us',
  _status: 'published',
  meta: { title: 'Contact Us | K7 CyberSecurity', description: 'Three offices in Chennai, Singapore and Dubai. Sales, support and media enquiries, answered by the people who build and run the platform.' },
  layout: [
    { blockType: 'pageBanner', metaLeft: 'About Us · Contact', metaRight: 'India · Singapore · UAE', lede: 'Three offices. Sales, support and media enquiries, answered by the people who build and run the platform.', actions: [custom('Send an enquiry →', '#enquiry', 'primary'), custom('Call Chennai', 'tel:+914466117777')] },
    {
      blockType: 'locations',
      tabLabel: 'Offices',
      ground: 'panel',
      headline: 'Where we are.',
      lede: 'K7 Enterprise Security in Chennai, K7 Computing Technologies in Singapore and K7 Cyber Security in Dubai.',
      offices: [
        {
          name: 'India',
          company: 'K7 Enterprise Security Private Limited',
          address: '2nd Floor, Tower C, Tek Meadows, No. 51, Rajiv Gandhi Salai (OMR), Sholinganallur, Chennai – 600 119, Tamil Nadu, India',
          rows: [
            { label: 'Telephone', value: '+91-44-6611-7777', href: 'tel:+914466117777' },
            { label: 'Fax', value: '+91-44-6611-7788' },
            { label: 'Sales', value: 'businessenquiry@k7computing.com', href: 'mailto:businessenquiry@k7computing.com' },
            { label: 'Support', value: 'enterprisesupport@k7computing.com', href: 'mailto:enterprisesupport@k7computing.com' },
            { label: 'Toll free', value: '1800-419-0077', href: 'tel:+18004190077' },
          ],
          mapCaption: 'Map · Chennai',
        },
        {
          name: 'Singapore',
          company: 'K7 Computing Technologies Pte Ltd',
          address: '1 North Bridge Road, #19-08, High Street Centre, Singapore 179094',
          rows: [
            { label: 'Telephone', value: '+65-3159-4200', href: 'tel:+6531594200' },
            { label: 'Sales', value: 'sales@k7computing.sg', href: 'mailto:sales@k7computing.sg' },
            { label: 'Support', value: 'support@k7computing.sg', href: 'mailto:support@k7computing.sg' },
          ],
          mapCaption: 'Map · Singapore',
        },
        {
          name: 'UAE',
          company: 'K7 Cyber Security FZCO',
          address: 'M2, Ali Saif Al Mansoori Business Center, M Floor, Arzoo Building, Next to Al Twar Centre, Al Qusais 2, Dubai, UAE',
          rows: [
            { label: 'Telephone', value: '+971-56-367-2864', href: 'tel:+971563672864' },
            { label: 'Email', value: 'businessenquiry@k7computing.com', href: 'mailto:businessenquiry@k7computing.com' },
            { label: 'Support', value: 'enterprisesupport@k7computing.com', href: 'mailto:enterprisesupport@k7computing.com' },
          ],
          mapCaption: 'Map · Dubai',
        },
      ],
    },
    { blockType: 'formSheet', tabLabel: 'Enquiry', ground: 'paper', headline: 'Let us know your questions or enquiries.', note: 'Fields marked * are mandatory.', form: formId, privacyUrl: '/privacy-policy' },
  ],
})

/* ---------------- Form: Request quote, XDR ---------------- */
const quotePage = (formId: number): PageData => ({
  title: 'Request quote · K7 Seventh Sense XDR',
  slug: 'request-quote-xdr',
  _status: 'published',
  meta: { title: 'Request a quote for K7 Seventh Sense XDR', description: 'Tell us the size of your estate and we will come back with a quote for K7 Seventh Sense XDR.' },
  layout: [
    { blockType: 'pageBanner', compact: true, metaLeft: 'Platform · Core · K7 Seventh Sense XDR', metaRight: 'Request quote' },
    { blockType: 'formSheet', tabLabel: 'Request quote', tabNote: 'XDR', ground: 'panel', headline: 'K7 Seventh Sense XDR', note: 'Fields marked * are mandatory. Tell us the size of your estate and we will come back with a quote.', form: formId, privacyUrl: '/privacy-policy', maxWidth: 960 },
  ],
})

export const morePages = (formIds: Record<string, number>): PageData[] => [comparisonPage, contactPage(formIds['Contact enquiry']!), quotePage(formIds['Request quote · XDR']!)]
