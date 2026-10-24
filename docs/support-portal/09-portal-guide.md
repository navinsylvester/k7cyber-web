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

**A host other people can reach** (2026-10-15, `11-staging-readiness.md` §7): swap `SUPPORT_DEV_AGENT=probe` for
`SUPPORT_DEV_SERVICE=probe` (the customer side keeps the probe token as its service identity, the probe sign-in door
closes and any session it minted ends) and set `SUPPORT_MAIL_ALLOWLIST` (addresses and `@domains`): mail goes only to
listed recipients, the rest is logged as suppressed, and the one-time-code steps refuse unlisted addresses before any
contact lookup. The on-screen code is shown off localhost only when that list is set. `scripts/dev-tunnel.sh up|down` runs
the Cloudflare quick tunnel and sets or clears `AUTH_URL`, which Auth.js and `session.ts` then use in place of the request's
host (the tunnel rewrites it to localhost).

**How testers are served** (2026-10-24, `13-tester-round-1.md` TR-02): behind the tunnel, run the production server, not
`next dev`. Through the tunnel Chrome kept dev chunks that a dropped transfer had cut short (the dev server's weak ETags
revalidate a broken copy into place for good), and React then never hydrated; production chunks are content-hashed.
```
scripts/serve.sh rebuild     # stop, pnpm build, next start detached on :3000 (log: scripts/.server.log, git-ignored)
scripts/serve.sh up|down|status
```
After a code change, `rebuild`. The script stops the server by pid; `pkill -f "next …"` also kills the shell that runs it.
`next start` sets NODE_ENV=production, which would switch off the development fallbacks this machine relies on (the probe token as
the customer side's service identity, the on-screen code, the partner portal default); `K7_LOCAL_BUILD=1` in `.env` keeps them
(`src/lib/env.ts` `isDeployed()`), and `serve.sh` refuses to start without it. Never set it on a real deployment.
`pnpm dev` stays for working alone on localhost. The portal routes send
`Cache-Control: … no-transform` (`next.config.ts`): without it Cloudflare's Email Address Obfuscation rewrote every email in
the HTML into a link and a decoding script, and React's hydration failed on any page that shows an address.

Then open http://localhost:3000/support (customers) or http://localhost:3000/support/sign-in?agent=1
(agents). Tests: `pnpm test:int` runs `tests/int/support-*.int.spec.ts` (guard, FetchXML shaping,
OData helpers, status mapping, one-time codes, sanitiser) without a tenant.

## 2. Sign-in: three doors, one Auth.js instance (`src/auth.ts`)
| door | who | how | session |
|---|---|---|---|
| `microsoft-entra-id` | agents | Entra ID OIDC with scope `…/user_impersonation`; the delegated Dataverse token and refresh token live in the encrypted JWT and are read server-side with `getToken` (never through `session`) | `kind: 'agent'`, `userId` = systemuserid from `WhoAmI` |
| `customer` | customers | a six-digit one-time code by email (`src/lib/support/otp.ts`): the code's hash and the registration details ride in a signed, ten-minute token in an httpOnly cookie; five attempts; the contact is created (`registerContact`) or matched (`findContactByEmail`, newest-modified active wins) when the code verifies | `kind: 'customer'`, `contactId`, `accountId` |
| `dev-agent` | developers | **development only** (`SUPPORT_DEV_AGENT=probe`, never in production builds): reuses the python probe's device-code refresh token so the workspace runs against UAT as the probe user. The Microsoft door has worked since 2026-10-15, so this is a convenience, not a necessity; `SUPPORT_DEV_SERVICE=probe` keeps the probe token for the customer side with this door shut | `kind: 'agent'`, `dev: true` |

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
/support/cases                my cases (open | closed, with "Rate us" on unrated closed cases), /new (guided form), /[ticket] (track, conversation, reply, reopen, "How did we do?" on a closed case), attachment downloads
/support/csat/[token]         the emailed survey (public; the signed token is the authorisation; ?score= pre-selects the tile clicked in the email)
/support/kb, /kb/[KA-number]  published, non-internal articles
/support/profile              contact details, organisation, licences/contracts
/support/workspace            agent home: my counters, my active cases, queue items, 14-day trend, status spread
/support/workspace/cases      the 21 saved views by name (?view=&q=&sort=&dir=&page=; a care mark before the customer; a search says it ran in the view and links to the search of all cases), /new (?customer=&sel=contact:<id>|account:<id>), /[id] (timeline, details, related, action panels incl. Customer satisfaction; care band under the head), attachments
/support/workspace/search     cases (number, title, incident ID, the case email, the customer or primary contact's email, their phones when the query looks like a number; "20 of N" and ?all=1), contacts, accounts, articles
/support/workspace/dashboards/active-cases | service-manager
/support/workspace/queues     items I am working on, public queues, pick / release
/support/workspace/customers  contacts and accounts: search, pages (care band, satisfaction history, the manager's care-flag panel; cases "25 of N", ?cases=all), create, edit (state → city picker through /workspace/geo/cities)
/support/workspace/kb         read, draft, edit (publishing stays in Dynamics)
/support/workspace/products   the active catalogue by family
/support/workspace/product    the desk's side of the product loop (§4f): questions from product, released items to tell the customer, mine, all open;
                              ?view=rfes|defects are the CRM's own RFE and defect lists (the old /workspace/rfe redirects here; /rfe/[id] and /rfe/new stay for rows without a case)
/support/product              principal support's inbox (§4f): to triage with the triage clock, waiting on the desk, with product with the cadence, released
  …/items (+ /[number])       every item as a ledger (?state&team&kind&priority&q&sort&dir&page); the item: head, clocks, impact strip, hand-off, cases, thread, actions
  …/settings                  leads: teams, principal support, priorities and clocks, the CRM mirror switches, notifications
  …/evidence/[id]             an evidence file, served only to a signed-in agent
  …/no-access                 where an agent who is not principal support or a lead lands
/support/workspace/manage     manager view (§4c): overview (KPI cards, SLA strip, trend, top engineers; ?period=7d|30d|90d|mtd)
  …/engineers (+ /[id])       engineer efficiency as cards or a sortable ledger (?view=cards|table&sort=&dir=&all=1); one engineer against the team
  …/sla (+ /export.csv)       SLA violation report: compliance, breakdowns (?by=), trend, the ledger of breaches (?kind&state&owner&priority&vertical&page) and its CSV
  …/csat (+ /export.csv)      customer satisfaction (§4d): CSAT, average, response rate, distribution, trend, the follow-up queue of unhappy customers, breakdowns (?by=), the ledger (?score&owner&fu&source&q&page) and its CSV
  …/unhappy (+ /export.csv)   unhappy customers for management (§4e): low scores and their share, why (product · support · licensing), by product family, week by week, repeat customers, the ledger of low scores with the manager's classification (?area&reason&product&owner&fu&q&page) and its CSV
  …/at-risk                   the prevention board: cases past target, at risk or unanswered, the rules' verdicts, quick actions, sweep log (?state=&owner=&page=)
  …/kpis                      configuring support KPIs: targets, business hours, KPI cards and their targets, prevention rules, CSAT, who is a manager
  …/no-access                 where a non-manager agent lands
/api/support/sla/sweep        POST with `Authorization: Bearer $CRON_SECRET` (body `{"live":true}` for a live run): the scheduled prevention sweep, which also runs the CSAT pass (§4d)
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
- Contact and account forms (`customers/forms.tsx`, 2026-10-24): one rule each for mobile, phone (several numbers allowed,
  separated by / , or &) and email, applied by the readers and mirrored as HTML `pattern`s; a stored value that predates a rule
  does not block an edit while it is left unchanged (`keep_<field>`). A refused submit carries every value back in the query
  (`carry` / `contactFromQuery` / `accountFromQuery`) with the failing fields in `bad`. A city must belong to the chosen state.
- Lookups cleared in a form are sent as `"<nav>@odata.bind": null` on update (contacts, accounts and cases), which clears them
  in Dataverse; creates leave empty lookups out.
- The case head (`getCaseParties`, one expanded read) shows a contact customer's account, a callable number, and the case's
  *Serial key* or else the account's licence key. *Incident ID* (`k7_incidentid`) is on Details, in Edit details, on the new
  case form and in both searches; "-" reads as empty. A status reason the CRM no longer labels reads "Unknown status".

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

## 4d. Customer satisfaction (built 2026-10-14)
One question on a resolved case, answered 1 to 5 with an optional line. The CRM has no satisfaction field and production is read-only, so
everything lives in Payload: `support-csat` (one row per case: the invitation, the score, the follow-up; case facts copied in at the time so
the report never goes back to Dataverse) and `support-care-flags` (a manager's "handle with care" flag on an account or contact). The
pure model is `src/lib/support/csat-model.ts` (tested in `tests/int/support-csat.int.spec.ts`), the server side `src/lib/support/csat.ts`.

How a rating arrives. (1) The customer rates a closed case on its page or from the "Rate us" tag on the closed list. (2) The emailed
survey: `inviteSurvey` creates the row and mails five links, one per score, to `/support/csat/<token>`; the token is an HMAC of
`AUTH_SECRET` carrying the case id, number and email and expires after `surveyDays`. It goes out when an agent resolves a case in the
workspace (`inviteOnResolve`) and from the sweep for the period's resolved cases that `inviteMode` allows ("portal" = raised through the
portal, "all" = any case with an email; default "portal" because UAT's seeded cases carry real addresses), with one reminder after
`reminderAfterHours`. Mail reaches customers only through `SMTP_URL`; otherwise the invitation is logged. (3) An agent records a score the
customer gave on the phone from the case's Customer satisfaction panel (source "agent").

Low scores. A score at or below `unhappyAtOrBelow` (2) opens a follow-up (`pending`), emails the managers (`sweep.managerEmails`) when
`notifyManagersOnLow` is on, and leaves an internal note on the case through the guarded client. The follow-up queue on
`/manage/csat#follow-ups` (and the top of the overview) lists them, overdue first against `followUpMinutes` of business hours: a manager
takes one ("I will call them" → `in-progress`) and closes it with what was agreed (optionally as an internal note on the case); the agent
can close it from the case too. A later higher score never closes an open follow-up; a later low score after a closed one reopens it.

The care band. `careFrom` reads the customer's latest `careRecent` ratings inside `careWindowDays` plus any active flag: a flag wins;
an open follow-up or a low last score is **handle with care** (signal); a low score among the recent few, or an average under
`satisfiedFrom`, is **watch** (solid); otherwise a happy customer. The band is keyed on the case's customer (the account for B2B, so
every contact of the account shares it) and also matches the rater's contact. Agents see it beside the customer on the case head (with a
one-line reason under the head), as a mark before the customer in every saved view and on the home page's list, and on the contact or
account page with the history; managers set or clear the flag there (`customers/care-actions.ts`). The design language allows no second
hue, so the three bands read by word and weight: signal, solid ink, outlined.

The numbers. `loadDesk` attaches the period's rows (answered in it, or sent in it and unanswered) and every open follow-up; `summarise`
gives CSAT (share at or above `satisfiedFrom`), the mean, the response rate (answered invitations over invitations), the distribution and
the follow-up compliance. Five KPI cards (`csat`, `csat-average`, `csat-response-rate`, `csat-unhappy`, `csat-followup`) join the overview;
engineer cards, the ledger and the engineer page carry CSAT, average and low ratings, credited to the case's owner at the time of the
rating; the composite gives CSAT 20% when the engineer has responses. `/manage/csat` is the report, with `export.csv`. Settings are the
`csat` group of `support-settings`, edited on the KPI page.

Verified on UAT the same day with the development sign-in: a phone rating of 2 recorded on CS-01192-C6G7 (internal note written to the
case, "Handle with care" beside the customer, the rating in the timeline), the follow-up taken and closed from the queue, the CSAT
page's cards, distribution, breakdown and ledger. Survey mail was logged, not sent (no `SMTP_URL`).

## 4e. Why customers are unhappy (built 2026-10-14)
Management asked for a way to see the recent unhappy customers and whether it is the product, product support or something else they
are unhappy about. A low score now carries a **reason** from a fixed list of sixteen in four areas (`REASONS` in
`src/lib/support/csat-model.ts`): the product (defect, slows the computer, missed threat or false positive, install or update, missing
feature, compatibility), product support (slow to respond, took too long, not resolved, had to repeat, communication or attitude,
engineer lacked the answer), licensing and sales (activation, renewal or billing or refund, pricing) and other. Three places set it:
the customer's optional pick on the survey (the emailed page and the closed case on the portal, stored as `customerReason`), the agent
recording a phone rating, and the manager who closes the follow-up (required, on `/manage/csat` and on the case), stored as `reason`
with who and when. The desk's call wins over the customer's pick (`causeOf`); a manager can also classify or clear any low score from
the ledger on `/manage/unhappy`. The low-score mail to managers and the internal note on the case carry the customer's pick.

`/support/workspace/manage/unhappy` is the report, on the same period switch as the rest of the manager view: low scores and their share
of responses against the previous period; the split by area; the reasons ranked with the previous period beside; products folded to
their family (`productFamily`, "Total Security - 5U3Y" → Total Security) with responses, low count and share, CSAT and an area stack;
day by day (7-day periods) or week by week; the customers who rated low more than once inside the care window, whatever the period;
and the ledger of every low score (customer with care mark, case, product, score, comment, the cause tag with an inline classify form,
engineer, when, the call back and its outcome) with a CSV. Every area, reason, product and stack segment links into the filtered ledger.
The engineer page adds "low ratings laid at support", so an engineer is not marked down for a defect; the overview's CSAT block carries
the area split with a link. Pure functions (`areaCounts`, `causeLines`, `productLines`, `repeatCustomers`, `causeBuckets`) are tested
in `tests/int/support-csat.int.spec.ts`. Parts S22–S24 in `design-system/components/SupportParts/README.md`.

## 4f. The product desk, phase A (built 2026-10-14)
The loop between the desk and product (design: `10-product-desk.md`; this is what phase A built). An agent raises an **item** from a case
(action panel *Escalate to product*: kind, title, hand-off, severity, impact, evidence, and whether the case stays open with product or
was resolved with a workaround); first the panel asks *"Is it one of these?"* and offers open items on the same product family to **link**
instead. Items are the bridge record in Payload (`product-items`, with `product-item-cases`, `product-item-events`, `product-evidence`,
`product-mirror` and the global `product-settings`, group "Product desk" in /admin); the pure model (`src/lib/support/product-model.ts`:
states, who may move what, the clocks, the mirror operations) is tested in `tests/int/support-product.int.spec.ts`; the server side is
`product.ts`, the outbox `product-mirror.ts`, the tracker port and the link-only adapter `src/lib/support/tracker/`.

States: raised → tracked → fixed → released → closed, with needs-info (ball with the desk) and declined; `withOf(state, team)` says whose
turn it is. **Principal support** (agents with a configured Dynamics role, a listed email, or managers when the setting allows; the development
sign-in passes; `requirePrincipal()`) triages on `/support/product`: accept (team, priority P1–P4, a typed tracker key such as BG-3301, the
product owner's email), ask the desk, decline with a reason, record fixed and released (version or VDB version, a release line, optionally
shown to customers), re-route, re-prioritise, close, reopen. The desk answers questions, tells the customer when something shipped (posts the
release line as a portal reply) and closes, from the case band, the item page or `/support/workspace/product`. Every move writes an event into
the thread; both desks see it, customers never.

The CRM mirror (`10-product-desk.md` §6) writes only what agents write today and runs **as the acting agent** through the guarded client:
at raise, an internal note `Product desk: PD-0001 raised (defect)` and the status reason to **In Progress-Principle Support** (when the case is
kept open); at accept for the Lab, **In Progress-Lab**; on a question, a note and a **task** for the support owner; at released or declined,
back to **In Progress-Support**, only if the case still sits in a loop status. Every write is recorded in `product-mirror` (done, skipped,
pending, failed) and summarised as a system entry in the thread; `mirror.enabled` in the settings (default off) decides whether anything is
sent at all; a refused or failed write never blocks the product side and can be retried from the item. Clocks (§7 of the design): the triage
target and the update cadence per priority on the desk's business hours, shown as meters on the inbox and the item.

**Merged with the RFEs the same day** (Navin: "shouldn't RFEs and product be merged?"): one workspace tab, *Product desk*; the CRM's RFE and
defect lists are two views of `/support/workspace/product`; the case sheet's *Convert to RFE* form is gone (an enhancement item is the way) and its
Related tab lists product items first, then the CRM rows read-only. The CRM rows moved from phase B into phase A: with `mirror.createCrmRows` on
(default), raising an enhancement creates the `k7_rfe` row (Customer RFE, received from Customer, Open, linked to the case, product, account,
vertical) and raising a defect or detection creates the `k7_defect` row (In Progress - Support, priority from P1–P4 as Critical/High/Medium/Low,
linked to the case and the customer), as the agent; the item stores the row's id and number (`crmRef`, shown on the item and in the desk's lists).
Accept, fixed, released, declined, reopen, a priority change and a tracker key then update the row: RFE Open → In-Progress - Accepted → Closed /
Closed – Rejected; defect In Progress - Support → Threat Lab or R&D → Closed – Engineering → Closed; the tracker key goes to `k7_yodizid`.
`crmRowOpsFor` in the model is tested; `createDefect`/`updateDefect` join `rfe.ts`. A case that already has an item can raise another
(*Raise another item from this case* under the Product panel).

Merge verified on UAT the same evening, rows on: PD-0002 (enhancement) raised from CS-01194-B4N9 created **RF0071** (Customer RFE, received from
Customer, Open, linked to the case and the product); accepted with tracker key US-4001 → the row read In-Progress - Accepted with the YODIZ id;
declined as works-as-designed → Closed – Rejected, the case back to In Progress-Support. PD-0003 (defect, severity blocks) created **DF0041**
(In Progress - Support, High, linked to the case, customer Portal Test, incident number filled); accepted for the Lab at P1 with BG-7001 → the
row read In Progress – Threat Lab, Critical, BG-7001, and the case moved to In Progress-Lab. The old `/support/workspace/rfe` list redirected to
the desk's CRM view, where both rows appear with their status tags. Note for anyone driving the portal with browser automation in dev mode: the
first form submit on a freshly compiled page is sometimes swallowed before hydration; the server log shows no POST, a second click goes through.

Verified on UAT on 2026-10-14 with the development sign-in, mirror on: PD-0001 raised from the test case CS-01194-B4N9 (status reason moved to
In Progress-Principle Support, the note in the timeline, the band under the head); accepted for engineering at P1 with tracker key BG-9001;
a question asked (a task and a note on the case, the band went signal) and answered from the case page; marked fixed in 17.1.0423 and
released in 17.1 with a release line shown to customers (the case went back to In Progress-Support); *Tell the customer* from the case band
posted the release line as a portal reply and marked the case told; the item closed from `/support/workspace/product`. Every mirror write
read "done" in the thread. Mail went to the server log (no `SMTP_URL`). PD-0001 and those notes stay in UAT and Payload as test data. Not in phase A: the Yodiz adapter,
`k7_rfe`/`k7_defect` rows and `k7_yodizid`, the sweep's outbox drain, the manager numbers and the `with-product` SLA state, the customer's
hint, the sample script, the engineering door (phases B and C of the design).

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
- Learnt on 2026-10-14: the saved case views filter on `casetypecode eq 1` (Case), and the portal's customer create sent no case type, so
  portal-raised cases were invisible in every agent view until an agent set the type; `createCustomerCase` now sends it. The two test
  cases from 13-10 were typed by hand.
- Two Dataverse rules learnt the hard way: a case whose customer is a contact must not carry that contact as
  `primarycontactid` (0x8004f865), and UAT's create automation sets a new case's status reason itself (the
  portal does not send one). Both are handled in `src/lib/support/cases.ts`.
- The test contact and case are real rows in UAT; delete them from the Customer Service Hub when the demo
  no longer needs them (mass deletes stay the CRM owner's call).

## 5. What is not done
- **Tester round 1 (2026-10-24):** the fixes are built and verified (`13-tester-round-1.md`); what remains there are the decisions
  D-1…D-4 (with TR-13, which waits on D-4), TR-15 (a screenshot from the tester) and U-1.
- Product desk phases B and C (`10-product-desk.md` §10): the Yodiz adapter and status map, the CRM rows at raise and `k7_yodizid`, the
  outbox drain in the sweep and the auto-close, the manager cards and `/manage/product`, the `with-product` SLA state, the customer's hint,
  `k7-sample-submit.py` and the samples API, the engineering door, releases, the Zapier bridge. Phase A's mirror runs as the acting agent, so
  nothing needs the service identity yet.
- Entra admin consent for the agent app (needs a tenant admin); the service app registration and
  application user (§B); SMTP for the codes and notifications (`SMTP_URL`); the one-time-code
  attempt counter and send limiter are in memory (one server).
- Merge, defect create, City/State/Region admin. (Email reply from the workspace exists; sending needs a synced mailbox.)
- Approved page designs in `designs/` (the portal was built straight on the design system).
- Production: `(Prod)` registrations, `DATAVERSE_URL` switch, read-only week, feature flags
  (`SUPPORT_PORTAL_WRITES` is read nowhere yet).
- Manager view: a scheduler for the sweep (nothing calls the endpoint yet, so emailed surveys and reminders only go out on a manual
  "Run live"); per-status durations (the portal has no audit history, so "waiting on customer" pauses are coarse); reopen-by-customer
  signals, which the CRM does not record; the composite score weights are fixed in code (`engineerStats`).
- CSAT (§4d): `SMTP_URL` before any survey reaches a customer; a scheduler for the sweep; ratings stay in Payload (no CRM column) and
  one rating per case (a re-rating replaces it); the care band has no per-contact override on account cases; no survey on cancelled cases.
