# Implementation plan inside k7cyber-web

How the support portal fits this repo (Next.js 16 + Payload 3, server-rendered, K7
Design Language 2.1). Read `CLAUDE.md`, `AGENTS.md` and `design-system/README.md` first;
Next 16 APIs differ from training data, so check `node_modules/next/dist/docs/` before
writing route, cache or request-interception code.

## 1. Where it lives
```
src/app/(portal)/                      new route group: own layout (site header, no marketing
  layout.tsx                           footer, robots noindex, dynamic rendering, portal.css)
  support/page.tsx                     customer landing: sign-in, KB search, "my cases" link
  support/cases/{page,new/page,[ticket]/page}.tsx
  support/kb/{page,[number]/page}.tsx
  support/profile/page.tsx
  support/workspace/page.tsx           agent home = Active Cases Dashboard (Rafi)
  support/workspace/dashboards/[name]/page.tsx
  support/workspace/cases/page.tsx     ?view=<savedqueryid>&page=&q=&sort=
  support/workspace/cases/[id]/page.tsx
  support/workspace/{queues,accounts,contacts,kb,products,rfe}/...
src/app/api/auth/[...nextauth]/route.ts   Auth.js handlers (two providers)
src/app/api/support/...                 route handlers for mutations and file download
src/lib/dataverse/                      generic client: auth.ts (delegated + app user token
                                        sources), client.ts (fetch, headers, paging, 429
                                        retry, savedQuery, fetchXml, $batch), odata.ts
                                        (query builder, encoding), errors.ts, types.ts
src/lib/support/                        domain layer, one file per area: cases.ts,
                                        timeline.ts, views.ts, dashboards.ts, contacts.ts,
                                        accounts.ts, kb.ts, products.ts, reference.ts,
                                        status.ts (customer-facing mapping), identity.ts
                                        (External ID → contact)
src/components/support/                 React parts on the design system
src/app/(frontend)/portal.css           section 09 · Support of the design system (like
                                        research.css is section 08)
design-system/components/<New parts>/   README + bundle.css reference for any new part
scripts/dataverse-probe.py              metadata/discovery tool (python, no deps)
scripts/dataverse-schema-sync.py        copies the support schema production → UAT (dry run first)
scripts/dataverse-uat-automation.py     pauses/resumes UAT's case automation around a seed
scripts/dataverse-seed.py               seeds UAT from production: reference tables + cases since a date
docs/support-portal/                    this folder
```
`/support` currently resolves to the Payload "Support" page (link-out). The static
route in `(portal)` takes precedence; delete or repoint that Payload page at launch.
Dataverse data is never stored in Payload. Optional later: a `support` global for
landing copy and announcements.

## 2. Authentication (Auth.js v5, `next-auth@5`)
- Provider `microsoft-entra-id` for agents: issuer from `AUTH_MICROSOFT_ENTRA_ID_ISSUER`,
  scope `openid profile email offline_access ${DATAVERSE_URL}/user_impersonation`.
  Keep `access_token`, `refresh_token`, `expires_at` in the encrypted JWT; refresh in the
  `jwt` callback when < 5 min remain. Session exposes `kind: 'agent'`, `userId`
  (Dataverse `systemuserid` from `WhoAmI`, fetched once), name, email.
- Provider `customer` (generic OIDC against the External ID issuer) for customers.
  On first sign-in `identity.ts` finds or creates the contact (email match, newest
  modified wins) and stores `contactId`, `accountId` in the JWT; `kind: 'customer'`.
- Request interception (`proxy.ts` in Next 16; verify the name in the docs):
  `/support/workspace/*` requires `kind === 'agent'`; `/support/cases*`, `/support/profile`
  require a session; `/support`, `/support/kb*` are public.
- Server-side only: Dataverse tokens never reach the browser; all Dataverse calls happen
  in server components, server actions or route handlers.

## 3. Dataverse client rules
- `callDataverse` refuses every non-GET call when the target host is production
  (`07-production-safety.md` §1b); this check is the first line of the function.
- One `callDataverse(auth, method, path, body?, prefer?)` with the standard headers,
  `odata.include-annotations="*"`, `odata.maxpagesize`, `If-Match` on PATCH, 429 retry
  with `Retry-After`, structured errors (code, message, correlation id).
- `auth` is a token source: `{ kind: 'agent', token }` from the session or
  `{ kind: 'service' }` (client credentials, cached in memory per process).
- Customer-mode queries are built only through `src/lib/support/*` functions that take
  `contactId`/`accountId` as required parameters; no raw query builder is exported to
  pages. Lint rule or review checklist: every customer read has a scope filter.
- `runSavedQuery(auth, 'incidents', savedQueryId, { page, pagingCookie })` for the
  agent views; `layoutxml` from `savedqueries` drives the columns.
- Reference data (`reference.ts`): products, categories/sub-categories, geography,
  option-set labels from `EntityDefinitions` — `unstable_cache` with tags
  `support_reference`, revalidate hourly; everything else `dynamic = 'force-dynamic'`.
- `DATAVERSE_MOCK=1` serves recorded JSON fixtures from `tests/fixtures/dataverse/` so
  the UI and tests run without a tenant.

## 4. UI on the design system
- Lists are ledgers: `DataTable` (mono `label` heads, hairline rows, pager). Case numbers
  use `lid`; dates DD-MM-YYYY in mono; status is a `Tag`; priority Critical is the only
  signal colour on a row.
- Case page is a sheet with `SheetHead` (number, title, status, owner) and `SheetTab`s:
  Details, Timeline, Notes, Related (RFE/defect). Timeline entries are `IndexRow`-like
  rows, not cards.
- Forms use `Field`/`EnquiryForm` patterns; pickers are selects fed by `reference.ts`;
  category → sub-category cascades server-side (form posts to a server action).
- Dashboards: bars and lines as server-rendered inline SVG on the ledger grid (no chart
  library needed for the two phase-1 dashboards; add one only if a chart type demands it).
- New parts (Timeline, StatusTag variants, QueueRow, CaseForm) get a
  `design-system/components/<Name>/README.md` and reference CSS first, then the React
  component, as the repo rules require. Portal pages need approved designs in `designs/`
  before build (none exist yet; see open items).
- `(portal)` layout: `robots: { index: false, follow: false }`; nothing from the portal
  enters a sitemap.

## 5. Milestones
State 2026-10-13: M0, M1, M2 (every action wired, verified only on test cases), M3 (both dashboards) and most of M4 are built against UAT; see `09-portal-guide.md` §5 for the gaps. M6 is partly built ahead of schedule with the portal's own one-time-code sign-in (decision open, §2 of the guide).

| # | Scope | Done when |
|---|---|---|
| M0 Foundation | app registration A (`06-entra-setup.md` §A); read-only guard in the client (`07-production-safety.md` §1b) with its unit test; Auth.js with the agent provider; `src/lib/dataverse` with `WhoAmI` and one paged list; mock mode; `(portal)` layout | signed-in agent sees their name and `My Active Cases` rows from production, read-only |
| M1 Agent read | five must-have views via `savedQuery`; case page with details and timeline (activities + notes, attachment download); search by case number/title/customer | support lead confirms parity for reading |
| M2 Agent write (UAT is writable since 2026-10-12; verify every action in UAT's Customer Service Hub) | add note (+ attachment); assign; resolve (Closed-Call / Closed-Remote); cancel; reopen; create case with all pickers; convert to RFE | each action verified in the sandbox's Customer Service Hub; audit shows the agent |
| M3 Dashboards | Rafi + Customer Service Manager dashboards from the chart definitions' FetchXML | numbers match the model-driven app on the same UAT data |
| M4 Rest of the sitemap | queues (mine, public), accounts, contacts (create/edit, geography pickers), KB read/draft, products, RFE/defect lists, remaining 16 views | sitemap parity |
| M5 Production phase 1 | prod registrations, read-only week, flags on | model-driven app no longer needed for daily work |
| M6 Customers | External ID tenant and user flow; `identity.ts`; my cases, create, reply, KB, profile; status mapping; notifications | licensing confirmed in writing; first real customer case created via Web origin |

## 6. Environment variables (add to `.env.example`)
```
DATAVERSE_URL=https://k7crmuat.crm8.dynamics.com   # UAT (development); the code refuses writes to the production host regardless
DATAVERSE_WRITES_ENABLED=                           # set to 1 for UAT when M2 starts; never matters for production
DATAVERSE_TENANT_ID=005ef94f-7dbd-4d0e-a29a-494e2a63d911
DATAVERSE_CLIENT_ID=            # phase 2 service app
DATAVERSE_CLIENT_SECRET=
DATAVERSE_MOCK=                 # 1 = fixtures, no tenant
AUTH_SECRET=                    # Auth.js
AUTH_MICROSOFT_ENTRA_ID_ID=
AUTH_MICROSOFT_ENTRA_ID_SECRET=
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/005ef94f-7dbd-4d0e-a29a-494e2a63d911/v2.0
AUTH_CUSTOMER_ISSUER=           # phase 2 External ID
AUTH_CUSTOMER_ID=
AUTH_CUSTOMER_SECRET=
SUPPORT_PORTAL_WRITES=          # comma list of enabled write features in production
```
The python probe keeps its own `DV_*` names (`DV_ORG_URL`, `DV_TENANT_ID`, `DV_AUTH=device`).

## 7. Tests
- `tests/int`: odata builder, status mapping, identity matching, savedQuery paging —
  vitest with fixtures.
- `tests/e2e`: Playwright against UAT with a test agent (`E2E_AGENT_*` secrets) covering
  sign-in, view list, case open, add note; skipped when secrets are absent.
- Never against production (see `07-production-safety.md`).

## 8. First session in this repo: checklist
1. Read `docs/support-portal/README.md`, `01-requirements.md`, `03-metadata-summary.md`,
   `07-production-safety.md`; keep `02-dataverse-integration.md` open while coding the client.
2. Confirm production read access works: `python3 -I scripts/dataverse-probe.py get WhoAmI`
   (`.env` `DV_ORG_URL` = UAT since 2026-10-12; the probe's `get`/`count`/`discover` are GET-only)
   (uses `.env` `DV_*`; device sign-in once if the cache is missing).
3. Install `next-auth@5`; create the `(portal)` route group and `src/lib/dataverse`.
4. Build M0 against UAT with the agent provider; commit when the signed-in agent sees
   their My Active Cases.
