# The product desk: how support hands bugs, enhancements and samples to engineering and Labs

Design, 2026-10-14 (revised the same day after Navin's decisions, §12). Status: **phase A built 2026-10-14** (`09-portal-guide.md` §4f);
phases B and C are not built. This file is the agreed shape; the guide records what exists.

## 0. The problem, in the data

Support escalates to engineering and to the Threat Labs today, but nothing closes the loop:

| what the CRM has | what the numbers say |
|---|---|
| Case status reasons **In Progress-Principle Support** (1) and **In Progress-Lab** (696720002) | 11 cases of 100,000 in the export sit there; nobody outside the desk can move them |
| `k7_rfe` (requests for enhancement): Open → In-Progress - Accepted → Closed / Closed – Rejected | 139 rows; **132 of 134 active ones are still "Open"**; one raised in each of 2023, 2024, 2025 |
| `k7_defect`: In Progress - Support / Threat Lab / Core support / R&D, Closed – Engineering, Closed | 76 rows, **nothing since 2020** |
| `k7_yodizid` on both: the id in the dev team's tracker (BG-2941 = bug, US-3483 = story) | 98% filled on defects, 40% on RFEs: Yodiz is where engineering actually works |

The people involved (confirmed 2026-10-14): the **dev team** works in **Yodiz**; the **Lab** has no tracker, a
workflow of its own and wants samples submitted by a script; **principal support** (the CRM spells it
"Principle Support") is the layer that coordinates with both. Nobody outside the desk has a Dynamics licence or
a sign-in anywhere near the case, so the hand-off is a call or a mail, the CRM row is never updated, and the
agent cannot tell the customer what happened.

Decisions that shape the design: one unified process for dev **and** Lab, built around Yodiz; the tracker must
be **swappable** later without rebuilding the loop; keep the CRM's RFE and defect rows truthful; follow the
industry's rule of thumb for the clocks.

## 1. The shape in one paragraph

An agent raises an **item** from a case. The item lands with **principal support**, who triage it: link it to an
existing item (same bug, more demand) or accept it, pick **engineering** or **Lab**, set a priority and create the
tracker issue through an **adapter**. Engineering and Lab then work the issue **in Yodiz**, the same way, in two
Yodiz projects; the portal **polls Yodiz** for status changes and mirrors them to the item, to every linked case
and to the CRM's RFE/defect row, through an **outbox** that can never touch production until the write flag opens.
Questions from engineering travel as a Yodiz status; answers from the desk travel back through the adapter. Lab
samples go to the Lab's own store by **script**, which registers the hash against the item and the Yodiz issue;
no sample ever enters the portal. The portal item is the **bridge record**: the stable `PD-` number, the case
links, the demand count, the customer-side state, the CRM mirror and the PII boundary. Yodiz is the
**engineering record**. Everything that knows Yodiz lives in one folder behind one interface, so the day the
tracker changes, one adapter changes.

```
customer ─► case (Dataverse) ─► agent: Escalate ─► PD-0042 raised ─► principal support: triage
                 ▲                 │ as the agent:                         │ link · accept · decline
                 │                 │  statuscode → Principle Support       │ team: engineering | lab · P1–P4
                 │                 │  note "Product desk: PD-0042 raised"  ▼
                 │                 └  k7_rfe / k7_defect row              tracker adapter ──► Yodiz issue BG-3301
                 │                                                           ▲   │ (dev project | lab project)
                 │   outbox (service identity, guarded, retried)             │   │ status · attachments
                 └── note on each linked case · k7_rfestatus / k7_defectstatus   │
                     · k7_yodizid = BG-3301 · statuscode back to the desk   poll (search by updated date)
                     · task to the support owner on "needs info"                 │
                                                                                 ▼
          sample script ─► Lab sample store (hash, ref) ─► /api/support/product/samples ─► item + issue manifest
```

## 2. Who signs in, and how

| who | door | what they do here |
|---|---|---|
| agents | the agent door (unchanged) | raise and link items from a case, answer questions, tell the customer, close |
| **principal support** | the agent door; membership `principal` by Dynamics role or listed email, the manager pattern (`requirePrincipal()`) | the triage inbox: accept, route, prioritise, create the tracker issue, decline, record a release, reopen |
| managers | the agent door, `requireManager()` | the numbers (§4.3) |
| engineering, Lab | **Yodiz**, their own login; the portal only in phase C through `entra-product` (an OIDC-only registration with no Dynamics permission, so it never waits on the pending `user_impersonation` consent and can never hold a Dataverse token) | read the hand-off and the demand behind an issue, answer a question; never a Dataverse call |
| the portal itself | a Yodiz **service user** ("K7 Support Portal") whose `api-key` and login live in `.env` / the secret store | creates and updates issues, attaches, polls |
| the sample script | a personal **portal API token** issued on the agent's profile (`support-api-tokens`, hashed), sent as `Authorization: Bearer` | registers a sample against an item |

`kind` stays `'agent' | 'customer' | 'developer'`; `principal` and `lead` are memberships resolved by email per
request and memoised ten minutes like `agentRoles`. Development: `SUPPORT_DEV_DEVELOPER=<email>` adds a
`dev-developer` door the way `dev-agent` does, so phase C can be built before the registration exists.

## 3. The item (the bridge record)

### 3.1 Kinds, teams, mirror rows
| kind | what | team | CRM mirror row |
|---|---|---|---|
| `defect` | the product misbehaves | engineering | `k7_defect`, `k7_defectstatus` In Progress – R&D |
| `enhancement` | the product should do something it does not | engineering | `k7_rfe`, In-Progress - Accepted on accept |
| `detection` | false positive, missed threat, sample for analysis, VDB question | lab | `k7_defect`, In Progress – Threat Lab |

Two teams, one process. Each team maps to one Yodiz project in settings (§5). Routing by kind is the default;
principal support can override at triage.

### 3.2 States (bridge) and where they come from
```
raised ─► tracked ─► fixed ─► released ─► closed            raised: with principal support
  │          │ ▲                  ▲                          tracked: in Yodiz; trackerStatus shown verbatim
  │          ▼ │                  │ support tells the customers, or the sweep after autoCloseDays
  │      needs-info (ball with support)
  └──────────┴──► declined (duplicate · by-design · wont-fix · cannot-reproduce · not-a-bug) ─► reopen → raised
```
| state | ball with | set by | the desk sees |
|---|---|---|---|
| `raised` | principal support | the agent's escalation, the sample script, a reopen | "With principal support, not yet triaged" + the triage clock |
| `tracked` | engineering or Lab | principal support creating the issue; afterwards **the tracker** (any Yodiz status in the ToDo or In Progress category) | "Engineering · BG-3301 · In Progress · P2 · 17.1" |
| `needs-info` | **support** | a Yodiz status mapped to it (a "Need info from support" status in the project's workflow), or principal support asking | task on the case, mail to the owner, `signal` on the band |
| `fixed` | engineering or Lab | a Yodiz Done-category status mapped to fixed | "Fixed in 17.1.0423, awaiting release" |
| `released` | support | a Yodiz status or release mapped to released, or principal support recording it (version for engineering, **VDB version** for Lab) | status reason back to In Progress-Support; *Tell the customer* |
| `declined` | support | a Yodiz status mapped to declined (Rejected, Duplicate, Won't fix), or principal support at triage, always with a reason | status reason back; the agent decides with the customer |
| `closed` | nobody | the support owner after the customers are told; or the sweep `autoCloseDays` after `released` | — |

`with: 'principal' | 'engineering' | 'lab' | 'support' | 'none'` is derived, never stored. The tracker's own
status is kept beside the bridge state (`tracker.status`, `tracker.category`) and shown verbatim, so nobody has to
learn a second vocabulary: the bridge state decides what the desk and the CRM do, the tracker status says what
engineering is doing.

### 3.3 Fields
Written by the agent at escalation (the hand-off is theirs; engineering sees what the agent chose to share, not
the raw case): `kind`, `title`, `summary` (what happens, steps, expected vs actual, workaround), `severityHint`
(blocks the customer / degraded / cosmetic), `customerImpact` in words, evidence (§3.4), and **what to do with
the case**: keep it open with product (default) or *workaround given: resolve the case, tell the customer when
it ships* (§7).

Facts copied from the case at the time (the CSAT pattern): `productId`, `productName`, `productFamily`,
`affectedVersion`, `platform`, `issueCategory`, `subCategory`, `vertical`, `casePriority`, `customerKind` and the
**account name for B2B only**. No contact name, email or phone is copied; if Lab needs a sender's address for a
sample, the agent types it into the summary, under a line that says engineering will read it.

Written by principal support: `team`, `priority` (P1–P4, §7 for the targets), `trackerProject`, `declineReason`,
`declineNote`, `releasedVersion`, `releaseNote` (one line for support and, when ticked, for customers).

Synced from the tracker: `tracker` { `kind`, `projectId`, `id`, `key` (BG-3301), `url`, `status`, `category`,
`responsible`, `release`, `syncedAt` }, `fixedVersion`, `fixedAt`.

Kept by the portal: `number` (PD-0001, sequential), `state`, `raisedBy`, `raisedAt`, `triagedBy`, `triagedAt`,
`supportOwner` (the case owner at raise time, refreshed on reads), `releasedAt`, `closedAt`, `lastActivityAt`,
`caseCount`, `sampleCount`, `mirror` (§6).

### 3.4 Evidence and samples
- **Evidence** (screenshots, logs, text, pdf, zip; 10 MB each; MIME allow-list) is stored in the upload collection
  `product-evidence` outside `public/`, served only through `/support/product/evidence/[id]` after a session check
  or with a **signed, expiring link** (HMAC of `AUTH_SECRET`, like the CSAT survey token) that the adapter puts in
  the Yodiz description so engineers can open it without a portal session. Files up to Yodiz's 10 MB attachment
  limit are also attached to the issue.
- **Samples never enter the portal.** `scripts/k7-sample-submit.py` (python 3, no dependencies, reads `.env` like
  the probe) takes a file and a case or item number: it computes the SHA-256, uploads the file to the **Lab's
  sample store** the way the Lab's own script does today (the store command or URL is configuration, not code),
  then registers `{ sha256, size, name, storeRef, note }` at `POST /api/support/product/samples` with the user's
  portal token. The portal records it in `product-samples`, links it to the item (a case number with no item raises
  a `detection` item, so the scripted path is the same escalation), and the adapter attaches a one-line manifest
  (`sample-<sha256>.txt`: hash, size, store reference, case count) to the Yodiz issue. The Lab's verdict and the
  VDB version come back as the issue's status and release, like any other item.

## 4. What each side sees and does

### 4.1 Agents (workspace)
- **Case sheet**: a new action panel **Escalate to product** (S8). Step one searches open items on the same product
  family and the words of the title: *"Is it one of these?"* → **Link** (adds the case, writes the note, counts the
  demand). Otherwise **New item**: kind, title, summary, severity hint, impact, evidence, and the case choice (keep
  open with product / workaround given). On submit, as the agent: the item is created `raised`; the case's status
  reason moves to **In Progress-Principle Support** (or stays, and the case is resolved, when a workaround was
  given); an internal note `Product desk: PD-0042 raised (defect) · with principal support` is added; the
  `k7_rfe` / `k7_defect` row is created (phase B) and its id stored on the item.
- **Product band** under the case head while an item is active (S26): `PD-0042 · Engineering · BG-3301 In Progress
  · P2 · 17.1 · with engineering`, the last line from the thread, and the one action that fits: *Answer* in
  `needs-info`, *Tell the customer* in `released`.
- `/support/workspace/product`: items raised by me and by the desk, **waiting on support** first (needs-info),
  then released and not yet told to the customer (*Tell the customer* opens the case's reply panel with the release
  line pre-filled; *Close* when done), then everything with product. The legacy RFE and defect lists move under it
  as a second tab.

### 4.2 Principal support (`/support/product`, membership `principal`)
```
/support/product                  the inbox: raised items oldest first with the triage clock (S29); items with
                                  product by team and tracker status; needs-info waiting on the desk; stale items;
                                  counters
/support/product/items            the ledger (?team&kind&state&tracker&priority&product&with&q&sort&dir&page), CSV
/support/product/items/[number]   the item: head (number, kind, bridge state, tracker key and status, team, priority,
                                  product, versions, clocks), the impact strip (S28), the hand-off and evidence, the
                                  samples, the thread (portal comments + Yodiz comments read through the adapter,
                                  one stream, S27), the activity (state changes, mirror results), the action panel
/support/product/releases         what shipped: Yodiz releases per project with their items, the VDB versions from Lab,
                                  the lines for support
/support/product/settings         leads: teams → Yodiz projects, status mapping (statuses read live from the adapter),
                                  priorities and clocks, the sample store, who is principal, notifications
/support/product/no-access        an agent who is not principal
```
Actions, one `details` form each, confirmation as a checkbox: **Accept** (team, priority, project → creates the
issue; the item goes `tracked`), **Link to existing issue** (an issue engineering already has: enter the key, the
adapter verifies it), **Decline** (reason, note), **Re-route**, **Ask support** (→ `needs-info`), **Comment**
(portal thread; pushed to the tracker as the adapter allows), **Record release** (version or VDB version, date,
release note; for when the tracker does not carry releases), **Reopen**, **Close**.

### 4.3 Managers
Two KPI cards on the overview: **Waiting on product** (open items, oldest in mono) and **Product turnaround**
(median working days raised → released in the period). `/manage/product` on the period switch: items by team,
kind and state; triage-target compliance; update-cadence compliance (§7); declined share and reasons; demand (cases
per item, top items); the cases behind every number. The SLA engine gains the `with-product` reading (§7).

### 4.4 Engineering and Lab
In Yodiz: the issue carries the `PD-` number in its title (`[PD-0042] …`), the hand-off in the description, the
evidence as attachments and signed links, the sample manifests, and the demand count refreshed in the description
when cases are added. They move the status as they do today; one extra status in each project's workflow, **Need
info from support**, is the question channel. Phase C gives them the portal's item page read-only plus *Answer*.

### 4.5 Customers (portal), phase B
Portal-only, no CRM change: on a case with an active item the hint reads *"Our product team is working on
this."*; on `released`, when the agent ticked *show the customer*, the release line: *"Fixed in version 17.1.
Update K7 and tell us if it persists."* Cases resolved with a workaround get the release mail from the
*Tell the customer* list, which includes them.

## 5. Data model (Payload, group "Product desk")

| collection / global | one row is | notes |
|---|---|---|
| `product-items` | an item (§3.3) | `number` unique; indexes on `state`, `team`, `productFamily`, `tracker.key`, `lastActivityAt` |
| `product-item-cases` | one case linked to one item | `itemId`, `caseId`, `ticket`, `title`, `productName`, `vertical`, `casePriority`, `customerKind`, `accountName`, `supportOwner`, `caseChoice` (`keep-open` · `workaround-resolved`), `toldAt`, `linkedBy`, `linkedAt`, `unlinkedAt`; unique (`itemId`, `caseId`) |
| `product-item-events` | one entry of the thread or the activity | `itemId`, `kind` (`comment` · `tracker-comment` · `state` · `tracker-status` · `route` · `link` · `ask` · `answer` · `sample` · `mirror`), `side` (`support` · `principal` · `engineering` · `lab` · `system`), `by`, `text`, `from`, `to`, `evidence[]`, `externalId` (dedupes tracker comments), `at` |
| `product-samples` | one submitted sample | `itemId`, `sha256` (indexed), `size`, `name`, `storeRef`, `submittedBy`, `note`, `manifestAttached`, `at` |
| `product-evidence` | an uploaded file | upload collection, `staticDir` `uploads/product/`, MIME allow-list, 10 MB |
| `product-mirror` | one queued CRM write | the outbox (§6): `itemId`, `caseId?`, `op`, `body`, `state` (`pending` · `done` · `failed` · `skipped`), `attempts`, `lastError` (code only), `doneAt` |
| `product-tracker-sync` | one poll or push against the tracker | `tracker`, `projectId`, `direction`, `op`, `ref`, `result`, `requests` (for the rate budget), `at` |
| `support-api-tokens` | one personal token | `userId`, `name`, `hash`, `lastUsedAt`, `revokedAt`; the plain token is shown once |
| `product-settings` (global) | the configuration | `teams[]` {key, name, trackerProject, inboxEmail, leads[]}; `principals` {roles[], emails[]}; `priorities[]` {key, triageHours, updateEveryDays, label}; `statusMap[]` {tracker, projectId, statusCode, statusName, state}; `tracker` {kind, pollMinutes, pollInBusinessHoursOnly, dailyBudget}; `samples` {storeHint}; `mirror` {enabled, createCrmRows, notesOnLinkedCases, statusBack}; `clock` {pauseWhileWithProduct, autoCloseDays}; `notify` {…} |

Written only by the portal (`create: () => false` in the admin, `overrideAccess` from the local API), read in
`/admin` by admins. Pure model in `src/lib/support/product-model.ts` (states, `canMove(side, from, to)`,
`withOf`, the status-map resolution, the clocks), tested without a tenant; `product.ts` the server side;
`product-mirror.ts` the outbox; `src/lib/support/tracker/` the adapters (§8).

## 6. The CRM mirror: how the Dynamics flow stays untouched

1. **Nothing new in Dataverse.** No column, table, plugin, flow, web resource or role. Every write names a field
   or action the desk uses today: `statuscode` on the case, an `annotation`, a `task`, `k7_rfestatus`,
   `k7_defectstatus`, `k7_yodizid`, and the create of a `k7_rfe` / `k7_defect` the Hub form already does.
2. **Writes at escalation run as the agent**, synchronously, through the guarded client: that is what the agent
   does by hand now, audited to them. If a write fails the item still exists and the write lands in the outbox.
3. **Writes caused by the tracker or by principal support go through the outbox** as the **service identity**
   (`{ kind: 'service' }`), the identity customer writes and the sweep already use: the application user of
   `06-entra-setup.md` §B in production, the probe token in development. Drained by the sweep's product pass, by
   *Retry* on the item, and by the next agent who opens a linked case (then as that agent). Entries carry the
   target state, so a retry after a partial failure is safe.
4. **The production guard still decides.** `assertWriteAllowed` refuses every non-GET to the production host; the
   outbox records `skipped` with the reason, the item shows *"Mirror paused: production is read-only"*, and the
   loop keeps working inside the portal and Yodiz. **The product desk can go live before any production write is
   enabled**: the escalation snapshot is a read. When `SUPPORT_PORTAL_WRITES` gains `product`, the backlog drains
   in order.
5. **Surgical PATCH, platform actions, no bulk**: `statuscode` alone through `setStatusReason`; notes and tasks by
   create; never a full-record update; never `$batch` beyond one case's rows.
6. **Three moves of the case's status reason, all ones agents make today**: to **In Progress-Principle Support**
   when the item is raised or linked; to **In Progress-Lab** when principal support routes it to Lab; back to
   **In Progress-Support** at `released` or `declined`. The portal **never resolves or cancels a case** on
   product's behalf. If the agent moved the case meanwhile (resolved with a workaround, cancelled, waiting on the
   customer), the status write is `skipped`, not forced.
7. **Notes carry the trail into the Hub**: `Product desk: PD-0042 · BG-3301 moved to Fixed (17.1.0423)` on every
   linked case for every bridge-state change, so an agent who never opens the portal still sees the loop. Subjects
   start with `Product desk:`, which `isCustomerVisibleNote` does not match; customers never see them.
8. **RFE and defect rows stay truthful** (decided) for the Hub's lists, the Defect dashboard and the charts: raise
   creates the row; `tracked` writes `k7_yodizid` = the Yodiz key and the team's In Progress value; `fixed` /
   `released` write Closed – Engineering then Closed (defects) or Closed (RFEs); `declined` writes Closed –
   Rejected (RFEs) or Closed (defects).
9. **UAT is shared and real**: `07-production-safety.md` §1c applies; test items only on test cases; `mirror.enabled`
   defaults off until the first UAT verification, like `sweep.live`.

Failure modes: no service identity → outbox `pending`, shown on the item, nothing else changes. A renamed CRM
option → the sync script re-copies option sets; the mirror uses `options.ts`. A case re-routed in the Hub → status
write skipped, support owner refreshed on the next read. No path exists in which the portal writes something the
agent could not have written from the Hub.

## 7. Clocks: the industry's rule of thumb, applied

What the practice converges on (ITSM vendors' guidance and practitioner consensus, not a unique K7 rule):

- **A reason-coded pending state pauses the assignee's clock, not the customer's.** Time in "with engineering"
  stops the support engineer's resolution clock (it is not their failing) and keeps counting for the desk as a
  whole, so delays stay visible instead of hidden. Implementation: the SLA engine gains the state `with-product`
  (status reason Principle Support or Lab **and** an active item); it is excluded from the engineer's compliance
  when `clock.pauseWhileWithProduct` is on (**default on**, per the decision), shown hatched on the SLA meter with
  the word "with product", counted in its own column of the SLA strip, and the desk-wide median resolution keeps
  running. The two KPI cards of §4.3 make the wait a number managers watch.
- **The product side gets its own targets (an OLA), by priority**, so the pause is bounded by something
  measurable. Defaults, configurable in settings:

  | priority | meaning | triage (accept or decline) | update cadence while tracked | fix expectation |
  |---|---|---|---|---|
  | P1 | customers blocked, data at risk, widespread false positive | 4 working hours | every working day | hotfix / emergency VDB |
  | P2 | major function degraded, workaround exists | 1 working day | every 3 working days | next maintenance release |
  | P3 | minor defect or enhancement with demand | 3 working days | every 2 weeks | a planned release |
  | P4 | cosmetic, low demand | 5 working days | monthly | backlog, no commitment |

  Triage runs on `raised`; cadence on `tracked` (`lastActivityAt` includes tracker changes). Both read on the
  business-hours engine (09:00–18:00 IST Mon–Sat). Breaches show on the inbox and the manager report; the weekly
  digest lists them.
- **Restore first, fix later** (the incident/problem split). When a workaround restores the customer the agent
  resolves the case and the item stays open; the case stays linked with `caseChoice = workaround-resolved`, and when
  the item is `released` the *Tell the customer* list includes it. Nothing forces a case to wait for a fix.
- **Cap the tail.** `autoCloseDays` (default **14**, the portal's reopen window) closes a `released` item nobody
  closed; a reopen within that window goes back to `raised`.
- **Demand decides priority as much as severity.** The impact strip (cases, B2B accounts, verticals) is on the
  item head and in the Yodiz description, refreshed when cases are linked; principal support may raise the
  priority when demand grows, and the manager report shows items whose demand grew after triage.

## 8. The tracker behind an interface (Yodiz today, swappable)

All tracker knowledge lives in `src/lib/support/tracker/`:
```
port.ts      the Tracker interface and the neutral types (TrackerRef, TrackerStatus, TrackerChange, HandOff)
registry.ts  trackerFor(settings): picks the adapter by `tracker.kind`
none.ts      link-only: keys typed by hand, no calls (phase A, and the fallback when Yodiz is down)
yodiz.ts     the Yodiz adapter
jira.ts …    later, same interface
```
```ts
interface Tracker {
  kind: 'yodiz' | 'none' | string
  capabilities(): { create: boolean; setStatus: boolean; comment: boolean; attach: boolean; readComments: boolean; poll: boolean; webhook: boolean; releases: boolean }
  projects(): Promise<{ id: string; name: string }[]>
  statuses(projectId: string): Promise<TrackerStatus[]>            // { code, name, category: 'todo' | 'in-progress' | 'done' } for the mapping UI
  create(projectId: string, h: HandOff): Promise<TrackerRef>       // { id, key, url }
  get(ref: TrackerRef): Promise<TrackerIssue>                       // status, responsible, release, updatedAt
  setStatus(ref: TrackerRef, code: string): Promise<void>
  comment(ref: TrackerRef, text: string): Promise<void>            // best effort: a text attachment when no comment API exists
  attach(ref: TrackerRef, file: { name: string; mime: string; bytes: Buffer }): Promise<void>
  comments(ref: TrackerRef): Promise<TrackerComment[]>
  changesSince(projectId: string, since: Date): Promise<TrackerChange[]>
  url(ref: TrackerRef): string
}
```
Rules that make the swap cheap: nothing outside `tracker/` imports an adapter; items store `tracker.kind`, so
items of an old tracker keep resolving their URLs and reading their statuses after a switch; the status map is
keyed by (`tracker`, `projectId`), so a new tracker gets a new map, not a rewrite; the UI reads `capabilities()`
and hides what the adapter cannot do; routing points teams at projects by id, never by name.

**The Yodiz adapter**, from the API as published (confirm against the account's plan before building):
- Base `https://app.yodiz.com/api/rest/v1/`; `POST /login` with the service user's email and password plus the
  `api-key` header returns an `api-token`; both headers on every call. The key is generated in Yodiz
  administration → API. `.env`: `YODIZ_API_KEY`, `YODIZ_EMAIL`, `YODIZ_PASSWORD`.
- Create: `POST /projects/{id}/issues` (title `[PD-0042] …`, description = the hand-off with the impact strip and
  signed evidence links, severity and priority from the item, `tags` `pd-0042` and the team). Status:
  `PUT /issues/{id}` with `status.code`. Attach: `POST /projects/{id}/attachments?itemType=issue&itemId=…`
  (10 MB collectively). Read: `GET /projects/{id}/issues/{issueId}?fields=all`,
  `GET /projects/{id}/issues/{issueId}/comments`, `GET /projects/{id}/releases`. Statuses and their categories:
  `GET /meta?projectId=…&itemType=issue` (cached a day).
- **No comment-create endpoint is documented**, so `comment()` attaches `support-<date>.txt` and the question
  channel is a **status** ("Need info from support") the project's workflow carries; the agent's answer flips the
  status back and attaches the text. If the account's API turns out to create comments, the adapter uses it and
  nothing else changes.
- **No outbound webhook**, so the portal **polls**: `POST /projects/{id}/search?itemType=issue` with
  `startUpdatedDate` = the last successful poll, one call per project per poll. The published limit is **30
  requests per minute and 400 per day per IP**, so the budget is designed in: `pollMinutes` default **30**,
  business hours only (≈18 polls × 2 projects ≈ 36 calls a day), writes on demand (≈2 per item change), `meta`
  cached, every call counted in `product-tracker-sync`, and the adapter stops at 80% of `dailyBudget` and says so
  on the inbox. Near-real-time later: Yodiz's documented Zapier integration can post an issue change to
  `/api/support/product/tracker` (shared secret), which the same `changesSince` code consumes; that is phase C.
- Keys look like `BG-3301` (bug) and `US-3483` (story), which is what `k7_yodizid` already holds.

## 9. Notifications
Through `sendMail` (`SMTP_URL`, else the server log), bodies with number, title, state and link, never the
summary: to the team inbox on accept and re-route (Yodiz notifies its own users too); to the support owner on
needs-info, fixed, released and declined; to principal support on raise, on a new linked case and on a reopen; to
the leads a weekly digest (inbox past the triage target, cadence breaches, released and not closed, rate budget
used). In-portal: the counters on every home page. A per-team webhook URL (Teams or Slack) is one field in
settings for later.

## 10. Phasing

| phase | what | tracker | CRM writes | gate |
|---|---|---|---|---|
| **A · the loop** | collections, `product-model.ts` + tests, `principal` membership, the escalate panel (link or new, case choice), the product band, `/support/workspace/product`, the inbox and item pages, the thread, evidence, mail; the `none` adapter (keys typed by hand) | `none` | at escalation only, as the agent (status reason, note); the outbox records the rest as `pending` | UAT demo on test cases: raise, triage, type a key, ask, answer, fix, release, tell, close; unit tests on transitions, clocks and the status map |
| **B · Yodiz, samples, numbers** | the Yodiz adapter (create, status, attach, comments read, poll with budget), the mapping UI reading statuses live, the question status, `k7-sample-submit.py` + the samples API and tokens, the outbox drain in the sweep and on the item, manager cards and `/manage/product`, the `with-product` SLA state, the customer's hint (the `k7_rfe` / `k7_defect` rows, `k7_yodizid`, status back to the desk, notes on linked cases and the legacy lists under the product tab were pulled into phase A on 2026-10-14) | `yodiz` | the outbox as the service identity, `mirror.enabled` on | verified on UAT with a Yodiz sandbox project: an issue created from a test case, a status change polled into the item, the Hub showing the note and the RFE/defect status; the budget report |
| **C · reach** | the `entra-product` door and read-only item pages for engineering and Lab, releases page from Yodiz releases, known issues (a Labs page), the Zapier bridge, team webhooks, the digest | same | none new | per feature |
| **production** | Payload-only parts ship with the portal; the escalation's CRM writes and the outbox drain sit behind `SUPPORT_PORTAL_WRITES=…,product`; until then the outbox accumulates and the UI says so | Yodiz production projects | the guard decides | the portal's go-live gate (`07` §7), then the `product` flag in a later window |

## 11. Design system
Section 10 · Product desk of `portal.css`, parts in `design-system/components/SupportParts/README.md`:
- **S25 Item tag** kind and bridge state as one Tag (`Defect · Tracked`), with the tracker status beside it in
  `muted` mono (`BG-3301 · In Progress`). `tag-signal` only for `needs-info` seen by support and for `raised` past
  the triage target seen by principal support; `declined` at 60% ink; `released` solid. `PD-` dim, digits full
  weight, mono, like the case number.
- **S26 Product band** one line under a case head while an item is active: the item tag, team and responsible,
  the target or release in mono, the last line of the thread in `muted`, one action. A 2px `signal` top rule in
  `needs-info`.
- **S27 Hand-off thread** the item's stream: timestamp column in mono, the side as an outlined (support) or solid
  (engineering, Lab) avatar, principal support outlined with a dot, dashed kind tags for state and tracker-status
  entries, tracker comments marked with the tracker's name, text at 16px, evidence as tags, system entries (mirror
  done or skipped and why, poll results) in `muted` with a dotted tag.
- **S28 Impact strip** counters on the item head: linked cases, B2B accounts, verticals, samples, first raised, last
  raised; the case count goes `acc-ink` when it grew after triage.
- **S29 Triage clock** the product side's meter: working hours since raised against the priority's triage target,
  hatched at risk, `signal` past it; on a tracked item, days since the last activity against the cadence.
No second hue: sides and states read by weight and word.

## 12. Decisions taken 2026-10-14 (Navin)
1. **Teams and process**: the dev team works in Yodiz; the Lab has no tracker and a workflow of its own today and
   will follow **the same process as dev**, in Yodiz; principal support coordinates both and is the triage layer.
   The status reasons: Principle Support = with principal support, Lab = routed to Lab.
2. **Tracker**: build around **Yodiz**, behind an adapter so it can be swapped for something else later (§8).
3. **Mirror rows**: keep creating and updating `k7_rfe` / `k7_defect`, with the Yodiz key in `k7_yodizid`.
4. **Clocks**: the industry's rule of thumb (§7): a reason-coded pause of the engineer's clock, the desk-wide clock
   keeps running, product targets by priority, restore-first with the item open, a capped tail.

## 13. Still open
- The Yodiz account: plan and the real rate limit, whether custom statuses can be added to the two projects, whether
  comments can be created through the API, a sandbox project for UAT, the service user. Owner: Navin with the dev lead.
- The Lab's sample store: what the Lab's script does today (command, destination, naming) so
  `k7-sample-submit.py` wraps it rather than replacing it. Owner: Navin with the Lab.
- Who is principal support (emails or a Dynamics role) and who leads each team.
- Priority names and targets (§7 defaults) to confirm with the support lead.
- The service identity for the outbox in production is the same application user phase 2 needs (`06` §B): plan it
  once with the CRM admin.
