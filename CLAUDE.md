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

## Support portal (Dynamics 365 / Dataverse) — planning handed over 2026-10-10
- Start at `docs/support-portal/README.md`; it orders the reading. Field/API facts are in
  `docs/support-portal/03-metadata-summary.md`; `05-metadata-full.md` is grep-only.
- Production Dataverse (`k7crm.crm8.dynamics.com`) is live for 65 agents. Interim mode
  (2026-10-11): development is **read-only against production**; the Dataverse client must
  hard-refuse any non-GET call to the production host. Writes wait for a sandbox/UAT
  (`scripts/dataverse-seed.py` seeds it). Rules in `07-production-safety.md` §1b.
- Agent workspace first (delegated Entra sign-in, Auth.js), customer self-service second
  (Entra External ID + application user). Routes under `src/app/(portal)/support/...`,
  client in `src/lib/dataverse/`, domain in `src/lib/support/` (`08-implementation-plan.md`).
- `scripts/dataverse-probe.py` queries Dataverse from the shell (`DV_*` in `.env`); its
  token cache `scripts/.token_cache.json` and any `spec/` output are git-ignored.
