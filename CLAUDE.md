# K7 CyberSecurity enterprise website

One Next.js 16 app with Payload 3 inside it: the public site and the CMS admin (`/admin`) are the same deployable. Server-rendered, never a SPA: every page is HTML from the server with static generation and on-publish revalidation, because SEO and analytics are the point of the site.

@AGENTS.md

## Layout
- `src/` — the app. `src/app/(frontend)` is the public site, `src/app/(payload)` the admin. Collections in `src/collections`, blocks in `src/blocks`, globals in `src/Header` and `src/Footer`, config in `src/payload.config.ts`.
- `design-system/` — K7 Design Language 2.1: `tokens.json` is the source of truth, `tokens.css` is generated from it and imported by `src/app/(frontend)/globals.css`, `components/bundle.css` is the reference CSS each React component must reproduce, `components/<Name>/README.md` the rules per part. Read `design-system/README.md` before touching any UI.
- `designs/` — the approved page designs (Claude Design artboards) per template. Build pages to match these.
- `docs/page-shapes.md` — which blocks each page template is made of, and the Payload collections/globals/blocks model.
- `content/source/` — the content doc export the pages are written from.

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
