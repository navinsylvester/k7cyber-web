# Protecting the production support system

Production Dataverse (`k7crm.crm8.dynamics.com`) runs the support desk for 65 agents and
383k cases, with heavy automation (`SYSTEM` is the modifier on 60% of cases). The
portal must reach it only when it is ready. These rules are binding for every session
working in this repo.

## 1. Environments
| | UAT (`https://k7crmuat.crm8.dynamics.com`) — development, tests, demos | Production (`k7crm.crm8.dynamics.com`) |
|---|---|---|
| What it is | K7's existing Sandbox-type org (2018), shared with the CRM admin (Kathiresan M), who stages solutions there and uses it for reporting. Chosen on 2026-10-12 because the tenant is over its Dataverse database entitlement and no sandbox can be created or copied. | the live support desk |
| Schema | support schema synced from production by `scripts/dataverse-schema-sync.py` (option values, `account.k7_description`, all incident views and charts, the Rafi/SR/Defect dashboards, the two case forms, the mobile app's sitemap and components); the change set is in the unmanaged solution **K7SupportSchemaSync**, previous versions in `migration/uat-schema-backup-*.json` | everything |
| Data | its own 2018–2025 rows plus production cases created on/after **2026-09-28** with their contacts, accounts, notes and emails, and the reference tables in full (`scripts/dataverse-seed.py --since 2026-09-28`; seeded 2026-10-12: 1,210 cases with their case numbers and states, 939 contacts, 138 accounts, 1,885 notes, 5,558 emails, 139 RFEs, 76 defects, 93 knowledge articles, the full product catalogue) | everything |
| `.env` default | yes (`DATAVERSE_URL`, `DV_ORG_URL`) | reads only, never the default |
| Writes | allowed | **refused by the client** (§1b) until go-live |
| App registrations | `(Dev)` pair | separate `(Prod)` pair |

Rules for the shared UAT (§1c) apply to every write there. A fresh Minimal-copy sandbox is still
the better development environment once capacity allows (no schema drift, no stale rows); the
scripts above work unchanged against it.

Preparing UAT again (all three scripts refuse the production host as a target and share the
probe's token cache):
```
python3 -I scripts/dataverse-schema-sync.py --target https://k7crmuat.crm8.dynamics.com --dry-run   # then without --dry-run
python3 -I scripts/dataverse-uat-automation.py --target https://k7crmuat.crm8.dynamics.com --pause
python3 -I scripts/dataverse-seed.py --target https://k7crmuat.crm8.dynamics.com --since 2026-09-28 --dry-run   # then without --dry-run
python3 -I scripts/dataverse-uat-automation.py --target https://k7crmuat.crm8.dynamics.com --resume
```
The seed reads production with your own account and writes only to the target. It preserves
record GUIDs and case numbers, maps owners and user lookups by UPN, binds lookups only to rows that
exist in the target (a row that exists there under another id because of an alternate key is
remapped), drops choice values the target lacks (counted in the report), writes production labels
into text columns of a different type (`k7_salespersonname`), keeps open emails as drafts (never
Pending Send), resolves and cancels cases only after their notes and activities exist, publishes
active products, suppresses the target's duplicate-detection rules (the mirror is by id), omits
attachment bodies unless `--attachments-max-mb` is set, and writes `migration/dataverse-seed-report.json`.
Re-running skips rows that already exist and repairs what an earlier run left incomplete (missing case
product, orphaned notes and emails, emails still in Pending Send). Rows whose production owner has no
security role in UAT (7 agents) fall back to the seeding user as owner (`owner_fallbacks` in the report;
2026-10-12: 63 cases, 208 emails, 76 notes, 21 contacts, 19 accounts). UAT creates products in the active
state (organisation setting), so `published_products` is 0 there. Two weeks is ≈1,200 cases, 930 contacts,
140 accounts, 1,900 notes and 5,500 emails (run of 2026-10-12: 1,210 cases, 5,558 emails, zero errors);
three months would be ≈7,400 cases and 36,000 emails, roughly 1–2 GB of database the tenant does not have today.

## 1c. Rules for the shared UAT (decided 2026-10-12)
- Touch only the support schema (incident and what its views, charts, dashboards, forms and app
  need; account/contact choice values are added, never relabelled). Sales labels that differ from
  production (`alletec_accounttype` 0/1 = B2B/B2C, parts of `alletec_verticalbusiness`) stay as
  the CRM admin has them; the sync report lists them under `options_label_conflicts_kept`.
- Every schema change goes through `scripts/dataverse-schema-sync.py` (idempotent, backs up what
  it overwrites, publishes only the touched entities, never `PublishAllXml`), so the CRM admin can
  see the change set in **K7SupportSchemaSync**. No manual customisation in UAT either.
- Customer-facing automation stays off: SMS on case creation/closure, the feedback mail on resolve,
  assignment mail, mails to the ME, the email-to-case workflow, mail on account create, the cloud
  flow "Send Email to Customer When Case is Created", and both email server profiles. UAT could not
  send mail anyway (no mailbox has ever synced), but seeded cases must not queue thousands of
  pending emails. `--resume` re-activates everything else that `--pause` turned off and leaves
  these off; the exact list is in `migration/uat-automation-state*.json`.
- Seeded rows are real customer data: treat UAT like production for access and never log payloads.
- Tell the CRM admin before a sync or a seed; their solution imports can land the same day.
- Known differences left on purpose: `incident.k7_salespersonname` is text in UAT (choice in
  production), `incident.k7_today` (calculated) and `email.k7_ticketidautocaptureid` were not
  created, the chart "Case Topics" (web-resource chart) was not copied, three entities of the
  mobile app do not exist in UAT, and UAT keeps its own 2,091 cities and 18 countries next to
  production's 2,202 and 20 (different ids, same names) — see the 2026-10-12 session notes before
  deleting either set.

## 1b. Production stays read-only (the guard from the interim mode of 2026-10-11 is permanent)
The interim mode (read-only development against production, 2026-10-11 to 2026-10-12) ended when
UAT became the development environment. Its guard stays:
- The Dataverse client in `src/lib/dataverse/` **hard-refuses** POST, PATCH, DELETE, `$batch` and
  action calls (`CloseIncident`, `AddToQueue`, …) when the target host is
  `k7crm.crm8.dynamics.com` or `k7crm.api.crm8.dynamics.com`, regardless of environment
  variables. A unit test pins this. Pointing `DATAVERSE_URL` at production is allowed on a
  developer machine only for read-only comparison work.
- Agents authenticate as themselves (delegated token); their own roles would allow writes,
  which is why the guard lives in code, not in Dataverse.
- Reads are shaped to be invisible: `$select` always, pages of 25–50, no `$expand` in
  lists, reference data cached for hours, dashboard aggregates taken from the charts'
  own FetchXML (which carry the view filters) so they stay under the 50,000-row aggregate
  limit. Never call `IncrementKnowledgeArticleViewCount`.
- PII discipline is production-grade from day one: no request/response bodies in logs,
  no screenshots with customer data in tickets or chats, fixtures for `DATAVERSE_MOCK=1`
  are recorded through an anonymiser (names, emails, phones replaced) before they are
  committed.
- The seed and the schema sync read production the same way: GET only, with your own account.
- Customer self-service (phase 2) needs the application user, which an admin creates in
  the production environment only when phase 2 reaches production; until then customer
  flows run against mock data.

## 2. No schema changes in phase 1
Everything phase 1 needs already exists: the 21 views, 46 charts, `adx_createdbyusername`,
issue-category tables. The portal creates **no** columns, tables, plugins, flows, web
resources or security roles in phase 1. If something is genuinely missing, it goes into a named **solution** in UAT (**K7SupportSchemaSync** already holds the components copied from production), is exported managed, tested, and only then imported into production by the Dynamics administrator in a maintenance window. Never customise
production directly.

## 3. How reads and writes stay harmless
- Agents act as themselves (delegated token): the portal can do nothing the same person
  cannot already do in the Customer Service Hub, and every change is audited to them.
- `PATCH` sends only the fields the user changed. Full-record updates would fire the
  automation that watches specific columns.
- Resolve/cancel/merge use the platform actions (`CloseIncident`, state transitions),
  the same path the model-driven app takes, so plugins and SLAs behave identically.
- No bulk operations from the portal, ever; no `$batch` larger than one case's worth.
- Reference data (products, geography, categories, option labels) is cached
  server-side for hours; per-user lists are never cached across users.
- Service protection: honour `429` + `Retry-After`, cap concurrency per user, and keep
  list pages at 25–50 rows. Expected load (65 agents) is far below the limit.
- Phase-1 rollout in production: read-only for one week (lists, detail, timeline,
  dashboards), then enable writes per feature flag (`SUPPORT_PORTAL_WRITES=notes,assign,…`).

## 4. Least privilege for the service app (phase 2)
Create a security role `Portal API` in UAT inside the solution: incident Create/Read/
Write/Append/AppendTo (organisation), contact Create/Read/Write (organisation), account
Read, annotation Create/Read, email Read, knowledgearticle/product/new_issuecategory/
new_subcategory/k7_rfe/k7_state/alletec_city/k7_region/alletec_k7contract Read. Nothing
else. Assign it to the application user; remove System Customizer after the smoke test.

## 5. Secrets and tokens
- `.env` is git-ignored; `.env.example` carries only placeholders.
- `scripts/.token_cache.json` (the probe's device-code refresh token for Navin's own
  account) is git-ignored and must stay local.
- The agent session stores Dataverse tokens server-side, encrypted (Auth.js JWT with
  `AUTH_SECRET`); the browser never sees a Dataverse token.
- Production secrets live only in the hosting platform; CI uses the sandbox or the mock mode.

## 6. Tests never touch production
- Unit tests: OData query builders, mappers and status logic against fixtures derived
  from `03-metadata-summary.md`.
- Integration/e2e: against UAT with a dedicated test agent account and a
  test contact; CI runs with `DATAVERSE_MOCK=1` (recorded responses) when credentials are absent.

## 7. Go-live gate (phase 1)
1. UAT parity demo signed off by the support lead on the five must-have views, the case
   form, the timeline and the two dashboards.
2. Production app registrations created (`06-entra-setup.md` §E); `DATAVERSE_URL`
   switched in the hosting secret store only.
3. Read-only week in production; error budget: zero `5xx` from Dataverse calls
   attributable to the portal.
4. Writes enabled feature by feature; the model-driven app stays available throughout.
5. Rollback is turning the feature flag or the route off; no data to undo because the
   portal writes the same records the app would.
