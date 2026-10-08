# Page shapes → components → Payload blocks

Source: `content/source/k7-enterprise-website-content.md` (export of the "K7 Enterprise Website Content" Google Doc, 8 Oct 2026). ~60 content pages and ~51 forms collapse into the templates below. Every template is a `Pages` document whose `layout` is a list of the blocks on the right; the same React/shadcn block components render both the static previews and the Payload front end.

## Templates

| Template | Pages | Sections in order (→ block) |
|---|---|---|
| Home | Home | Hero (2 CTAs) → Intro copy with 3 pillars → Capability tiles with hover cards → Modular-by-design chip grid → Industry grid → "Security That Answers To You" copy + link → Research proof (award, report, stats row) → Testimonial carousel |
| Platform overview | K7 Seventh Sense | PageBanner → Animation/media + copy + brochure link → Modular grid (Solutions / Addons) with expansion → Industry focus with expansion → Insight cards |
| Product | MDR, XDR, EDR, EPS; SD-WAN, NGFW, VPN Concentrator, Connect 500, AAA | PageBanner (Enquire / Request Quote + Brochure) → Intro copy → Architecture/coverage strip (MDR only) → Highlights tiles → Benefits tiles → CTA → Feature matrix (✔ table) → Related products (network) |
| Addon | DLP, IAM, Patch Mgmt, Advanced Endpoint Mgmt, Agentic SOC, Log Retention, File Security Monitoring | PageBanner (Enquire) → Intro copy → Highlights 2×2 → Benefits 2×2 → CTA |
| Industry | BFSI, Education, Government, Healthcare, Manufacturing, Professional Services, Retail | PageBanner (Enquire) → Intro copy → "The Threat Stops Here" 8 tiles → Solutions for X (4 list cards: Platform, Network, Services, Compliance) → CTA → Testimonial → Insight cards |
| Service | GRC, vCISO, ERM, Incident Response, Cyber Defence Assessment, Red Team, VAPT, AI Readiness, AI Maturity, ISAP, Managed Security Services | PageBanner (Enquire) → Intro copy → Highlights / process tiles → CTA |
| Compliance | ADHICS, CBUAE, DPDP | PageBanner → Rich text |
| Comparison | K7 vs CrowdStrike | PageBanner (2 CTAs) → Intro copy → 4-column comparison table (✔/✖ bullets, section rows) → CTAs |
| Listing | Insight, News, Press Releases, Events | PageBanner → Card grid fed from a collection or feed |
| Research hub | Research (K7 Labs, Lab Blog, Vulnerabilities, Top Threats) | Already built as static pages in `~/office_docs/website/k7-research` on Design Language 2.1 |
| Company | About K7, Leadership, Careers, Partners, Media Centre, Certifications, Testimonials | PageBanner → Rich text / LeaderGrid / LogoWall / Partner two-column + form / Logo downloads / Testimonial list |
| Contact | Contact Us | Banner image → 3 ContactLocation cards with map → Enquiry form |
| Support | Support | Link-out to third-party portal with K7 skin |
| Form | 30 Enquiry, 11 Request Demo, 10 Request Quote | One FormBlock. Enquiry/Demo share the field set (company, contact person, email, phone, country[India], state, city, comment, consent ×2). Quote adds "number of endpoints/users" style sizing fields. Each form carries a `product` tag so submissions route correctly. |

## Component inventory (design system → shadcn)

| Component | Used by | shadcn base |
|---|---|---|
| SiteHeader (3-level mega menu, Support, CTA) | all | NavigationMenu, Sheet (mobile) |
| SiteFooter (5 link columns, legal, socials) | all | — |
| Hero | Home | Button |
| PageBanner | every inner page | Button |
| SectionHeader (eyebrow, heading, lede) | all | — |
| Button (primary / secondary / text, arrow) | all | Button |
| FeatureTile (icon, title, text) in 2/3/4-col grid | Product, Addon, Industry, Service | Card |
| CapabilityTile with hover card | Home | HoverCard / Dialog on touch |
| StatTile | Home, About | — |
| ModuleChip grid with ✓ / + states and expansion | Home, Platform, Product | Toggle, Collapsible |
| IndustryCard (+ expanded: capabilities, compliance pills, Learn more) | Home, Platform | Card, Badge |
| FeatureMatrix (✔ table) | Product | Table |
| ComparisonTable (4 col, ✔/✖ lists, section rows, sticky head) | Comparison | Table |
| Testimonial (quote, name, company; carousel) | Home, Industry, Testimonials | Carousel |
| InsightCard (cover, type label, title, link) | Platform, Industry, Insight | Card |
| CompliancePill | Home, Platform, Industry | Badge |
| LogoWall | About, Partners | — |
| LeaderCard | Leadership | Card, Avatar |
| ContactLocation | Contact | Card |
| CtaBand | every inner page | Button |
| EnquiryForm (inputs, country/state selects, textarea, consent checkboxes, privacy link) | Forms, Partners, Contact | Form, Input, Select, Textarea, Checkbox |
| ListCard (news / event / press) | Listing | Card |

## Payload model

- Collections: `pages` (blocks layout, SEO), `products`, `industries`, `services` (optional: or all as pages with a `template` select), `insights` (type: blog / case study / whitepaper; external URL or PDF), `testimonials`, `leaders`, `partners`, `media`, `forms` + `form-submissions` (via `@payloadcms/plugin-form-builder`).
- Globals: `header` (nav tree from the Header Menu table), `footer`.
- Blocks: `hero`, `pageBanner`, `richText`, `featureGrid`, `statsRow`, `capabilityTiles`, `moduleGrid`, `industryGrid`, `featureMatrix`, `comparisonTable`, `testimonials`, `insightCards`, `logoWall`, `leaderGrid`, `contactLocations`, `ctaBand`, `form`, `listing`.
