# Partner portal: the build plan (written 2026-10-22; M1 built the same day)

What has to be done to deliver `01-requirements.md`, in the order it should be done, with the
decisions taken so far and a status that any session can pick up. Read `CLAUDE.md`,
`design-system/README.md` and `docs/support-portal/09-portal-guide.md` first: the partner portal
reuses the support portal's doors, Dataverse client, mail and session helpers, and the same Case
File design language. The CRM facts are in `03-dynamics-exploration.md`. Next 16 APIs differ from
training data; check `node_modules/next/dist/docs/` before writing route, cache or proxy code.

**Order decided 2026-10-22:** the learning side (training, tests, certificates: requirements §4 and
§5) is the **last phase**. The portal launches first with onboarding, deals, the dashboard,
collateral and schemes; the certificate gate on deal registration (FR-DEAL-01) is a settings switch
that stays off until the LMS exists.

**Scope decided 2026-10-22:** the portal is for a **new product** and starts fresh. No existing
customer, partner account or opportunity is imported, matched or reconciled; every partner
organisation and every deal originates in the portal, and the CRM only mirrors what the portal
creates. The sales side of the CRM (`03-dynamics-exploration.md`) is read for its column shapes,
not for its history.

## 0. Working across sessions
- **Start of a session:** read §1 (status), the last entry of §10 (session log), then the milestone
  you are on in §6. Do not re-derive the decisions in §3; reopen one only with a reason written
  into the log.
- **End of a session:** tick the tasks done in §6, move the milestone's state in §1, update the
  `status` column of §9 for every FR touched, add a dated entry to §10 with what was verified
  (`npx tsc --noEmit`, `pnpm lint`, the int tests, what was clicked on UAT) and what the next
  session starts with. `04-portal-guide.md` (created in M1) is "what is built", like the support
  portal's `09-portal-guide.md`; this file stays the plan.
- Design-system changes follow `design-system/README.md` "Keeping it current" in the same commit.
- Dataverse: UAT only (`k7crmuat`), writes behind `DATAVERSE_WRITES_ENABLED=1`, production read-only
  and refused in code (`docs/support-portal/07-production-safety.md` §1b). No schema change without
  the CRM admin (§2 there); the mapping in `03-dynamics-exploration.md` §6–8 needs none.
- Test data on UAT: create the portal's own test partner accounts and opportunities (prefix the
  names `PP-TEST `), never seed sales data from production.

## 1. Status at a glance
| milestone | what | state |
|---|---|---|
| M0 | CRM facts and decisions confirmed, questions answered by the author | **in progress**: UAT explored 2026-10-22; production counts and the author's answers remain (§7) |
| M1 | Skeleton: route group, layout, section 10 CSS, settings global, partner session kind, portal guide | **done 2026-10-22** (`04-portal-guide.md`) |
| M2 | Registration and onboarding (§3): public form, codes, review queue, approval → org, admin login, partner ID, CRM account | **next** |
| M3 | Partner sign-in, organisation profile, users and roles (§2, FR-REG-07) | not started |
| M4 | Deal registration (§7): form, routing, CRM conflict check, approval desk, protection, extension, CRM push | not started |
| M5 | Deal dashboard (§8): hourly CRM sync into a read model, cards, list, charts, reconciliation log | not started |
| M6 | Collateral library (§6) | not started |
| M7 | Schemes and eligibility (§9) | not started |
| M8 | Notifications, bell, editable templates, approval SLA, reporting, exports (§10 and the gaps) | not started |
| M9 | Hardening and staging: non-functional requirements, tests, go-live gate → **launch 1 (no LMS)** | not started |
| M10 | Training (§4): tracks, courses, modules, video progress, tests, attempts, results, admin | not started (last phase) |
| M11 | Certificates (§4 FR-TRN-07–10, §5): PDF + QR, public verification, expiry, org certificate, revoke; then the deal gate switch | not started (last phase) |

The notification spine (one `notify()` and the bell) is built in M1–M2 because every later
milestone emits events; M8 adds the editable templates and the SLA.

## 2. What it is, in one paragraph
A second signed-in area of the enterprise site, beside the support portal, for the channel of a
new product: partners apply, K7's channel team approves, partner users download collateral,
register deals and see them tracked against the CRM, join incentive schemes, and (last phase) train
and get certified. The portal is the system of record for everything the document describes
(applications, users, deal registrations, schemes, results, collateral, courses, attempts,
certificates, notifications, audit), stored in Payload/Postgres. Dynamics (Dataverse) receives a
mirror of what the portal creates: the partner account on approval, the approved deal as an
opportunity on a new end-customer account with the partner in `alletec_partnername`; the portal
then reads stage and value of **its own** opportunities back on a schedule, and the CRM wins on
disagreement (FR-DASH-11) because that is where sales closes the deal. Nothing older than the
portal is imported. The CRM has no partner-programme tables of its own
(`03-dynamics-exploration.md` §5).

## 3. Decisions (taken 2026-10-22 unless marked *confirm*)
1. **Same repo, same deployable**, as the support portal (`docs/support-portal/01-requirements.md`
   §9.5). Route group `src/app/(partner)/` with its own root layout, `partner.css` = design-system
   **section 10 · Partners**. Public marketing page `/partners` stays a Payload page.
2. **Payload is the portal's system of record; Dataverse gets a mirror.** No portal object is
   stored in the CRM beyond the account, the contact, the opportunity, its product lines and notes.
   Same mirror-through-outbox pattern as the product desk (`docs/support-portal/10-product-desk.md`):
   every CRM write is a queued job with a log row, replayable, never in the request path. **No CRM
   schema change** is needed: the mapping in `03-dynamics-exploration.md` §6–8 uses existing
   columns; the deal ID and the protection end stay in the portal, the CRM's `OPP-YYMM-NNNNN` number
   is read back as the reference. **Fresh start:** the mirror always *creates* (account, contact,
   opportunity); there is no matching against existing CRM rows, no import of history, and no
   CRM-only deals in the dashboard (FR-DASH-10 deferred until K7 asks for it).
3. **Partner identity: the portal's own one-time-code door** (`src/lib/support/otp.ts` generalised),
   session `kind: 'partner'` with `orgId`, `userId`, `roles[]`. No Entra External ID (same reasoning
   as the support portal's open decision). *Confirm* with the author that passwordless is acceptable.
4. **Mobile OTP (FR-REG-03): email code at launch, SMS behind an adapter** (`src/lib/partner/sms.ts`
   with a no-op provider) until a gateway is chosen. *Confirm* which SMS provider K7 already uses.
5. **K7 staff sign in through the existing Microsoft door** (`microsoft-entra-id`, `kind: 'agent'`).
   Their partner-portal roles (Channel Manager, Deal Desk Approver, Training Admin, Marketing Admin,
   Scheme Admin) are lists of Entra user ids/emails in the Payload global `partner-settings`, like
   `support-settings` names managers. Deal Desk Approver defaults to Channel Manager, Scheme Admin to
   Marketing Admin, as separate flags (requirements appendix 3).
6. **Partner types: Distributor, Integration Partner, VAR**, stored as a select with room for MSP.
   *Confirm* MSP (appendix 4). CRM mapping by value, never label (labels differ between UAT and
   production): Distributor → `alletec_accounttype` 2, VAR and Integration Partner → 0 with
   `alletec_accountsubtype` 3, MSP → 4 if adopted; the deal's `alletec_saleschannel` follows the same
   split (2 · 0 · 4).
7. **No tiers at launch**; visibility rules use type, certification status and country/region
   (appendix 5).
8. **Deal registration gate**: until M11 a deal needs an Approved, active organisation and an active
   user. The certificate requirement of FR-DEAL-01 is `partner-settings.deals.requireCertificate`,
   off by default, switched on after M11, with a per-organisation waiver date for the Channel Manager
   (appendix 7).
9. **Content is edited in the Payload admin** (`/admin`) by the Marketing Admin (collateral, schemes)
   and later the Training Admin (courses): that is what "without a code release" means here, and it
   avoids building a second CMS. Partners never see `/admin`. Staff who edit content get a Payload
   user with a restricted role; approvals and queues (workflows, not content) are portal pages under
   `/partners/portal/k7/…`.
10. **The opportunity goes on the end customer's account**, with the partner in `alletec_partnername`,
    the way K7's own rows are shaped (`03-dynamics-exploration.md` §2, §7). The end customer is
    created as a new customer account with a contact (no matching: fresh start). Defaults until sales
    says otherwise: `name` = `<customer>-Fresh-<product>`, `alletec_enquirysource` 1 Partner Referral,
    owner = the approving Channel Manager; all three are `partner-settings` values, not code.
11. **The dashboard reads back only the portal's own opportunities**, by the ids stored on the deal
    (`crmOpportunityId`), not by a CRM-wide filter; `alletec_partnername` is still set so the sales
    team's own views and reports see the partner. Referral deals and anything registered outside the
    portal do not appear.
19. **Products and SKUs for the new product live in the portal** (`partner-products`: name, SKU,
    family, active, optional `crmProductId`), edited by the Marketing Admin, because the CRM's
    catalogue and `alletec_productcategory` pick-list predate the product. Product lines are pushed to
    the CRM only when a `crmProductId` is set; otherwise the SKU and quantity go into the note and
    `alletec_nooflicenses`. *Ask the CRM admin* to add the product and a sub-category value when the
    product is named; until then `alletec_productcategory` = 36 Others.
12. **Certificates (M11) are PDFs generated in the server** with `pdf-lib` and a `qrcode` SVG, on the
    self-hosted Archivo, stored as Payload uploads in a private collection served only through a
    signed-in route, verified publicly at `/partners/verify/[id]`. Ids `K7P-C-xxxxxx` (individual),
    `K7P-O-xxxxxx` (organisation), unguessable.
13. **Collateral up to 200 MB** needs object storage; Payload's upload limit is 30 MB today and the
    disk is local. Until hosting is decided (`CLAUDE.md`), M6 raises the limit for the collateral
    collection only and stores on disk under `uploads/collateral/` (git-ignored); the storage adapter
    is swapped at staging (`docs/support-portal/11-staging-readiness.md`).
14. **CRM sync for the dashboard**: a scheduled job (`POST /api/partners/sync` with `CRON_SECRET`,
    like the SLA sweep) fetches the portal's own opportunities (`opportunityid in` the stored ids,
    in batches, `$select` of the dashboard fields) and writes the snapshot onto the deal
    (`partner-deals.crm`); pages read the snapshot only and show "Last updated". Differences between
    the portal's value and the CRM's go to `partner-audit` and the CRM's value wins.
15. **One extension per deal**, same length as the protection period, both configurable in
    `partner-settings` (appendix 13).
16. **Schemes carry slabs** (threshold, benefit text, amount) and targets by value; eligibility is
    computed from the portal's deals whose CRM snapshot says won (`statecode` 1, `actualclosedate`
    in the window, `actualvalue`), reviewed and published by the Scheme Admin (appendix 15).
17. **Audit**: one append-only collection `partner-audit` (who, when, object, from → to, comment)
    written by every status change (FR-REG-08, FR-DASH-11, FR-ELG-02, FR-CRT-07). Status machines
    live in `src/lib/partner/status.ts` and are unit-tested without a tenant.
18. **Video (M10): a managed host behind an adapter** (`src/lib/partner/video.ts`): the player
    reports watched ranges every 10 s and on pause/leave; completion is computed server-side from the
    union of watched ranges (FR-TRN-03). *Confirm* the host when M10 starts (Vimeo with domain
    restriction is the default assumption; Mux/Cloudflare Stream for signed URLs).

## 4. Where it lives
```
src/app/(partner)/                       own root layout (site header, noindex, dynamic, partner.css)
  partners/join/…                        public: apply (type → details → codes → terms → submitted), resume a clarification
  partners/verify/[id]                   public: certificate verification (M11)
  partners/portal/sign-in | verify       the partner door (email → code)
  partners/portal/                       partner home: status strip, what to do next, bell
  partners/portal/organisation           profile, users (Partner Admin), legal-identity edits → re-approval
  partners/portal/deals/…                list with filters, /new, /[id] (thread, attachments, extension)
  partners/portal/dashboard              cards, deal ledger from the mirror, charts, last updated
  partners/portal/collateral/…           library by product and category, search, download (signed-in route)
  partners/portal/schemes/…              open · running · closed; register; progress; /[id]/eligibility
  partners/portal/notifications          the bell's page
  partners/portal/training/…             (M10) tracks → courses → modules (player) → test → result; my certificates (M11)
  partners/portal/k7/…                   K7 staff (Microsoft door + role in partner-settings):
    applications (queue, review, decide)   · deals (queue, conflicts, decide, extensions)
    partners (all organisations, users, waiver, suspend) · schemes (registrations, eligibility, review, publish, payouts, export)
    reports · settings (→ the global)      · certificates (M11: issuance requests, revoke)
src/app/api/partners/…                   route handlers: sync, outbox drain, downloads, exports, (M10) video progress
src/lib/partner/                         session.ts (requirePartner / requireK7Role), status.ts (machines), ids.ts,
                                         registration.ts, deals.ts, conflict.ts, mirror.ts (outbox → Dataverse: account,
                                         contact, opportunity, lines, notes), sync.ts (read model), collateral.ts,
                                         schemes.ts, eligibility.ts, notify.ts, sms.ts; (M10–11) training.ts, video.ts, certificates.ts
src/collections/partner/                 the collections in §5; src/globals PartnerSettings
src/components/partner/                  parts on the design system (section 10)
src/app/(partner)/partner.css            section 10 · Partners
design-system/components/<New parts>/    README, bundle.css, preview per new part
tests/int/partner-*.int.spec.ts          status machines, scope rules, eligibility maths, conflict matcher (mock fixtures)
docs/partner-portal/                     this folder; 04-portal-guide.md = what is built
```
Auth: one Auth.js instance (`src/auth.ts`) gains a `partner` provider; `src/proxy.ts` gates
`/partners/portal/*` to `kind: 'partner'` and `/partners/portal/k7/*` to `kind: 'agent'` with a
role. Every partner query takes `orgId` as a required parameter (FR-ROLE-01, FR-DASH-03), the way
`customerScopeFilter` does for customers; a review checklist item, pinned by a test.

## 5. Data model (Payload collections, prefix `partner-`)
| collection | holds | key fields |
|---|---|---|
| `partner-applications` | one per application (FR-REG-02–08) | type, company fields, GSTIN/PAN (optional), primary contact, regions, terms version + acceptedAt, status, assignee, decisions[] (status, by, at, comment) |
| `partner-orgs` | approved organisations | partnerId (`K7P-00001`), type, legal fields, status (Approved/Suspended), crmAccountId + `alletec_accountid`, crmContactId, certificate status (M11), waiverUntil, pendingLegalEdit |
| `partner-users` | partner logins | org, name, email, mobile, roles[] (admin/sales/technical), status, lastSignIn |
| `partner-products` | the new product's catalogue for the deal form (decision 19) | name, sku, family, active, crmProductId (optional) |
| `partner-deals` | registrations (§7) | org, registeredBy, reseller (+ linked org), customer fields, products[] (partner-product, qty), expectedValue, closeDate, source, competitor, notes, attachments, status, decisions[], protectionEnds, extension, conflicts[] (portal deals), crmOpportunityId + `alletec_opportunityno`, crmCustomerAccountId, `crm` snapshot (stage, state, statusReason, estimated, actual, invoice, closeDate, modifiedOn, syncedAt) |
| `partner-collateral` | the library (§6) | product, category, file, version, tags, visibility (types, certified, countries/regions), status |
| `partner-schemes` | schemes (§9.1) | name, terms, dates, registration deadline, types, regions, products, attachment, approvalRequired, slabs[], status |
| `partner-scheme-registrations` | org ↔ scheme | acceptedBy, acceptedAt, status, decision |
| `partner-eligibility` | results per org per scheme (§9.2) | computed values, slab, benefit, deals counted, adjustments (reason), status, publishedAt, dispute, payout (status, reference) |
| `partner-notifications` | the bell (FR-NTF-01) | recipient (user, org or staff role), event, subject, body, readAt, emailedAt |
| `partner-mail-templates` | editable templates (FR-NTF-01) | event, subject, body (Lexical), enabled |
| `partner-outbox` | CRM writes to make (decision 2) | kind (account.upsert / contact.upsert / opportunity.create / lines / note), payload, attempts, lastError, doneAt, result ids |
| `partner-audit` | the trail (decision 17) | actor, at, object, action, from, to, comment |
| `partner-tracks` / `-courses` / `-modules` / `-questions` / `-progress` / `-attempts` | (M10) training content, question banks, watched ranges, test attempts | course: version, passMark, timeLimit, showAnswers; module: order, video ref, requiredShare |
| `partner-certificates` | (M11) individual and organisation certificates | kind, number, user/org, course or type, issuedAt, expiresAt, status, reason, file |
| global `partner-settings` | roles, defaults | staff roles, protection days, extension days, `deals.requireCertificate` (off), waiver, approval SLA hours, mail from, CRM switches (owner rule, enquiry source, referral counts), (M10–11) watch share, pass mark, certificate validity, reminder days |

## 6. Milestones and tasks
Tick as done; dates in the session log.

### M1 — skeleton (done 2026-10-22)
- [x] `(partner)` route group, root layout, `partner.css` with section 10 header; `design-system/README.md` lists section 10 (`PartnerParts` README, CHANGELOG)
- [x] `partner-settings` global with the role lists and defaults; `src/lib/partner/session.ts` (`requirePartner`, `requirePartnerRole`, `requireK7`, `requireK7Role`)
- [x] `partner` Auth.js provider (email code), `proxy.ts` gates, `kind: 'partner'` in the session types (and the support side ignores a partner session)
- [x] `partner-audit`, `partner-notifications`, `notify()` with email through `SMTP_URL` and the allowlist rule; `audit()`; the bell pages for both sides
- [x] `04-portal-guide.md` created; `pnpm generate:types`; int tests `partner-session` (scope, roles, settings, the two code doors) and `partner-notify` (database, `PARTNER_DB_TESTS=1`)
- Also: `partner-orgs` and `partner-users` collections (the door needs them; M2 fills them), the partner home and the K7 desk home, `pnpm partner:seed-dev`

### M2 — registration and onboarding (§3)
- [ ] `/partners/join` flow: type, company fields (+ optional GSTIN/PAN), primary contact, regions, email code (SMS adapter no-op), terms with version + timestamp
- [ ] Application status machine (Submitted → Under review → Approved / Rejected / Clarification needed; Suspended ↔ Approved) with audit rows and emails (FR-REG-08)
- [ ] K7 queue `/portal/k7/applications`: assign, decide with reason, send back; partner resumes and resubmits from the emailed link
- [ ] On approval: `partner-orgs` row with partner ID, Partner Admin `partner-users` row, invitation mail; outbox `account.create` + `contact.create` per `03-dynamics-exploration.md` §6 (create only) → ids stored
- [ ] Link from the marketing Partners page ("Join the programme")

### M3 — sign-in, organisation, users (§2, FR-REG-07)
- [ ] Partner door end to end; home page with status strip; organisation profile; Partner Admin adds/removes users and roles (one user, several roles)
- [ ] Legal-identity edits go to a pending state and a K7 re-approval queue
- [ ] Suspension blocks sign-in; scope test: a user of org A never reads org B (pinned)

### M4 — deal registration (§7)
- [ ] `partner-products` collection and admin (decision 19); form (fields of FR-DEAL-02; products from it; attachments), routing by type (Distributor names the reseller), gate per decision 8
- [ ] Conflict check against the portal's own deals (same end customer by normalised name, email domain or contact email; open or inside protection) shown to the approver only; the CRM check of `03-dynamics-exploration.md` §7 is a later switch
- [ ] Approver desk: approve / reject / request information / approve with changes; statuses and audit; emails and bell
- [ ] On approval: deal ID (`K7D-xxxxx`), protection end, outbox `opportunity.create` (end-customer account + contact, opportunity, product lines, note, attachments) per §7 of the exploration; `alletec_opportunityno` read back
- [ ] Extension request and decision; expiry by the scheduled job; withdraw; partner list with filters; edit rules of FR-DEAL-09

### M5 — dashboard (§8)
- [ ] `sync.ts`: the portal's own opportunities by stored id, in batches → the `crm` snapshot on each deal; difference rows in the audit, CRM wins
- [ ] `POST /api/partners/sync` with `CRON_SECRET`; "Last updated"
- [ ] Cards, ledger, period filter, charts (pipeline by stage, value by month, by product) on the design system's figures

### M6 — collateral (§6)
- [ ] Collection with product, category, versioning, tags, visibility rules; Marketing Admin edits in `/admin`
- [ ] Library pages with search and filters; signed-in download route; limit raised to 200 MB for this collection; storage path

### M7 — schemes and eligibility (§9)
- [ ] Scheme collection with slabs; listing by state and partner eligibility; registration with terms; approval or auto
- [ ] Progress on running schemes from the deals' CRM snapshots (provisional)
- [ ] Eligibility run after close; Scheme Admin review with adjustments, publish; partner page with gap; dispute window; payout tracking; Finance export CSV

### M8 — notifications, templates, SLA, reporting (§10 and the gaps)
- [ ] Editable templates per event, bell page, digest rules; approval SLA hours in settings and breach notices to approver and manager
- [ ] Reports for K7: pipeline by partner, scheme results, applications by state; CSV exports
- [ ] Non-functional requirements written with the author (appendix 1) and recorded here

### M9 — hardening and staging → launch 1
- [ ] Tests for every status machine, scope rule, eligibility maths and the conflict matcher (mock fixtures, anonymised)
- [ ] Staging on the same host as the support portal; object storage; SMTP; the service application user for the CRM writes
- [ ] Go-live gate like `docs/support-portal/07-production-safety.md` §7: read-only week against production, writes switched on per feature

### M10 — training (§4), last phase
- [ ] Collections and Payload admin for tracks, courses (versioned), modules, question banks (bulk CSV import); Training Admin role
- [ ] Player page on the video adapter; progress API; completion from watched ranges at the configured share
- [ ] Test engine: unlock rule, shuffled draw from the bank, time limit, scoring, stored attempts, results page with optional answers
- [ ] Progress dashboard for the user and, for the Partner Admin, the organisation (FR-TRN-11)

### M11 — certificates (§4 FR-TRN-07–10, §5), last phase
- [ ] PDF generator (individual, organisation) with QR; private upload collection; download in profile; emailed on issue
- [ ] `/partners/verify/[id]` public page (valid / expired / revoked, minimal data)
- [ ] Expiry (default 12 months), reminders at 60/30 days (a pass in the scheduled job), recertification test
- [ ] Organisation rule per type in settings; issuance request to the Channel Manager; issue, status strip, renewal, revoke with reason
- [ ] Switch `deals.requireCertificate` on with the waiver flow (decision 8)

## 7. M0 checklist: what remains before building
Done 2026-10-22: the UAT exploration (`03-dynamics-exploration.md`): the opportunity's shape, the
partner lookups in use, the sales process, the account's partner columns, the absence of any
partner-programme tables, and the field mappings for M2, M4, M5 and M7. The fresh-start decision
removed the production-volume question as a gate (the counts in the exploration's §9 are now
optional background).
- [ ] One message to the author with appendix items 3–9, 13–15 of `01-requirements.md` and decisions 3, 4, 6 of §3
- [ ] The new product's name, families and SKUs for `partner-products` (decision 19), and a word to the CRM admin about a product row and sub-category value
- [ ] The marketing Partners page content (`content/source/…` "Partners") and where "Join" sits on it
None of these blocks M1; defaults are in §3.

## 8. Environment
Existing: `SMTP_URL`, `SUPPORT_MAIL_FROM`, `SUPPORT_MAIL_ALLOWLIST`, `CRON_SECRET`, `DATAVERSE_*`,
`DATAVERSE_WRITES_ENABLED`, `SUPPORT_DEV_SERVICE=probe` (lets the outbox use the probe token on UAT in
development). New (add to `.env.example` as they are introduced): `PARTNER_PORTAL_ENABLED`,
`PARTNER_SMS_PROVIDER` + credentials, `PARTNER_UPLOAD_DIR` (default `uploads/collateral`), and for
the last phase `PARTNER_VIDEO_PROVIDER` + credentials, `PARTNER_CERT_SIGNATORY` (signature image path).

## 9. Traceability
`status`: — not started · M<n> in progress · done (date) · deferred (reason). Update per session.

| FR | milestone | status |
|---|---|---|
| ROLE-01, 02, 03 | M1, M3 | M1 done (scope rule, several roles per user and per K7 person); M3 adds the user pages |
| REG-01 … 06, 08 | M2 | — |
| REG-07 | M3 | — |
| DEAL-01 | M4 (org gate), M11 (certificate gate) | — |
| DEAL-02 … 09 | M4 | — |
| DASH-01 … 05, 08, 11 | M5 | — |
| DASH-10 | — | deferred (fresh start, decision 2) |
| MKT-01 … 04 | M6 | — |
| SCH-01 … 05 | M7 | — |
| ELG-01 … 07 | M7 | — |
| NTF-01 | M1 (spine), M8 (templates, SLA) | M1 done (`notify()`, the bell, email through the allowlist) |
| non-functional (none written) | M8 | — |
| TRN-01 … 06, 11, 12, 13, 14 | M10 | — (last phase) |
| TRN-07, 08, 09, 10 | M11 | — (last phase) |
| CRT-01 … 07 | M11 | — (last phase) |

## 10. Session log
- **2026-10-22 (1)** — Document copied from `~/office_docs/website/requirements/`, converted to
  `01-requirements.md`, gaps listed in its appendix, this plan written. No code.
- **2026-10-22 (2)** — Navin: the LMS (training, certificates) is the last phase; milestones
  reordered (M10, M11), the deal gate made a switch (decision 8). UAT explored read-only with the
  probe: `03-dynamics-exploration.md` written (opportunity shape, `alletec_partnername` is the
  partner field in use, `msa_partnerid` unused, no partner-programme tables, account partner columns,
  UAT vs production account-type labels, mappings for M2/M4/M5/M7, no schema change needed).
  Production reads were refused by the session's classifier; §9 of the exploration lists them for
  Navin.
- **2026-10-22 (3)** — Navin: the portal is for a **new product**, start fresh, no existing customers
  or deals. Decisions 2, 10, 11, 14, 16 narrowed to create-only mirroring and read-back of the
  portal's own opportunities; decision 19 added (`partner-products` in the portal); the conflict check
  runs on portal deals first; FR-DASH-10 deferred; the production counts stopped being a gate.
  **Next session starts with M1** (§7's items can run in parallel).
- **2026-10-22 (4)** — **M1 built.** `src/app/(partner)/` (layout over `portal.css` + `partner.css`, the sign-in/verify pages
  with both doors, the partner home, notifications, the K7 desk home and its notifications, the two no-access pages);
  `src/lib/partner/` (session, scope, settings model and storage, users, audit, notify, otp); collections `partner-orgs`,
  `partner-users`, `partner-audit`, `partner-notifications` and the global `partner-settings`; the `partner` Auth.js provider
  (`OtpPurpose` gains `partner-sign-in`), `proxy.ts` gates, the support side made blind to a partner session (`requireCustomer`,
  `optionalSession`, the support header and sign-in page); `HeaderShell` takes `home` and `name`; `sendMail` takes `from`;
  `PARTNER_PORTAL_ENABLED` in `.env.example`; `pnpm partner:seed-dev`. Design system: section 10 (`PartnerParts` P1–P6, README,
  CHANGELOG, `design-system.json`). Verified: `npx tsc --noEmit` clean, `pnpm lint` 0 errors, `pnpm test:int` 95 passing
  (the new `partner-session` 11 and `partner-notify` 3 with the database; the latter found two bugs, a duplicate staff email
  and an enum query on an empty role list, both fixed); on localhost the partner door clicked end to end with the seeded
  `pp-test@k7computing.com` (the address must be on `SUPPORT_MAIL_ALLOWLIST`; the code shows on the verify page without SMTP)
  and the home page rendered the organisation, the strip, the facts and the record. Not clicked: the K7 side through the
  Microsoft door (needs an interactive sign-in; the probe door was off in this environment) — Navin to open
  `/partners/portal/sign-in?staff=1` once and add his email to `partner-settings` → Staff. Note: with `AUTH_URL` set by the
  dev tunnel, sign-in redirects land on the tunnel host; `scripts/dev-tunnel.sh down` for localhost-only work. No Dataverse
  calls in this milestone. **Next session starts with M2**: `/partners/join` (type, company fields, contact, regions, email
  code, terms), `partner-applications` with its status machine in `src/lib/partner/status.ts`, the K7 applications queue
  under `/partners/portal/k7/applications`, approval → organisation + Partner Admin + invitation, outbox `account.create`
  behind `partner-settings.crm.enabled` (needs the service identity or `SUPPORT_DEV_SERVICE=probe` on UAT), the partner IDs
  (`K7P-00001`, a counter in `ids.ts`), the K7 settings page. §7's author questions still open.
