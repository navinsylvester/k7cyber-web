# Page shapes → components → Payload blocks

Source: `content/source/k7-enterprise-website-content.md` (export of the "K7 Enterprise Website Content" Google Doc, 8 Oct 2026). ~60 content pages and ~51 forms collapse into the templates below. Every template is a `Pages` document whose `layout` is a list of the blocks on the right; the same React block components (`src/blocks/k7`, on the design system classes) render every page.

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
| Research hub | Research (K7 Labs, Lab Blog, Vulnerabilities, Top Threats, Threat Reports) | Built in this repo under `src/app/(frontend)/research/` on the section 08 parts (`design-system/components/LabsParts`), fed by the research collections |
| Company | About K7, Leadership, Careers, Partners, Media Centre, Certifications, Testimonials | PageBanner → Rich text / LeaderGrid / LogoWall / Partner two-column + form / Logo downloads / Testimonial list |
| Contact | Contact Us | Banner image → 3 ContactLocation cards with map → Enquiry form |
| Support | Support | The support portal in this repo under `src/app/(portal)/support/` on the section 09 parts (`design-system/components/SupportParts`), against Dynamics 365 |
| Form | 30 Enquiry, 11 Request Demo, 10 Request Quote | One FormBlock. Enquiry/Demo share the field set (company, contact person, email, phone, country[India], state, city, comment, consent ×2). Quote adds "number of endpoints/users" style sizing fields. Each form carries a `product` tag so submissions route correctly. |

## Component inventory (content doc → design system part → block)

The content doc names cards and tiles; the design language turns parallel content into rows (`design-system/README.md`, Components). No component library is in use: every part is plain React on `bundle.css` (`design-system/README.md`, Building in React).

| Content doc part | Used by | Design system part → built as |
|---|---|---|
| SiteHeader (3-level mega menu, Support, CTA) | all | SiteHeader → `src/Header` from the `header` global |
| SiteFooter (5 link columns, legal, socials) | all | SiteFooter → `src/Footer` from the `footer` global; the social glyphs from Icon |
| Hero | Home | Hero → `homeHero` block |
| PageBanner | every inner page | PageBanner → `pageBanner` block |
| SectionHeader (eyebrow, heading, lede) | all | SheetHead, in every sheet block |
| Button (primary / secondary / text, arrow) | all | Button → `Actions` (`btn-primary`, `btn-line`, `link-u`) |
| FeatureTile (icon, title, text) in 2/3/4-col grid | Product, Addon, Industry, Service | CapabilityRow → `capabilityRows` block |
| CapabilityTile with hover card | Home | CapabilityRow with tags → `capabilityRows` block; no hover card |
| StatTile | Home, About | StatRow → the facts in the `intro` block |
| ModuleChip grid with ✓ / + states and expansion | Home, Platform, Product | ModuleChips → `moduleGrid` block |
| IndustryCard (+ expanded: capabilities, compliance pills, Learn more) | Home, Platform | IndexRow → `indexRows` block; compliance as plain text in the description |
| Feature panel with figure (animation, award, report cover) | Platform, Home | FeaturePanel → `featurePanels` and `panelGrid` blocks |
| FeatureMatrix (✔ table) | Product | FeatureMatrix → `featureMatrix` block, ✔ in ink |
| ComparisonTable (4 col, ✔/✖ lists, section rows, sticky head) | Comparison | ComparisonTable → `comparisonTable` block |
| Testimonial (quote, name, company; carousel) | Home, Industry, Testimonials | Quote → `testimonials` block from the `testimonials` collection |
| InsightCard (cover, type label, title, link) | Platform, Industry, Insight | PublicationRow → `publicationRows` block |
| CompliancePill | Home, Platform, Industry | Tag, inside capability rows and module tiles |
| Rich text (compliance, company pages) | Compliance, Company | Prose → `prose` block |
| LogoWall | About, Partners | LogoWall; no block yet (company pages not built) |
| LeaderCard | Leadership | LeaderRow; no block yet (company pages not built) |
| ContactLocation | Contact | ContactLocation → `locations` block |
| CtaBand | every inner page | CtaSheet → `ctaSheet` block |
| EnquiryForm (inputs, country/state selects, textarea, consent checkboxes, privacy link) | Forms, Partners, Contact | EnquiryForm on Field → `formSheet` block (form-builder plugin) |
| ListCard (news / event / press) | Listing | PublicationRow or IndexRow; listing pages not built yet |

## Payload model

- Collections: `pages` (blocks layout, SEO), `products`, `industries`, `services` (optional: or all as pages with a `template` select), `insights` (type: blog / case study / whitepaper; external URL or PDF), `testimonials`, `leaders`, `partners`, `media`, `forms` + `form-submissions` (via `@payloadcms/plugin-form-builder`).
- Globals: `header` (nav tree from the Header Menu table), `footer`.
- Blocks: `hero`, `pageBanner`, `richText`, `featureGrid`, `statsRow`, `capabilityTiles`, `moduleGrid`, `industryGrid`, `featureMatrix`, `comparisonTable`, `testimonials`, `insightCards`, `logoWall`, `leaderGrid`, `contactLocations`, `ctaBand`, `form`, `listing`.
