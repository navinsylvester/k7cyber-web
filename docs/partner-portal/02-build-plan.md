# Partner portal: the build plan (written 2026-10-22; M1 to M4 built the same day)

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
| M2 | Registration and onboarding (§3): public form, codes, review queue, approval → org, admin login, partner ID, CRM account | **done 2026-10-22**, clicked end to end on both sides and the CRM job run on UAT (`04-portal-guide.md` §3–5) |
| M3 | Partner sign-in, organisation profile, users and roles (§2, FR-REG-07) | **done 2026-10-22**, clicked end to end on both sides on localhost (`04-portal-guide.md` §3–5, §7) |
| M4 | Deal registration (§7): form, routing, CRM conflict check, approval desk, protection, extension, CRM push | **built 2026-10-22** (sessions 8–9), **clicked on both sides and the opportunity landed on UAT 2026-10-23** (session 10: OPP-2610-00268) |
| M5 | Deal dashboard (§8): hourly CRM sync into a read model, cards, list, charts, reconciliation log | **next** |
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

### M2 — registration and onboarding (§3) (done 2026-10-22)
- [x] `/partners/join` flow: type, company fields (+ optional GSTIN/PAN), primary contact, regions, email code (SMS adapter no-op), terms with version + timestamp
- [x] Application status machine (Submitted → Under review → Approved / Rejected / Clarification needed; Suspended ↔ Approved) with audit rows and emails (FR-REG-08)
- [x] K7 queue `/portal/k7/applications`: assign, decide with reason, send back; partner resumes and resubmits from the emailed link
- [x] On approval: `partner-orgs` row with partner ID, Partner Admin `partner-users` row, invitation mail; outbox `account.create` (account + contact in one job, resumable) per `03-dynamics-exploration.md` §6 (create only) → ids stored; run on UAT 2026-10-22 (the mirror switch is off by default)
- [ ] Link from the marketing Partners page ("Join the programme"): the page itself is not written yet (§7); until then the link sits in the header seed's Partners column, on the partner sign-in page and in the portal footer
- Also: the K7 settings page (`/partners/portal/k7/settings`), the desk strip (`K7Nav`), `partner-counters` for the ids, `POST /api/partners/outbox` for the drain

### M3 — sign-in, organisation, users (§2, FR-REG-07) (done 2026-10-22)
- [x] Partner door end to end; home page with status strip; organisation profile (`/partners/portal/organisation`: the facts, the details form that saves at once); Partner Admin adds, edits, disables, re-enables and removes users and their roles (one user, several roles; `/organisation/users`, `/organisation/users/[id]`); the organisation always keeps a standing Partner Admin and nobody disables or demotes themselves
- [x] Legal-identity edits (legal name, GSTIN, PAN) go to `pendingLegalEdit` (one at a time, withdrawable) and the K7 partners ledger `/partners/portal/k7/partners` (view *Edits waiting*); the Channel Manager approves (applied) or declines (with a note) on the partner sheet; the admins are told
- [x] Suspension with a reason (every user emailed; the door refuses; sessions end on their next request) and reinstatement on the K7 sheet; the certificate waiver (decision 8) set and cleared there; scope test pinned (`partner-scope`: organisation A never reads B by list or by id, the trail scoped the same way)
- Not in M3: an `account.update` CRM job for an approved legal-name change (the mirror is create-only, decision 2; the CRM admin carries a rename over by hand; noted on the K7 sheet)

### M4 — deal registration (§7) (built 2026-10-22)
- [x] `partner-products` collection and admin (decision 19); form (fields of FR-DEAL-02; products from it; attachments), routing by type (Distributor names the reseller, linked to an organisation when the name matches), gate per decision 8 (Partner Admin or Sales, active, approved organisation; certificate or waiver when the switch is on)
- [x] Conflict check against the portal's own deals (same end customer by normalised name, email domain or contact email; open or inside protection) stored at submission and run live on the K7 sheet, shown to the approver only; the CRM check of `03-dynamics-exploration.md` §7 stays a switch, not built
- [x] Approver desk: approve / reject / request information / approve with changes (value, closure, customer); statuses, thread and audit; emails and bell to the registering user and the organisation's admins
- [x] On approval: the `K7D-` number (given at submission, see session 8), protection end, outbox `opportunity.create` (end-customer account + contact, opportunity on it with the partner in `alletec_partnername`, product lines where a CRM product exists, note, attachments ≤ 4 MB) per §7 of the exploration; `alletec_opportunityno` read back. **Not yet run on UAT.**
- [x] Extension request and decision; expiry and the protection-ending notice by the sweep (`POST /api/partners/deals/sweep`, the button on the queue); withdraw; partner list with filters (status, product, date, value); edit rules of FR-DEAL-09 (partner edits after a request, K7 amends after approval, notes and files while live)
- Not in M4: the CRM-side conflict check; the approval SLA notice (M8); editable mail templates (M8)

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
| ROLE-01, 02, 03 | M1, M3 | done 2026-10-22 (M1: the scope rule, several roles per user and per K7 person; M3: the user pages, the standing-admin rule, the scope pinned against the database) |
| REG-01 … 06, 08 | M2 | done 2026-10-22 (REG-03: email code; mobile code behind the SMS adapter, `skipped` and shown as such until a gateway exists; REG-06: the CRM account and contact through the outbox, verified on UAT as ACC-2610-00154) |
| REG-07 | M3 | done 2026-10-22 (legal name, GSTIN and PAN proposed → Channel Manager approves or declines; the CRM rename stays manual) |
| DEAL-01 | M4 (org gate), M11 (certificate gate) | M4 done 2026-10-22 (the organisation and user gate; the certificate half is the switch, off until M11, with the waiver) |
| DEAL-02 … 09 | M4 | done 2026-10-22 (DEAL-04: over portal deals, the CRM switch not built; DEAL-06: the opportunity job written, not yet run on UAT; DEAL-07: one extension, decision 15) |
| DASH-01 … 05, 08, 11 | M5 | — |
| DASH-10 | — | deferred (fresh start, decision 2) |
| MKT-01 … 04 | M6 | — |
| SCH-01 … 05 | M7 | — |
| ELG-01 … 07 | M7 | — |
| NTF-01 | M1 (spine), M8 (templates, SLA) | M1 done (`notify()`, the bell, email through the allowlist); M2 sends the application events (staff bell + mail, applicant mail, the invitation); M4 the deal events (submitted, resubmitted, decided, amended, extension asked and decided, withdrawn, expired, protection ending) |
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
- **2026-10-22 (5)** — **M2 built.** The join flow `src/app/(partner)/partners/join/` (type → company and contact → code → terms → submitted;
  `status` from the emailed link with number + key; the draft in `partner-applications` from the first step, its resume key in an httpOnly
  cookie on `/partners/join`); `src/lib/partner/status.ts` (the application machine and the organisation toggle, pure), `ids.ts`
  (`K7P-`/`K7A-`/`K7D-` from `partner-counters` by compare-and-swap), `registration-model.ts` (bands on the CRM's values, validation,
  the account and contact bodies), `registration.ts` (draft, submit, queue, assign, decide, approve → organisation + Partner Admin +
  invitation + outbox job), `mirror.ts` (`partner-outbox`, `account.create` runs as the service identity with region/state/city/country
  looked up by name; `drainOutbox`), `sms.ts` (adapter; `PARTNER_SMS_PROVIDER`), `join.ts`; the K7 side `k7/applications` (counters,
  views, search, ledger), `k7/applications/[number]` (the sheet, the decision panel, the record, the organisation and the CRM job with
  Run/Retry), `k7/settings` (the whole global as a form), `K7Nav`; `POST /api/partners/outbox`; the `partner-join` OTP purpose. Design
  system: section 10 P7–P10 (README, `partner.css`, CHANGELOG, `design-system.json`). Verified: `npx tsc --noEmit` clean, `pnpm lint`
  0 errors, `pnpm test:int` 108 passing with `PARTNER_DB_TESTS=1` (new: `partner-registration` 12 pure, `partner-onboarding` 2 with the
  database: draft → submitted → clarification → resubmitted → approved, the organisation, the Partner Admin, the pending job, the
  duplicate-email refusal, consecutive numbers); on localhost the join flow clicked end to end (the code shown on the verify page,
  both mails in the console, K7A-00003 "PP-TEST Join Flow Private Limited" left in the queue for the K7 click-through). Not clicked:
  the K7 side (needs an agent session: open `/partners/portal/sign-in?staff=1` with Microsoft and list yourself as Channel Manager in
  `/admin/globals/partner-settings` → Staff first, or set `SUPPORT_DEV_AGENT=probe`); the CRM job on UAT (turn the mirror on in
  `/partners/portal/k7/settings`, then Run on the application sheet; the probe token stands in for the service identity). Found: the
  local global has no regions, so the join form skips the regions step (validation passes with none when the list is empty) — enter
  the regions in the settings. **Next session starts with M3**: the partner home's status strip is there; add the organisation page,
  users and roles for the Partner Admin, the legal-identity edit → re-approval queue, suspension (the organisation machine exists in
  `status.ts`), and the scope test. §7's author questions still open.
- **2026-10-22 (6)** — **M2 clicked through on the K7 side, with Navin's Microsoft session**, after listing him as Channel Manager
  and seeding four regions (N, S, WCE, E) in the local global by script. Queue → sheet → Take → Send back (note) → the applicant's
  status page → Edit and resubmit (South picked; the verify step skipped because the email was unchanged) → back in the queue as
  Submitted with the assignee kept → Approve from Submitted (assigned first, then approved; K7P-00003, the Partner Admin invited,
  the full record) → Settings: mirror on → Run now. **Two findings on UAT, both fixed:** the contact has **no customer-type column**
  (`new_customertype` is the incident's, `k7_customertype` the RFE's; the exploration §4/§6 was wrong and is corrected), so the
  contact body carries none; and a job that failed after creating the account would have created a second one on retry, so the
  job now stores the account id on the organisation before the contact and resumes from there (the one orphan was pointed at by
  hand, not duplicated). Retry → done: ACC-2610-00154, `_primarycontactid` Priya Raman, type 0 (UAT label B2B), subtype Partner,
  region South, state Tamil Nadu, city Chennai, country India all resolved by name, owner the approving manager, turnover and
  size bands mapped. The onboarding test now takes a region from the settings and switches `DATAVERSE_WRITES_ENABLED` off for
  its run (a local global with the mirror on must never push the test organisation). Not clicked: the new Partner Admin's first
  sign-in (it would end the agent session in the same browser); the door itself was verified in M1. Test rows left on UAT:
  account ACC-2610-00154 and its contact, both `PP-TEST`.
- **2026-10-22 (7)** — **M3 built.** `src/lib/partner/organisation-model.ts` (pure: the details and legal validation, `legalChanges`, the user
  machine, `memberChangeError` / `memberRemoveError`), `organisation.ts` (reads, the K7 ledger and counts, `saveOrgDetails`, `proposeLegalEdit` /
  `withdrawLegalEdit`, `decideLegalEdit`, `setOrgStatus`, `setWaiver`), `members.ts` (`listMembers` / `loadMember` through the scope, `addMember`,
  `updateMember`, `setMemberStatus`, `removeMember`, `resendInvitation`); `scope.ts` gains `orgRel` (Postgres ids are numbers on a create);
  `users.ts` reads the whole organisation row; `partner-orgs` gains `suspendedReason`. Pages: `/partners/portal/organisation` (+ `/users`,
  `/users/[id]`), `/partners/portal/k7/partners` (+ `/[partnerId]`), the Partners tab and header links, the counts on both homes. Design
  system: section 10 P11–P12 (README, `partner.css`, CHANGELOG, `design-system.json`). Verified: `npx tsc --noEmit` clean, `pnpm lint` 0 errors,
  `pnpm test:int` 120 passing with `PARTNER_DB_TESTS=1` (new: `partner-organisation` 8 pure, `partner-scope` 4 with the database: the scope by
  list and by id, the member rules, propose → withdraw → propose → approve, suspend → door refused → reinstate; the test found that the
  details save needs a region when the settings list any, as the join form does). Clicked on localhost as the seeded Partner Admin: details
  saved and recorded; GSTIN and PAN proposed (the pending box with the diff; a form inside a paragraph was a hydration error, fixed); a user
  invited with two roles, disabled, re-enabled back to Invited, removed behind the confirm; own sheet shows the self-protection. Clicked on
  the tunnel host with Navin's Microsoft session as Channel Manager: the ledger with the edit counted, the sheet, Approve with a note (the
  identity applied), Suspend with a reason (the localhost partner session landed on the door with "suspended" at once), Reinstate, waiver to
  2027-03-31. PP-TEST (K7P-00000) now carries a GSTIN, a PAN and the waiver. No Dataverse calls in this milestone. **Next session starts with
  M4**: `partner-products` and its admin (decision 19), the deal form and gate (decision 8: approved organisation, active user; the waiver is
  now on the organisation), the conflict check on portal deals, the approver desk, the deal ID and protection, the `opportunity.create` job,
  extension and expiry. §7's author questions still open.
- **2026-10-22 (8)** — **M4 begun, cut short by the session's usage limit; nothing verified beyond `npx tsc --noEmit` clean.** Written and
  compiling: collections `partner-products` (decision 19), `partner-deals` (the full row: customer with `customerKey` and `emailDomain`
  for the conflict check, product lines, thread with files, protection, the one extension, stored conflicts, `crm` ids incl. `noteId`)
  and `partner-deal-files` (uploads/partner-deals, 10 MB), all registered in `payload.config.ts`; `partner-settings.deals.endingNoticeDays`
  (model, global, K7 settings page and action); `status.ts` the deal machine of §7.2 (`canMoveDeal`, the four decisions, the live /
  protected sets); `deals-model.ts` (pure: validation, `linesFrom`, the gate `registerBlocked` (admin or sales, active, approved org,
  certificate or waiver when the switch is on), protection maths, `customerKey` / `emailDomain` / `conflictsAmong`, `opportunityBodies`,
  `toDeal`); `deals.ts` (products, scoped reads by number, `listDeals` / `listDealsK7` with the FR-DEAL-08 filters, `dealCounts`,
  `filesFrom`, `submitDeal` (number at submission, conflicts stored, staff bell, receipt), `resubmitDeal`, `addDealNote`, `withdrawDeal`,
  `requestExtension`, `decideDeal` (approve / with changes / request info / reject → protection end + `opportunity.create` job),
  `amendDeal`, `decideExtension`, `sweepDeals` (expiry + the ending notice)); `mirror.ts` `opportunity.create` (customer account →
  contact → opportunity bound with `alletec_partnername`, `alletec_endcustomername`, `customerid_account`, `parentcontactid`,
  `alletec_referralaccount`, `alletec_State`, `alletec_zoneregion`, `cit_CompetitorName`, `ownerid`: navigation names read from UAT
  metadata this session; product lines only with `crmProductId`, line failures are warnings; the note and the attachments ≤ 4 MB as
  annotations; `alletec_opportunityno` read back; every id stored as it arrives); `deal-files.ts` and the two file routes;
  `POST /api/partners/deals/sweep` (`CRON_SECRET`); components `Deals.tsx` (Did, DealStateTag P13, DealFacts, ConflictBox P15, Protection
  P16, DealThread on section 09's `msg`) and `DealForm.client.tsx` (P14, `useActionState`, keeps the input on refusal; the only client
  component on the partner side); pages `/partners/portal/deals` (list, counters, filters), `/deals/new`, `/deals/[dealId]/edit`, and
  `deals/actions.ts`. **Judgment call to confirm:** the `K7D-` number is given at submission (so the partner, the bell and the queue can
  name the deal); approval makes it the protected registration ID of FR-DEAL-06.
  **Not written yet (next session starts here):** (1) the partner sheet `/partners/portal/deals/[dealId]/page.tsx` (facts, Protection,
  thread with the note form → `noteAction`, extension form → `extensionAction`, withdraw behind a confirm → `withdrawAction`, "Edit and
  resubmit" link when `infoRequested`); (2) the K7 queue `/partners/portal/k7/deals/page.tsx` (role `dealDeskApprover`; counters from
  `dealCounts()`, views open · submitted · extensionRequested · infoRequested · approved · closed · all over `listDealsK7`, search, Run the
  sweep and the CRM jobs); (3) the K7 sheet `/k7/deals/[dealId]/page.tsx` (DealFacts k7, ConflictBox with `findConflicts` live + the
  stored count, the decision panel P10 with the four decisions and the three change fields, the extension decision when
  `extensionRequested`, the amend form when approved, the note form, the CRM job state with Run/Retry via `outboxOf('partner-deals', id)`)
  and `k7/deals/actions.ts` (decide, decideExtension, amend, note, runOutbox, sweep); (4) `K7Nav` Deals tab (`dealDeskApprover`), the
  partner header's Deals link, deal counts on both homes; (5) `partner.css` P13–P16 (`deal-form`, `lines-table`, `lines`, `conflicts`,
  `is-clear`, `protect`, `protect-bar`, `is-ending`, `is-over`, `dthread`, `msg-title`, `deal-filters`, `filters-grid`), the
  `PartnerParts` README, CHANGELOG and `design-system.json`; (6) `pnpm generate:types`, `pnpm lint`, tests `partner-deals.int.spec.ts`
  (pure: machine, validation, gate, protection, conflict matcher, opportunity bodies) and a database test (submit → info → resubmit →
  approve → extension → sweep, scope A/B on deals); (7) PP-TEST products in `scripts/partner-dev-seed.ts`; (8) click-through on
  localhost and the opportunity job on UAT; (9) `04-portal-guide.md` §3–§8 and §9 here. §7's author questions still open.
- **2026-10-22 (9)** — **M4 finished.** Added to session 8's work: the partner deal sheet (`/partners/portal/deals/[dealId]`: facts, the protection
  line, the thread with the note form, the extension request, withdrawal behind a confirm), the K7 queue (`/partners/portal/k7/deals`, role
  Deal Desk Approver, counters, six views, search, Run the sweep and the CRM jobs) and sheet (`/k7/deals/[dealId]`: the conflicts box run
  live beside the stored count, the decision panel with the four decisions and the change fields, the extension decision, the amendment
  form, K7's note form, the record, the CRM job with Run / Retry and the job's warnings) with `k7/deals/actions.ts`; the Deals tab, the
  header links and a deals line on both homes; section 10 P13–P16 and the thread (`partner.css`, `PartnerParts` README, CHANGELOG,
  `design-system.json`); three PP-TEST products in `scripts/partner-dev-seed.ts`; tests `partner-deals` (14 pure) and `partner-deals-db`
  (1 database run through the whole flow, scope A/B on deals); `vitest.config.mts` gains `hookTimeout: 60_000` because five database files
  booting Payload at once tripped the 10 s default. Verified: `pnpm generate:types`, `npx tsc --noEmit` clean, `pnpm lint` 0 errors,
  `pnpm test:int` with `PARTNER_DB_TESTS=1` 15 files passing (the first full run also failed on a schema-push race between workers
  (`ADD COLUMN crm_note_id` twice); the second run, schema in place, passed). **Not verified in the browser:** the Claude-in-Chrome extension
  reported each `navigate` as done but the tab never left the new-tab page, and the running dev server on :3000 answers unauthenticated
  requests in 15 ms but hangs on any page with a valid session, including M3's organisation page (so the server, up for days, is wedged,
  not the new code; the same hang was seen and restarted in M2). Left in the local database for the click-through: two PP-TEST deals on
  K7P-00000, one approved and protected, one with information requested whose stored conflict names the first (numbers K7D-96083 and
  K7D-86083 from the render-check script in the session scratchpad); the products PPT-EPS-001/EDR-001/MDR-001. **Next session starts
  with:** restart `pnpm dev`; click both sides (partner: register with a file, the sheet, edit and resubmit, extension, withdraw; K7: the
  queue, the conflicts box, approve with changes, the extension decision, amend, Run on the CRM job with the mirror on so the opportunity
  lands on UAT — the PP-TEST organisation needs its `account.create` job done first, or the job fails with "partner account not in CRM");
  then M5 (`sync.ts`, `POST /api/partners/sync`, the `crm.snapshot` group on `partner-deals`, the dashboard). §7's author questions still open.

- **Session 10 (2026-10-23, Claude Code): M4 clicked in Chrome on both sides; the opportunity landed on UAT.** `pnpm dev` restarted (the
  old process, up 15 h, hung on every authenticated page); the Claude-in-Chrome extension navigated this time. Through the tunnel host:
  partner side as the seeded Partner Admin (pp-test@k7computing.com; a gmail address is refused by `SUPPORT_MAIL_ALLOWLIST`, as designed) —
  registered K7D-00030 with two product lines, a note and a text attachment; the sheet, the thread with the file chip; edit and resubmit
  after K7's request (the closure date moved, the reply in the thread); the extension request on K7D-96083; the withdrawal of K7D-86083
  with the confirm box; the list's counters and views. K7 side through the probe door (`SUPPORT_DEV_AGENT=probe` set for the session and
  put back after; the Microsoft door needs the tunnel's callback in Entra): the queue, the sheet with the conflicts box (K7D-96083 named
  K7D-86083 while it was live, "None found" after the withdrawal), request more information, approve with changes (₹12,50,000 → ₹12,00,000;
  protected to 2027-01-21), amend K7D-96083 (₹8,40,000 → ₹9,00,000; the partner's thread shows the change), grant the extension (to
  2027-04-10, "extended once", 170 days left), the sweep (0 expired, 0 notices, correct for the data). The PP-TEST organisation got its
  `account.create` job through a new `pnpm partner:seed-dev … --crm` flag (queues it pending) and the drain route: account ACC-2610-00155 on
  UAT. **Four CRM facts found by the opportunity job and fixed in `deals-model.ts` (+ `03-dynamics-exploration.md`):** the account's
  `alletec_verticalbusiness` is a picklist, so the free-text industry now maps onto it by label (`accountVertical`; "Manufacturing" → 13,
  omitted when nothing fits, the text still in `k7_industry` and the note); `alletec_competitoradded` is a Yes/No picklist (260760000 =
  Yes), not a boolean; `alletec_salesvertical` Enterprise is 1, not 260760001; a UAT plugin refuses an opportunity without
  `alletec_casetypelicensetype` ("Opportunity : CaseType is missing"), so the portal sends 0 Fresh. Retried from the K7 sheet after each
  fix (the customer account and contact ids were kept, so nothing duplicated): OPP-2610-00268 on UAT with the partner, customer, contact,
  state, owner, note and the attachment; the CRM renamed it to "<customer>-Fresh-Others" from the product category, so the opportunity's
  name in Dynamics follows the category, not the portal's product name. **Two code faults found in the browser and fixed:** the three
  function-action forms carried `encType`, which React 19 warns is overridden (removed); and `canDecideDeal` allowed the four decisions on
  an `extensionRequested` deal because the machine allows extensionRequested → approved for the extension decision, so the K7 sheet
  offered "Approve" beside the extension form and an approval would have re-queued the opportunity job (now `submitted` only; tests for
  the extension and information-requested cases). `partner-outbox.lastError` now carries the Dataverse message after the code (400
  chars), since a bare `0x80048d19` told the approver nothing. Verified: `npx tsc --noEmit` clean, `pnpm lint` 0 errors, `pnpm test:int`
  with `PARTNER_DB_TESTS=1` 15 files / 136 tests passing. Seen, not fixed: a hydration mismatch on the K7 partner sheet's Record list where
  an email address sits inside a text node (the browser shows "Encountered a script tag while rendering", which points at an extension
  rewriting the DOM before React hydrates, not the markup); worth a look with extensions off. Nothing committed (Navin commits). **Next:**
  M5 (`sync.ts`, `POST /api/partners/sync`, the `crm.snapshot` group on `partner-deals`, the dashboard). §7's author questions still open.
