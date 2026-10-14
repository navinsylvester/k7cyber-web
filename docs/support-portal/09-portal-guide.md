# The portal as built (2026-10-13): routes, sign-in, rules, how to run it

What exists in the repo after the first build session, how the pieces fit, and what to check before
trusting a page. Read `08-implementation-plan.md` for the intent; this file is the state.

## 1. Run it
```
docker compose up -d            # Postgres for Payload (the portal itself stores nothing in Payload)
pnpm dev                        # site + admin + portal on :3000
python3 -I scripts/dataverse-probe.py get WhoAmI   # once: device sign-in, writes scripts/.token_cache.json
```
`.env` (local, git-ignored) needs, beyond the Payload keys: `DATAVERSE_URL` (UAT), `AUTH_SECRET`,
`DATAVERSE_WRITES_ENABLED=1`, and in development `SUPPORT_DEV_AGENT=probe` and
`SUPPORT_DEV_SHOW_CODE=1`. `.env.example` lists them with comments.

Then open http://localhost:3000/support (customers) or http://localhost:3000/support/sign-in?agent=1
(agents). Tests: `pnpm test:int` runs `tests/int/support-*.int.spec.ts` (guard, FetchXML shaping,
OData helpers, status mapping, one-time codes, sanitiser) without a tenant.

## 2. Sign-in: three doors, one Auth.js instance (`src/auth.ts`)
| door | who | how | session |
|---|---|---|---|
| `microsoft-entra-id` | agents | Entra ID OIDC with scope `…/user_impersonation`; the delegated Dataverse token and refresh token live in the encrypted JWT and are read server-side with `getToken` (never through `session`) | `kind: 'agent'`, `userId` = systemuserid from `WhoAmI` |
| `customer` | customers | a six-digit one-time code by email (`src/lib/support/otp.ts`): the code's hash and the registration details ride in a signed, ten-minute token in an httpOnly cookie; five attempts; the contact is created (`registerContact`) or matched (`findContactByEmail`, newest-modified active wins) when the code verifies | `kind: 'customer'`, `contactId`, `accountId` |
| `dev-agent` | developers | **development only** (`SUPPORT_DEV_AGENT=probe`, never in production builds): reuses the python probe's device-code refresh token so the workspace runs against UAT before the agent app registration has admin consent (`06-entra-setup.md` §A step 6 is still pending) | `kind: 'agent'`, `dev: true` |

`src/proxy.ts` (Next 16's middleware) gates `/support/workspace/*` to agents and `/support/cases*`,
`/support/profile` to a session; `/support`, `/support/kb*`, sign-in, register and verify are public.
Customer Dataverse calls run as the service identity (`{ kind: 'service' }`): client credentials when
`DATAVERSE_CLIENT_ID/SECRET` exist (`06-entra-setup.md` §B, not created yet), else the probe token in
development. Every customer query carries `customerScopeFilter` (contact, their account, primary
contact; active or resolved only).

**Decision to confirm (open):** `01-requirements.md` §5.1 chose Entra External ID for customer identity.
The portal's own one-time-code flow was built first because the External ID tenant does not exist
yet and the hosted sign-in page cannot carry the design system. Keeping the built flow is a real
option (one less tenant, the whole journey in the K7 language); if External ID is still wanted, add a
generic OIDC provider in `src/auth.ts` and reuse `registerContact`/`findContactByEmail` from the
`customer` provider's `authorize`.

## 3. Routes
```
/support                      help centre: search, three ways in, top articles, one signal sheet; counters when signed in
/support/sign-in              customers (email → code) and the agent door (Microsoft, dev probe)
/support/register             four details → code → contact created on verify
/support/verify               the code; shows it inline in development when no SMTP_URL
/support/cases                my cases (open | closed), /new (guided form), /[ticket] (track, conversation, reply, reopen), attachment downloads
/support/kb, /kb/[KA-number]  published, non-internal articles
/support/profile              contact details, organisation, licences/contracts
/support/workspace            agent home: my counters, my active cases, queue items, 14-day trend, status spread
/support/workspace/cases      the 21 saved views by name (?view=&q=&sort=&dir=&page=), /new, /[id] (timeline, details, related, action panels), attachments
/support/workspace/search     cases, contacts, accounts, articles
/support/workspace/dashboards/active-cases | service-manager
/support/workspace/queues     items I am working on, public queues, pick / release
/support/workspace/customers  contacts and accounts: search, pages, create, edit (state → city picker through /workspace/geo/cities)
/support/workspace/kb         read, draft, edit (publishing stays in Dynamics)
/support/workspace/products   the active catalogue by family
/support/workspace/rfe        RFEs (create, edit) and defects (read)
/support/workspace/manage     manager view (§4c): overview (KPI cards, SLA strip, trend, top engineers; ?period=7d|30d|90d|mtd)
  …/engineers (+ /[id])       engineer efficiency as cards or a sortable ledger (?view=cards|table&sort=&dir=&all=1); one engineer against the team
  …/sla (+ /export.csv)       SLA violation report: compliance, breakdowns (?by=), trend, the ledger of breaches (?kind&state&owner&priority&vertical&page) and its CSV
  …/at-risk                   the prevention board: cases past target, at risk or unanswered, the rules' verdicts, quick actions, sweep log (?state=&owner=&page=)
  …/kpis                      configuring support KPIs: targets, business hours, KPI cards and their targets, prevention rules, who is a manager
  …/no-access                 where a non-manager agent lands
/api/support/sla/sweep        POST with `Authorization: Bearer $CRON_SECRET` (body `{"live":true}` for a live run): the scheduled prevention sweep
```
Code: `src/lib/dataverse/` (client with the production guard, token sources, OData and FetchXML
helpers), `src/lib/support/` (one file per area; `session.ts` gives `requireAgent()` /
`requireCustomer()`), `src/components/support/` (parts), `src/app/(portal)/` (its own root layout,
`portal.css` = section 09 of the design system, plus the per-area CSS files merged later).

## 4. Rules the code enforces
- Writes: `assertWriteAllowed` runs before any network call; production hosts refuse every non-GET
  (`tests/int/support-guard.int.spec.ts` pins it); UAT needs `DATAVERSE_WRITES_ENABLED=1`.
- Saved views run from their own FetchXML (`shapeFetchXml`): the portal adds page, count, a sort
  override, search conditions and `returntotalrecordcount`; it never re-implements a view's filter.
  (The plan said `?savedQuery=`; FetchXML gives paging by page number and server-side sort.)
- Dashboards run each chart's aggregate FetchXML with the root filters of the view it is bound to,
  as the model-driven app does; twelve groups plus "Other".
- Customer visibility: emails on the case are shown; notes only when written through the portal
  (subject `Portal: …` from customers, `Reply to customer…` from agents). Internal notes never leave
  the workspace. Cancelled and merged cases are hidden; resolved cases can be reopened for 14 days.
- Reference data (products, categories, geography, agents, teams, queues, views, chart definitions)
  is memoised per process for an hour (`src/lib/support/memo.ts`); per-user lists are never cached.
- Errors reach the UI through `userMessage(e, audience)`: agents get the OData code, customers a
  plain sentence; bodies are never logged.
- HTML from Dataverse (notes, emails, articles) passes `sanitizeHtml` before rendering.

## 4c. The manager view (built 2026-10-13)
Who: agents holding one of the configured Dynamics security roles (defaults: System Administrator, K7 - System Admin, CSR Manager,
Customer Service Manager, Service Manager) or listed by email on the KPI page; development sign-ins pass. `requireManager()` in
`src/lib/support/session.ts` gates every page; the Manage tab appears only for them. Roles are the one per-user list that is memoised
(ten minutes), because every workspace page asks for them.

What it measures. Dataverse's own SLA columns on the case read "In Progress" on every row of this org and its KPI instances cover a
fraction of cases, so the portal computes compliance itself (`src/lib/support/sla.ts`, pure and unit-tested in
`tests/int/support-sla.int.spec.ts`): working minutes between timestamps under configurable business hours (09:00–18:00 IST Mon–Sat
by default), a target per case from the most specific matching row of the targets matrix (vertical > priority > origin; defaults
mirror the CRM's VOICE/EMAIL SLAs at 240 minutes and the "<2 h Consumer" view), "at risk" from a configurable share of the target,
paused while In Progress-Customer, Dataverse on-hold minutes subtracted. Resolution ends at the `incidentresolution` of the period
(else the resolved case's modifiedon); first response is the earliest outgoing email or desk note (notes starting `Portal:` are the
customer's), phone cases counting as answered on the call when that option is on. The CRM's KPI instance, where one exists, is shown
beside the portal reading as evidence. Raw rows are read once per period and memoised 90 seconds across managers
(`src/lib/support/metrics.ts`); readings are recomputed per request, so a changed target applies at once.

Where it is stored. Settings live in the Payload global `support-settings` (`src/collections/support/SupportSettings.ts`, edited from
the KPI page through the local API; raw form at /admin), the sweep log in the collection `support-sla-events`. Nothing is written to
Dynamics by configuration.

Prevention. Five rules (`src/lib/support/prevention.ts`): at risk and not owned by an engineer, at risk with fewer than N minutes left,
past target, no activity for N minutes, waiting on the customer for N minutes. Each carries actions (flag, internal note, add to a
queue, email the owner, email the managers) and a cooldown per case. The at-risk board shows every verdict live and offers reassign,
remind and queue on the spot (as the signed-in manager). The sweep (cron endpoint, or "Dry run now" / "Run live" on the board) records
every verdict; a live run also applies the actions, only when the settings switch is on and, by the production guard, never on
production. Mail goes through `SMTP_URL`, else the server log.

Known UAT artefacts (not bugs): the seed resolved every case on 12-10-2026, so resolution times in UAT read as the gap between the
real creation date and the seed date (almost everything "late"); the seed's notes carry its author, so "touches" credit the seed
user; the first-response proxy needs the emails and notes the seed copied. Production reads will be truthful.

## 4b. Verified on 2026-10-13 (UAT, development sign-ins)
- Agent: workspace home, My Active Cases view (columns from the view's layoutxml, sort, search), a case sheet
  (timeline with emails and notes, details, related), one internal note added on the test case CS-431163-Y0L7,
  the new-case form's customer search, the global search, both dashboards (141 active cases, six charts),
  queues, customers (search, contact page, state → city picker), products, knowledge, RFEs.
- Customer: registration of `portal.test@example.com` ("Portal Test", contact created in UAT), the one-time
  code shown on the verify page, My cases (empty state, then one row), a case opened from the guided form
  (CS-01191-V8G2 and CS-01192-C6G7, origin Web, attribution in `adx_createdbyusername`; the second starts as Received), a reply (note `Portal: reply from
  customer`; the case moved from In Progress-Customer back to In Progress-Support), the profile page.
- Manager view (same day, later): overview, engineers (cards and table), one engineer, the SLA report with its breakdowns, the at-risk
  board with verdicts, a dry-run sweep from the board and through `POST /api/support/sla/sweep` (214 active cases evaluated, 232
  verdicts recorded in `support-sla-events`), the KPI settings form saved and reloaded. No live sweep was run against UAT.
- Agent actions clicked on the test case CS-01192-C6G7: email the customer (created as an outgoing email,
  Pending Send because UAT has no mailbox), status reason, assign, add to queue. The rest ran through
  `tests/int/support-uat.int.spec.ts` on a case it created (pick and release from the default queue, log a
  call, task, edit, RFE, resolve through CloseIncident, reopen, cancel): `SUPPORT_UAT_WRITE_TESTS=1 pnpm test:int`.
- Queue actions are bound, not unbound as `02-dataverse-integration.md` first said: `queues(id)/…AddToQueue`
  with `Target`, `queueitems(id)/…PickFromQueue` with `SystemUser` and `RemoveQueueItem`, `…ReleaseToQueue`.
  Assigning to one of the seven UAT agents without a security role fails with 403; the panel says so.
- Two Dataverse rules learnt the hard way: a case whose customer is a contact must not carry that contact as
  `primarycontactid` (0x8004f865), and UAT's create automation sets a new case's status reason itself (the
  portal does not send one). Both are handled in `src/lib/support/cases.ts`.
- The test contact and case are real rows in UAT; delete them from the Customer Service Hub when the demo
  no longer needs them (mass deletes stay the CRM owner's call).

## 5. What is not done
- Entra admin consent for the agent app (needs a tenant admin); the service app registration and
  application user (§B); SMTP for the codes and notifications (`SMTP_URL`); the one-time-code
  attempt counter and send limiter are in memory (one server).
- Merge, defect create, City/State/Region admin. (Email reply from the workspace exists; sending needs a synced mailbox.)
- Approved page designs in `designs/` (the portal was built straight on the design system).
- Production: `(Prod)` registrations, `DATAVERSE_URL` switch, read-only week, feature flags
  (`SUPPORT_PORTAL_WRITES` is read nowhere yet).
- Manager view: a scheduler for the sweep (nothing calls the endpoint yet); per-status durations (the portal has no audit history, so
  "waiting on customer" pauses are coarse); CSAT and reopen-by-customer signals, which the CRM does not record; the composite score
  weights are fixed in code (`engineerStats`).
