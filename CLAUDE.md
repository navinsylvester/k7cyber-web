# K7 CyberSecurity enterprise website

One Next.js 16 app with Payload 3 inside it: the public site and the CMS admin (`/admin`) are the same deployable. Server-rendered, never a SPA: every page is HTML from the server with static generation and on-publish revalidation, because SEO and analytics are the point of the site.

@AGENTS.md

## Layout
- `src/` — the app. `src/app/(frontend)` is the public site, `src/app/(payload)` the admin. Collections in `src/collections`, blocks in `src/blocks`, globals in `src/Header` and `src/Footer`, config in `src/payload.config.ts`.
- `design-system/` — K7 Design Language 2.1: `tokens.json` is the source of truth, `tokens.css` is generated from it and imported by `src/app/(frontend)/globals.css`, `components/bundle.css` is the reference CSS each React component must reproduce, `components/<Name>/README.md` the rules per part. Read `design-system/README.md` before touching any UI.
- `designs/` — the approved page designs (Claude Design artboards) per template. Build pages to match these.
- `docs/page-shapes.md` — which blocks each page template is made of, and the Payload collections/globals/blocks model.
- `content/source/` — the content doc export the pages are written from.

## K7 Labs (Resources → Research)
- Routes under `src/app/(frontend)/research/`: landing (one-time designed page in code), `lab-blog` (listing, search `?q=`, `category/[...path]`, `author/[slug]`, `[slug]`, `feed.xml`), `vulnerability-information` (table with `?cve&product&severity&sort&dir&page`, `export.csv`, `import` for the CSV batch), `vulnerability/[slug]`, `top-threats` (+ `[slug]`), `threat-reports` (+ `lead` POST and `download/[id]`, token-gated when the report is gated).
- Collections in `src/collections/research/` plus the rewritten `Posts`. Data access goes through `src/lib/research/data.ts`, cached under the `research` and `research_<collection>` tags that the collection hooks revalidate.
- The research parts of the design system live in `src/app/(frontend)/research.css` (section 08 · Labs). Components in `src/components/research/`.
- Migration from labs.k7computing.com: `pnpm migrate:labs --phase=data|posts|all` reads the MariaDB container that holds the WordPress dump (see scripts/migrate-labs.ts); it writes `migration/report*.json` and `migration/redirects.csv`. Pattern redirects for the old URLs are in `redirects.ts`.
- Report PDFs live in `uploads/reports/` (ignored by git) and are only served through the download route.

## Decisions (do not reopen)
- Postgres (`@payloadcms/db-postgres`), Lexical rich text, `@payloadcms/plugin-seo` and `plugin-form-builder`.
- Dark is the default theme; the user's explicit choice is honoured, the OS preference is not.
- Fonts are self-hosted through `next/font` (Archivo with the `wdth` axis, IBM Plex Mono); no Google Fonts `<link>`.
- shadcn variables map onto the K7 tokens in `globals.css`; radius is always 0, no shadows, hover is an inversion.
- Hosting is undecided. Nothing cloud-specific in the code. Local only for now.
- K7 Labs pages (WordPress) migrate later, after the CMS is proven on the static templates.

## Commands
| Purpose | Command |
| --- | --- |
| Start Postgres (port 5434) | `docker compose up -d` |
| Dev server (site + admin on :3000) | `pnpm dev` |
| Types, lint | `npx tsc --noEmit`, `pnpm lint` |
| Regenerate Payload types after a schema change | `pnpm generate:types` |
| Production build | `pnpm build` |

Local dev uses Payload's push mode (schema synced on start). Credentials in `.env` are local throwaways.

## Support portal (Dynamics 365 / Dataverse) — built on UAT from 2026-10-13
- Start at `docs/support-portal/README.md`; it orders the reading. `09-portal-guide.md` is the state of the build:
  routes, the three sign-in doors (Entra for agents, one-time code for customers, probe token in development),
  the rules the code enforces, and what is not done. Field/API facts are in
  `docs/support-portal/03-metadata-summary.md`; `05-metadata-full.md` is grep-only.
- Production Dataverse (`k7crm.crm8.dynamics.com`) is live for 65 agents and stays **read-only**:
  the Dataverse client must hard-refuse any non-GET call to the production host. Development
  runs against **UAT** (`k7crmuat.crm8.dynamics.com`, since 2026-10-12): a shared sandbox whose
  support schema is synced from production (`scripts/dataverse-schema-sync.py`) and seeded with
  recent cases (`scripts/dataverse-seed.py --since`); `scripts/dataverse-uat-automation.py`
  pauses its case automation around a seed and keeps customer-facing items off. Rules in
  `07-production-safety.md` §1–1c.
- Routes under `src/app/(portal)/support/...` (own root layout, `portal.css` = design-system section 09),
  client in `src/lib/dataverse/` (write guard first), domain in `src/lib/support/` (`session.ts` gives
  `requireAgent()` / `requireCustomer()`; every customer query carries `customerScopeFilter`). Parts in
  `src/components/support/`. Tests: `tests/int/support-*.int.spec.ts` (no tenant needed).
- Development sign-in: the Microsoft door works for agents (verified 2026-10-15). `SUPPORT_DEV_AGENT=probe` in `.env`
  also opens the probe-user door; `SUPPORT_DEV_SERVICE=probe` only lets the customer side use the probe token in place
  of the missing service app. `SUPPORT_DEV_SHOW_CODE=1` shows customers' one-time codes on the verify page while no
  `SMTP_URL` is set. On any host other people can reach: door off, `SUPPORT_MAIL_ALLOWLIST` set (mail and codes go
  only to listed addresses/domains; the on-screen code needs it off localhost).
- Manager view at `/support/workspace/manage` (agents with a manager role, 09 §4c): KPI cards, engineer efficiency, SLA violation
  report, the at-risk board and the prevention sweep (`POST /api/support/sla/sweep` with `CRON_SECRET`). Targets, business hours,
  KPI cards and rules are configured on `/manage/kpis` and stored in the Payload global `support-settings`; the sweep log is the
  collection `support-sla-events`. The SLA engine (`src/lib/support/sla.ts`) is pure and tested without a tenant.
- CSAT (09 §4d, built 2026-10-14): the survey on resolved cases (portal, emailed token link `/support/csat/[token]`, or recorded by an agent), stored in
  the Payload collections `support-csat` and `support-care-flags`, never in the CRM. Low scores open a follow-up on `/manage/csat` and mark the customer
  "handle with care" (`careFrom` in `src/lib/support/csat-model.ts`), shown beside the customer on case heads, lists and customer pages. The sweep's
  CSAT pass emails surveys only for the cases `csat.inviteMode` allows (default: portal cases) and only through `SMTP_URL`.
- Product desk (support → principal support → engineering and Lab in Yodiz): designed in `docs/support-portal/10-product-desk.md`,
  **phase A built 2026-10-14** (09 §4f): `/support/product` (principal support's inbox, items, settings) and `/support/workspace/product`
  (the desk's side), the *Escalate to product* panel and band on the case sheet. Items are a bridge record in Payload (`product-*`
  collections, `product-settings` global); the tracker sits behind `src/lib/support/tracker/` (link-only now, Yodiz in phase B); the CRM
  mirror writes notes, tasks, the status reason and the `k7_rfe`/`k7_defect` rows (an enhancement is an RFE, a defect or detection a defect),
  as the acting agent, logged in `product-mirror`; the old RFEs tab is merged into the desk; samples never enter the portal.
- `scripts/dataverse-probe.py` queries Dataverse from the shell (`DV_*` in `.env`); its
  token cache `scripts/.token_cache.json` and any `spec/` output are git-ignored.
