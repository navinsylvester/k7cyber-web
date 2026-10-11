# Protecting the production support system

Production Dataverse (`k7crm.crm8.dynamics.com`) runs the support desk for 65 agents and
383k cases, with heavy automation (`SYSTEM` is the modifier on 60% of cases). The
portal must reach it only when it is ready. These rules are binding for every session
working in this repo.

## 1. Environments
| | Portal Dev sandbox (new, `https://<name>.crm8.dynamics.com`) | UAT (`k7crmuat`) | Production (`k7crm.crm8.dynamics.com`) |
|---|---|---|---|
| Use | all development, tests, demos, load tests | untouched (someone else's) | go-live only |
| How it is made | **Minimal copy** of production (schema, apps, views, charts, dashboards, flows, plugins; no rows) + `scripts/dataverse-seed.py` | — | — |
| Data | reference tables in full + the last 3–6 months of cases with their contacts, accounts, notes and activities (decided 2026-10-10) | — | everything |
| `.env` default | yes (`DATAVERSE_URL`, `DV_ORG_URL`) once it exists | no | **read-only only** (§1b) until a sandbox exists |
| Writes | allowed | — | phase-1 reads first, writes behind a flag |
| App registrations | `(Dev)` pair | — | separate `(Prod)` pair |

Creating the sandbox (Power Platform admin, see `06-entra-setup.md` §C): Manage →
Environments → New → type **Sandbox**, region India, Dataverse yes, no sample data →
then on the production environment choose **Copy** → target the new sandbox → **Minimal
copy**. After the copy the sandbox is in administration mode with background operations
disabled; before enabling them, disable every server-side-sync mailbox and review plugins
and flows that send email or SMS, because they came across with the copy. The seeded
rows are real customer data for the last months: treat the sandbox like production for
access and never log its payloads.

Seeding (reads production with your own account, writes only to the sandbox, refuses
the production host as a target):
```
python3 -I scripts/dataverse-seed.py --target https://<sandbox>.crm8.dynamics.com --months 3 --dry-run
python3 -I scripts/dataverse-seed.py --target https://<sandbox>.crm8.dynamics.com --months 3
```
Start with three months (≈7k cases, ≈36k emails, ≈12k notes, about an hour of writes);
six months doubles that (dry run 2026-10-10: 13,932 cases, 71,511 emails, 24,231 notes,
9,170 contacts, 928 accounts) and can be added later by re-running with `--months 6`,
since existing records are skipped.
It preserves record GUIDs and case numbers, maps owners by user principal name (falls
back to you), resolves and closes cases to their production state, omits attachment
bodies unless `--attachments-max-mb` is set, and writes a count/error report to
`migration/dataverse-seed-report.json`. Re-running skips records that already exist.

## 1b. Interim mode (decided 2026-10-11): read-only development against production
The tenant is over its Dataverse database capacity, so creating or copying a sandbox is
blocked until capacity is bought or reclaimed, and UAT cannot be refreshed either. Until
a writable sandbox/UAT is available, development runs **read-only against production**:
- `DATAVERSE_URL=https://k7crm.crm8.dynamics.com` is allowed on developer machines only
  with `DATAVERSE_WRITES_ENABLED` unset. The Dataverse client in `src/lib/dataverse/`
  **hard-refuses** POST, PATCH, DELETE, `$batch` and action calls (`CloseIncident`,
  `AddToQueue`, …) when the target host is `k7crm.crm8.dynamics.com` or
  `k7crm.api.crm8.dynamics.com`, regardless of environment variables. A unit test pins this.
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
- Scope while read-only: M0, M1, M3 and the read parts of M4 (`08-implementation-plan.md`).
  Write features are built against mock mode and verified the day a writable
  environment exists; `scripts/dataverse-seed.py` is ready for that environment.
- Customer self-service (phase 2) needs the application user, which an admin creates in
  the production environment only when phase 2 reaches production; until then customer
  flows run against mock data.

## 2. No schema changes in phase 1
Everything phase 1 needs already exists: the 21 views, 46 charts, `adx_createdbyusername`,
issue-category tables. The portal creates **no** columns, tables, plugins, flows, web
resources or security roles in phase 1. If something is genuinely missing, it goes into
a named **solution** in the Portal Dev sandbox, is exported managed, tested, and only then imported into
production by the Dynamics administrator in a maintenance window. Never customise
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
Create a security role `Portal API` in the Portal Dev sandbox inside the solution: incident Create/Read/
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
- Integration/e2e: against the Portal Dev sandbox with a dedicated test agent account and a
  test contact; CI runs with `DATAVERSE_MOCK=1` (recorded responses) when credentials are absent.

## 7. Go-live gate (phase 1)
1. Sandbox parity demo signed off by the support lead on the five must-have views, the case
   form, the timeline and the two dashboards.
2. Production app registrations created (`06-entra-setup.md` §E); `DATAVERSE_URL`
   switched in the hosting secret store only.
3. Read-only week in production; error budget: zero `5xx` from Dataverse calls
   attributable to the portal.
4. Writes enabled feature by feature; the model-driven app stays available throughout.
5. Rollback is turning the feature flag or the route off; no data to undo because the
   portal writes the same records the app would.
