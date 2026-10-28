# Partner portal: the build plan (written 2026-10-22; M1 to M4 built the same day, M5 to M9 on 2026-10-23)

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
| M5 | Deal dashboard (§8): hourly CRM sync into a read model, cards, list, charts, reconciliation log | **built 2026-10-23** (session 11): tests pass, the read-back ran against UAT (OPP-2610-00268 read into K7D-00030), both sides clicked on localhost |
| M6 | Collateral library (§6) | **built 2026-10-23** (session 12): the two collections, the library and item pages, the download route with the rule and Range support, the K7 ledger, the cap as a setting; tests pass, both sides clicked on localhost |
| M7 | Schemes and eligibility (§9) | **built 2026-10-23** (session 13): the four collections, the partner pages (listing, scheme, Check eligibility), the K7 ledger, sheet and result sheet, the run, the Finance CSV; tests pass; both sides clicked end to end on localhost and the tunnel host, including a phone width |
| M8 | Notifications, bell, editable templates, approval SLA, reporting, exports (§10 and the gaps) | **built 2026-10-23** (session 14): the event catalogue and the templates page with a delivery rule per event (at once · daily digest · bell only), the digest and retention pass, the approval SLA in working hours with the breach notice to approvers, managers and escalation addresses, the SLA reading on the K7 queues and sheets, the four reports with CSV; tests pass; the K7 side clicked end to end on localhost, the partner side's rendered row too; the non-functional requirements proposed in §11, to confirm with the author |
| M9 | Hardening and staging: non-functional requirements, tests, go-live gate → **launch 1 (no LMS)** | **built 2026-10-23** (session 15): `05-staging-and-go-live.md` (the runbook: host needs, environment per stage, the scheduler, operations, the gate, backup); the shared cron guard, the per-client code limit, the portal headers, the per-feature CRM switches, the job-run log with the Operations page and the health route, housekeeping, backup and restore scripts rehearsed; the matrix, scope, fixture and route-door tests; the items earlier sessions left unclicked are clicked. Hosting itself is still undecided, so staging is specified, not stood up |
| M10 | Training (§4): tracks, courses, modules, video progress, tests, attempts, results, admin | **built 2026-10-23** (session 16): the six collections and the training files in the Payload admin for the Training editor, the video adapter (Vimeo · direct link · uploaded file) with the player posting watched ranges and the server deciding completion, the test engine (unlock, seeded draw from the bank, time limit, all-or-nothing grading, attempts stored with the paper and the answers), the learner's pages, the Partner Admin's organisation view, the Training Admin's desk with the CSV import, the Training settings; certificates wait for M11 |
| M11 | Certificates (§4 FR-TRN-07–10, §5): PDF + QR, public verification, expiry, org certificate, revoke; then the deal gate switch | **built 2026-10-24** (session 17): the pure model (numbers, bands, expiry, the state today, the rule per type, when a pass earns a certificate, the reminders), the PDF drawn in the server on the design language's terms, the private file collection served through the portal's routes, the public verification page, the individual certificate on a pass (emailed with the PDF), the organisation's request when the rule is first met and the Channel Manager's issue · decline · revoke, the daily sweep (expiry, reminders, the backfill of earlier passes, the mirror, the renewal request), the recertification test, the partner's certificates page and sheet, the K7 desk and sheet, the settings; the deal gate switched on in the development settings |

The notification spine (one `notify()` and the bell) is built in M1–M2 because every later
milestone emits events; M8 added the editable templates, the delivery rules and the SLA.

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
    **Built 2026-10-23 as decided:** `video.ts` reads a Vimeo URL or id (with the unlisted hash), a
    direct media link, or a file uploaded to `partner-training-files` (served through the portal's
    own route after the session check); the player (`Player.client.tsx`) keeps the ranges as the
    video ticks (a jump of more than two seconds starts a new range), posts them every ten seconds
    and on pause, end, hide and leave, and resumes from the last position; the host itself is still
    the author's call (Vimeo needs no credential in the code, only the domain restriction on Vimeo).
20. **Course versioning (FR-TRN-14) is an integer the Training Admin raises** when the material
    changes; every progress row and attempt records the version it was made on, a pass on an earlier
    version stays valid and the course page says *passed on v1* and offers the new version. No
    copy-on-publish of modules and banks: the admin edits in place, the version number is the record.
21. **The test** draws `questionsPerTest` from the askable bank (active, well formed) in a seeded
    shuffle whose seed is kept on the attempt, shuffles the options under letter keys (true/false
    keeps True before False) and records the correct keys with the paper, so a later edit of the bank
    never changes a stored result; one mark per question, a multiple-choice question all-or-nothing;
    a submission up to 45 s after the limit counts, later it is recorded as *expired* and graded on
    what was answered; an open attempt is resumed, never re-drawn. No cooldown between attempts and
    no attempt cap: the requirements name none, every attempt is stored.
22. **A track opens to the partner roles it names** (Sales → `sales`, Technical → `technical`); a user
    learns a track when they hold one of its roles, a track that names none opens to everyone, and a
    Partner Admin without a learning role reads the organisation's progress (FR-TRN-11) but takes no
    course. The Training Admin is a Payload user with the new `trainingEditor` role for `/admin`
    (the training collections, read-only on progress and attempts) and the portal role by work email
    for the desk, like the Marketing Admin (decision 9).
23. **The training rules live in `partner-settings.training`** (watch share 90%, pass mark 70%, time
    limit 20 min, 10 questions, answers shown) and a course or a module may override each in the
    admin; the K7 settings page edits the programme's values.

24. **A certificate is a row and a PDF drawn once** (`partner-certificates`, M11, decision 12): the facts as they stood at
    issue are copied onto the row (names, type, course, track, version, score, band), so the PDF, the sheet and the public
    page read the same after a rename or a course change; the PDF is a `partner-certificate-files` row and is redrawn from the
    row if the disk loses it. Numbers are six symbols from a thirty-symbol alphabet without the look-alikes (`K7P-C-`,
    `K7P-O-`), allocated at random and checked unique; the public page is keyed on the number alone.
25. **The organisation rule counts people per track** (FR-CRT-01): per partner type, so many distinct people holding a
    current individual certificate on a course of each track (the track's key: `sales`, `technical`); a row with 0 people
    waives that track, a type with no row never qualifies, no rows at all mean the defaults (one person on each track). The
    request to the Channel Manager is raised when the rule is first met, and again when it is met after the certificate
    expired or was revoked; a declined request is not raised again until an individual certificate is issued after the
    decline. The organisation's standing is mirrored onto `partner-orgs.certificate` (valid · expired · revoked · none, with
    the date), which is what the deal gate (decision 8) and the collateral rule already read, so neither changed.
26. **Recertification is the same test** (FR-TRN-10): inside the first reminder window (60 days by default) and after expiry
    or revocation the course's test opens again and a pass issues a new certificate; while the certificate stands outside the
    window a retake is recorded beside it and prints nothing. Individual certificates stand 12 months, the organisation's 12
    months, both configurable; reminders go once per threshold (60, 30) to the holder and the Partner Admins; the sweep also
    issues certificates for passes recorded before M11, so no learner is left without one.
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

### M5 — dashboard (§8) (built 2026-10-23)
- [x] `sync.ts`: the portal's own opportunities by stored id, in `or` filters of 25 → the `crm.snapshot` group on each deal (state, status reason, stage, step, values, dates, modifiedon, the `OPP-` number read back); one audit row per deal whose read changed (`deal.crm-read` first, then `deal.crm-changed` from → to, the registration's disagreements in the comment), CRM wins and the registration's fields stay; a missing opportunity keeps its values and carries the error; every run a `partner-sync-runs` row
- [x] `POST /api/partners/sync` with `CRON_SECRET`, throttled by `partner-settings.crm.syncMinutes` (60) unless `{"force":true}`; "Last updated" from the newest run; *Sync the CRM* on the K7 queue and *Read back now* on the K7 sheet; the K7 reconciliation log at `/k7/deals/sync`
- [x] Cards (FR-DASH-01), the FR-DASH-02 ledger with the outcome tag, the period on the registration date (month · quarter · financial year · 12 months · all), the three charts on section 09's S9 grid (pipeline by stage, value by month, value by product); the CRM facts on both deal sheets
- Not in M5: CRM-only deals (FR-DASH-10, deferred by decision 2); the opportunity's product lines are not read back (the snapshot is the opportunity's own columns)

### M6 — collateral (§6)
- [x] Collection with product, category, versioning, tags, visibility rules; Marketing Admin edits in `/admin`: `partner-collateral` (the item: title, product or the programme, category, description, tags, state draft · published · retired, the FR-MKT-03 rule as types · certified · countries · regions, order) and `partner-collateral-files` (one row per version, joined onto the item; a blank version is the previous one bumped; the uploader recorded). Marketing editors (Payload role) create and update, and read `partner-products` to file an item under one; admins delete
- [x] Library pages with search and filters; signed-in download route; limit raised to 200 MB for this collection; storage path: `/partners/portal/collateral` (by product, then category; search, product, category, file type), the item sheet, `…/[id]/download` (the rule again, one audit row per download, Range requests honoured, `?inline=1`), the K7 ledger `/partners/portal/k7/collateral` with the rule in words and the download tally; Payload's one global limit is now 200 MB with `maxUpload` keeping Media, report files and deal files at their old caps; the collateral cap is `partner-settings.collateral.maxMb` (200 at most, on the K7 settings page); files under `PARTNER_UPLOAD_DIR` (default `uploads/collateral`)
- Not in M6: notifications for new collateral (M8's templates), the storage adapter (staging), tiers (decision 7)

### M7 — schemes and eligibility (§9) (built 2026-10-23)
- [x] `partner-schemes` (edited in `/admin` by marketing editors: name, description, terms, dates, registration deadline, types, regions, products, PDF in `partner-scheme-files`, approvalRequired, disputeDays, slabs[], the `results` group the desk writes) with the phase from the dates (open · starts soon · running · closed); the partner listing in three groups by type and region; registration with the terms accepted by a Partner Admin (`partner-scheme-registrations`), automatic or pending K7's decision on the K7 sheet
- [x] Progress on a running scheme from the won deals' snapshots (`progressFor`, provisional, the synced line, the progress line against the slabs)
- [x] `partner-eligibility`: the run (`runEligibility`, the desk button and `POST /api/partners/schemes/run` with `CRON_SECRET` for closed schemes without results), the Scheme Admin's adjustment with a reason, publish (partners told, the dispute window from the settings or the scheme), the partner's Check eligibility page with the gap and the deals counted, the dispute and its resolution, the payout state with reference, the Finance CSV
- [x] Clicked in Chrome on both sides (session 13): register, progress, compute, adjust twice, publish, the partner's result, dispute and resolution, payout, the CSV through the route, both sides at 390px

### M8 — notifications, templates, SLA, reporting (§10 and the gaps) (built 2026-10-23)
- [x] Editable templates per event (`partner-mail-templates`, the catalogue in `notify-model.ts`, the Channel Manager's page `/partners/portal/k7/notifications/templates` with placeholders, preview and a test to their own address), the bell page unchanged, digest rules as a delivery per event (at once · daily digest · bell only; `POST /api/partners/notifications/digest` daily, which also sweeps read rows past `notify.bellRetentionDays`); approval SLA hours in the settings with the working hours, the warning share, each staff person's manager and the escalation addresses; breach notices once per clock to the queue's role, the managers and the addresses (`POST /api/partners/sla/sweep` hourly); the reading on the K7 queues, sheets, home and reports
- [x] Reports for K7 (`/partners/portal/k7/reports`): pipeline by partner, applications by state, scheme results, the approval SLA; one CSV each for the period
- [x] Non-functional requirements proposed in §11 as defaults to confirm with the author (appendix 1); not yet confirmed

### M9 — hardening and staging → launch 1 (built 2026-10-23)
- [x] Tests for every status machine, scope rule, eligibility maths and the conflict matcher (mock fixtures, anonymised): `partner-m9` (the four machines as full matrices, the scope corners, the cron guard, the limiter, the feature switches, the readiness checks, ten anonymised deals across four organisations against the conflict matcher, a slab fixture against the eligibility maths), `partner-routes` (every route and server action under the portal read from the source for its door), `partner-m9-db` (the switches, the job-run log and housekeeping against Postgres)
- [x] Staging specified in `05-staging-and-go-live.md` §1–2 (what the host must provide, the environment per stage); the code side done: the shared constant-time cron guard (`src/lib/cron-auth.ts`), the per-client code limit beside the per-address one, the portal headers in `next.config.ts`, every scheduled run recorded (`partner-job-runs`) and read on `/partners/portal/k7/operations` with the readiness checks, `GET /api/partners/health` for a monitor, `POST /api/partners/housekeeping`, `scripts/backup.sh` / `restore.sh` rehearsed locally (NFR 9). Object storage deferred (a persistent disk is enough for launch 1); SMTP and the service application user are the host's lines in §2, not code
- [x] Go-live gate written (`05-staging-and-go-live.md` §5) on `07-production-safety.md` §7 with the switches it needs: `crm.features` (account, opportunity, read-back) under the master `crm.enabled`, a job whose feature is off waiting as pending with no attempt, the read-back refusing when its switch is off; the gate itself is run at launch, not now

### M10 — training (§4), built 2026-10-23
- [x] Collections and Payload admin for tracks, courses (versioned), modules, question banks (bulk CSV import); Training Admin role: `partner-tracks`, `-courses` (version, the test rules as overrides, joins to modules and questions), `-modules` (a Vimeo reference, a direct link or an uploaded file, reading, attachments), `-questions`, `-training-files`, and the portal's own `-progress` and `-attempts` (read-only in the admin), under the group *Partner training* for the new Payload role `trainingEditor` (`pnpm partner:seed-dev … --trainer`); the CSV import on the desk's course sheet with the template route
- [x] Player page on the video adapter; progress API; completion from watched ranges at the configured share: `video.ts`, `Player.client.tsx`, `POST /partners/portal/training/progress` (same-origin, the user's own module), `applyWatched` merging the union and deciding completion at the module's, the course's or the programme's share; the duration learnt onto the module; resume from the last position
- [x] Test engine: unlock rule, shuffled draw from the bank, time limit, scoring, stored attempts, results page with optional answers: `testUnlocked`, `drawPaper` (seeded), `gradePaper`, the attempt row with the paper and the answers, `TestPaper.client.tsx` with the clock that submits at zero, the result page with the review; the pass tells the participant and the Partner Admins (`training.course.passed`); a course whose bank cannot make a paper tells the Training Admins once per learner who completes it (`training.bank.empty`)
- [x] Progress dashboard for the user and, for the Partner Admin, the organisation (FR-TRN-11): `/partners/portal/training` (the ledger per track with the standing), `/training/organisation` (one ledger per user), the home page's Training card; the K7 ledger and course sheet with the learners

### M11 — certificates (§4 FR-TRN-07–10, §5), built 2026-10-24
- [x] PDF generator (individual, organisation) with QR; private upload collection; download in profile; emailed on issue: `certificate-pdf.ts` (pdf-lib, the Archivo and Plex Mono TTFs embedded from `design-system/assets/fonts`, the QR from `qrcode`'s modules as squares, the K7 mark from the logo's own paths, the signatory image from `PARTNER_CERT_SIGNATORY`), `partner-certificates` + `partner-certificate-files` (admin read-only; `PARTNER_CERTIFICATE_DIR`, redrawn and stored again if the file is lost), `/partners/portal/certificates` (the organisation's card, yours, everyone's for the admin), `/certificates/[id]` (the facts, the QR, the PDF) and `/[id]/file`; `notify()` carries attachments on the immediate mail (`training.certificate.issued`, `org.certificate.issued`)
- [x] `/partners/verify/[id]` public page (valid / expired / revoked, minimal data): `findForVerification` → `verifyView` (holder, organisation, partner ID, course or programme, issued, valid to, revoked; no email, score or reason; a request or a declined one verifies as unknown); `/partners/verify` is the door with the number field; typed numbers normalised (`parseCertificateNumber`)
- [x] Expiry (default 12 months), reminders at 60/30 days (a pass in the scheduled job), recertification test: `expiryFrom`, `certificateState` (*expiring* inside the first reminder window), `reminderDue` once per threshold, `POST /api/partners/certificates/sweep` (`certificatesSweep` job, also *Run the sweep* on the desk) expiring, reminding, backfilling passes without a certificate, syncing the organisations' `certificate` mirror and raising the renewal request; the standing reads *Recertify* (a new `TestState`) when the certificate is expiring, expired or revoked and the modules stand, the course page's panel turns into *Recertification*, a pass inside the window supersedes the old certificate (`shouldIssueIndividual`)
- [x] Organisation rule per type in settings; issuance request to the Channel Manager; issue, status strip, renewal, revoke with reason: `partner-settings.certificates` (validity ×2, reminder days, the bands, `rules[]` per type and track, the signatory, the issuer) edited on the K7 settings page and the admin tab; `readRule` counts distinct people with a current certificate per track; `raiseOrgRequestIfMet` (first met, or met again after expiry or revocation; a declined request waits for a change) → `org.certificate.requested` to the Channel Managers; `/partners/portal/k7/certificates` (counters, views, the rule table, the sweep) and `/[id]` (issue a request or a renewal, decline with a reason, revoke either kind with a reason; a Training Admin may revoke an individual one); `orgMirror` writes `partner-orgs.certificate` so the deal gate and the collateral rule read it unchanged; the strips on both homes, the organisation page and the K7 partner sheet
- [x] Switch `deals.requireCertificate` on with the waiver flow (decision 8): the code default stays off; switched on in the development settings on 2026-10-24 (the K7 settings page), the gate read against the mirror (`registerBlocked` unchanged, covered by `partner-certificates-db`: valid passes, revoked blocks, the waiver reopens, the switch off ignores it)

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
the last phase `PARTNER_VIDEO_PROVIDER` + credentials, `PARTNER_CERTIFICATE_DIR` (default `uploads/partner-certificates`) and `PARTNER_CERT_SIGNATORY` (the signatory's image, PNG or JPG; empty prints the issuer over the rule), both in `.env.example` since M11.

## 9. Traceability
`status`: — not started · M<n> in progress · done (date) · deferred (reason). Update per session.

| FR | milestone | status |
|---|---|---|
| ROLE-01, 02, 03 | M1, M3 | done 2026-10-22 (M1: the scope rule, several roles per user and per K7 person; M3: the user pages, the standing-admin rule, the scope pinned against the database) |
| REG-01 … 06, 08 | M2 | done 2026-10-22 (REG-03: email code; mobile code behind the SMS adapter, `skipped` and shown as such until a gateway exists; REG-06: the CRM account and contact through the outbox, verified on UAT as ACC-2610-00154) |
| REG-07 | M3 | done 2026-10-22 (legal name, GSTIN and PAN proposed → Channel Manager approves or declines; the CRM rename stays manual) |
| DEAL-01 | M4 (org gate), M11 (certificate gate) | done 2026-10-24 (M4: the organisation and user gate; M11: the switch reads the organisation's certificate mirror, on in the development settings, the waiver per organisation) |
| DEAL-02 … 09 | M4 | done 2026-10-22 (DEAL-04: over portal deals, the CRM switch not built; DEAL-06: the opportunity job written, not yet run on UAT; DEAL-07: one extension, decision 15) |
| DASH-01 … 05, 08, 11 | M5 | built 2026-10-23 (DASH-05: the interval is `crm.syncMinutes`, default 60, the scheduler calls `/api/partners/sync`; DASH-11: one audit row per changed read, the CRM's figures shown, the registration kept; one real run against UAT 2026-10-23) |
| DASH-10 | — | deferred (fresh start, decision 2) |
| MKT-01 … 04 | M6 | built 2026-10-23 (MKT-01: product → category; MKT-02: the eight types, the cap a setting ≤ 200 MB, Payload refuses malformed PDFs and scripted SVGs; MKT-03: type, certification, country, region, ANDed; MKT-04: upload, replace as a new version, tag, retire in `/admin`) |
| SCH-01 … 05 | M7 | built 2026-10-23 (SCH-01: the admin collection with slabs and the PDF; SCH-02: three groups, type and region, published only; SCH-03: the Partner Admin accepts the terms, name and time stored; SCH-04: per-scheme switch; SCH-05: provisional progress from the snapshots) |
| ELG-01 … 07 | M7 | built 2026-10-23 (ELG-01: won in the CRM, closed inside the dates, on a named product, at the order value; ELG-02: adjust with reason, publish; ELG-03/04: the page with the slab, the benefit, the gap, the deals; ELG-05: window = setting or the scheme's days; ELG-06: pending · processed · paid with reference; ELG-07: CSV) |
| NTF-01 | M1 (spine), M8 (templates, SLA) | M1 done (`notify()`, the bell, email through the allowlist); M2 sends the application events (staff bell + mail, applicant mail, the invitation); M4 the deal events (submitted, resubmitted, decided, amended, extension asked and decided, withdrawn, expired, protection ending); M7 the scheme events; **M8 built 2026-10-23**: templates K7 edits per event with a delivery rule and the daily digest, the approval SLA breach to the approvers and their managers M10–M11 add the training and certificate rows: `training.course.passed`, `training.certificate.issued` (the PDF attached) · `expiring` · `expired` · `revoked`, `org.certificate.requested` (K7) · `issued` (the PDF attached) · `declined` · `expiring` · `expired` · `revoked`, each with a template and a delivery rule |
| non-functional (none written) | M8, M9 | proposed 2026-10-23 (§11), to confirm with the author; M9 carries out 7 (the guard, the limiter, the headers, the route-door test), 8 (every run a row), 9 (backup rehearsed) and the retention lines of 4 (drafts, job runs) in code and the rest as the runbook `05-staging-and-go-live.md` |
| TRN-01 … 06, 11, 12, 13, 14 | M10 | built 2026-10-23 (TRN-01: two tracks by role, courses of ordered modules with video and reading; TRN-02: Vimeo or the browser player through the portal, resume from the last position, download removed; TRN-03: completion from the union of watched ranges at the configured share, gaps do not count; TRN-04: the test unlocks when every module is complete, three question types, shuffled draw per attempt; TRN-05: pass mark and time limit per course or programme-wide; TRN-06: the score and, by setting, the answers; attempts and answers stored; TRN-11: the learner's and the Partner Admin's views; TRN-12, 13: the admin collections and the CSV import with the template; TRN-14: the integer version on every progress row and attempt, earlier passes kept) |
| TRN-07, 08, 09, 10 | M11 | done 2026-10-24 (TRN-07: the PDF on a pass with the name, organisation, course and track, date, score band, number and QR; TRN-08: `/partners/portal/certificates` and the sheet's download at any time, emailed with the PDF on issue; TRN-09: `/partners/verify/[id]` with the minimum; TRN-10: 12 months by default, reminders at 60 and 30 days by the sweep, the recertification test from the first window) |
| CRT-01 … 07 | M11 | done 2026-10-24 (CRT-01: `certificates.rules` per type and track; CRT-02: the request to the Channel Managers when first met; CRT-03: the PDF with the legal name, type, partner ID, issue date, validity, number, signatory and QR; CRT-04: the Partner Admins' download, the email with the PDF, the card on the certificates page and the strips; CRT-05: validity configurable, the state Valid · Expiring soon · Expired on every strip; CRT-06: the renewal request when the lapsed organisation still meets the rule, reminders at 60 and 30 days saying whether it does; CRT-07: revoke with a recorded reason, the public page reads revoked) |

## 11. Non-functional requirements (proposed 2026-10-23, to confirm with the author)
The source document promises these and gives none (appendix 1). Defaults the build assumes, written so the author can strike or
change a line rather than write from nothing; each is either already true of the code or a staging (M9) item.
1. **Availability and hosting.** The portal is part of the website's deployable (decision 1), so it inherits the site's hosting and
   uptime target once hosting is decided; the portal is never a separate outage. Target to confirm: 99.5 % monthly, business hours
   IST counted twice.
2. **Response time.** A signed-in page in under 2 s at the 95th percentile on a 4G connection; the CRM is never read in a request
   (decisions 2, 11, 14), so the CRM's latency cannot slow a page. Reports read up to 2,000 rows in one pass; past that they are paged.
3. **Data residency and the CRM.** Payload's Postgres holds the system of record; where it runs follows the hosting decision (India
   region assumed). Dynamics is written only by the outbox, as the service identity, to UAT until the go-live gate of M9, never to
   production without the per-feature switch (`07-production-safety.md` §7).
4. **Retention.** Applications, organisations, deals, scheme results and the audit trail are kept for the life of the programme;
   read bell rows for `notify.bellRetentionDays` (180 by default, M8); one-time codes for ten minutes; sessions for the Auth.js default;
   join drafts nobody touched for 30 days and job-run rows older than 90 days are removed by housekeeping (M9).
   Uploads (deal files, collateral, scheme PDFs) live with their rows. A partner's data is removed on request by an admin in `/admin`,
   with the audit rows kept under the partner ID alone.
5. **Accessibility.** WCAG 2.2 AA as the site: every control labelled, the state tags read as text not colour alone, keyboard order
   follows the sheet, a phone width (390 px) checked for every page before it ships (the session logs record each check).
6. **Browser support.** The current and previous major versions of Chrome, Edge, Safari and Firefox on desktop; Safari and Chrome on
   iOS and Android. No Internet Explorer.
7. **Security.** Partner identity by one-time email code (decision 3) with the allowlist on shared hosts; K7 staff by Microsoft Entra;
   every partner query scoped to the organisation (FR-ROLE-01, pinned by a test); files served only through routes that re-check the
   rule; no secrets in the repository; the CRM client refuses production writes in code.
8. **Audit and reporting.** Every status change writes an append-only row (decision 17); every notification is a row with its delivery
   and email result (M8); the reports and CSVs read the portal's rows and the CRM snapshots, never live.
9. **Backup.** Nightly Postgres backups and the upload directories, retained 30 days (`scripts/backup.sh`), restored once before launch 1
   (`scripts/restore.sh`; rehearsed on the development database 2026-10-23, `05-staging-and-go-live.md` §6).
10. **Email.** All mail through `SMTP_URL` with the allowlist on any host other people can reach; digests once a day; the breach notice
    hourly; sending failures recorded on the row, never thrown at the user.
11. **Volumes assumed.** Up to 500 partner organisations, 5,000 users and 20,000 deals in the first two years; the counters, the
    sync batches of 25 and the report pass are sized for this.

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

- **Session 11 (2026-10-23, Claude Code): M5 built, the deal dashboard.** The snapshot group `partner-deals.crm.snapshot` (syncedAt, modifiedOn,
  name, statecode, statuscode + label, stage + label, stepName, estimated / actual / invoice value, the two close dates, error); the new
  append-only collection `partner-sync-runs` (one row per read-back) and `partner-settings.crm.syncMinutes` (60; on the K7 settings page).
  `dashboard-model.ts` (pure: the row → snapshot mapping on the CRM's formatted values with the §2 tables as fallback, the reconciliation
  diff, the portal's disagreements, the outcome the partner reads, the period on the Indian financial year, the cards and the three charts,
  ₹ short forms) and `sync.ts` (the portal's own opportunities by id in `or` filters of 25 as the service identity, GET only; the snapshot
  and the `OPP-` number written onto the deal; `deal.crm-read` / `deal.crm-changed` audit rows from → to with the CRM winning and the
  registration kept; missing rows keep their values and carry the error; a CRM that cannot be read is a failed run with nothing written;
  the interval honoured unless forced). `POST /api/partners/sync` with `CRON_SECRET`. Pages: `/partners/portal/dashboard` (the synced line,
  the period switch, the seven cards, pipeline by stage · value by month · value by product on section 09's S9 grid, the status views, the
  FR-DASH-02 ledger with the CRM's estimate starred where it differs), `/partners/portal/k7/deals/sync` (the reconciliation log with Sync
  now), *Sync the CRM* on the K7 queue, *Read back now* and the CRM facts on the K7 sheet, the CRM facts on the partner sheet, the Dashboard
  link in the header and on the home. Section 10 P17–P19 (`partner.css`, `PartnerParts` README, CHANGELOG, `design-system.json`).
  Tests: `partner-dashboard` (19 pure) and `partner-sync-db` (1 database run with the CRM stood in by a fetcher: first read, no change,
  won, missing, unreadable CRM, the interval; scope held). Verified: `pnpm generate:types`, `npx tsc --noEmit` clean, `pnpm lint`
  0 errors (14 pre-existing warnings), `pnpm test:int` with `PARTNER_DB_TESTS=1` 17 files / 156 tests passing (one schema-push race on
  the new enum on the very first run, as in session 9; clean after). Two things the tests caught: Dataverse's `fv()` falls back to the raw
  value, so the model reads the formatted-value annotation directly and falls back to its own tables; a date-only column comes back from
  Postgres with a time, so `toSnapshot` keeps the day and a second read of the same row compares equal. **Run once against UAT** through
  the dev server (`POST /api/partners/sync` with `{"force":true}`, the probe token as the service identity): K7D-00030 / OPP-2610-00268
  read back in 2.4 s as Open · In Progress · Pre Sales · ₹12,00,000 · closing 2027-02-15, one `deal.crm-changed` row, run 19 in the
  log. That run also showed the database test's one portal-wide run had touched the real local deal (marked it missing), so the test
  now runs only for its own organisation. The stray row stays (audit row 258 on K7D-00030, `deal.crm-read` "First read-back" written by
  the test at 05:16 UTC with the missing marker; row 293 at 05:18 is the real read): the session's classifier refused the SQL that would
  have removed it, so it is Navin's to delete or to leave as the record of what happened. **Clicked on localhost in Chrome:** the partner side
  as pp-test@k7computing.com (the dashboard: the synced line, the five periods, the cards, the three charts, the ledger with K7D-00030 at
  Pre Sales · Open from the UAT read and the CRM's closure 15-02-2027, the Dashboard link); the K7 side through the probe door
  (`SUPPORT_DEV_AGENT=probe` for the check, put back after): the reconciliation log, *Sync now* (0.3 s, 1 unchanged, run 20), the CRM facts
  on the K7D-00030 sheet. Two things the browser showed and the code fixed: the column chart's twelve month labels collided and the
  value on the column wrapped (every other label past eight columns, nowrap), and the synced line sat on the lede. Not clicked: the
  partner deal sheet's CRM facts, the Open/Won/Lost views, a phone width. **Next:** M6, the collateral library (§6); §7's author questions still open.

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

- **Session 12 (2026-10-23, Claude Code): M6 built, the collateral library.** Two collections: `partner-collateral` (the item: title, product or the
  programme, category from the FR-MKT-01 list, description, tags, state draft · published · retired with `publishedAt` / `retiredAt` set by a hook,
  the FR-MKT-03 rule as a group `visibility` {types, certified, countries, regions}, order, and a `join` onto its files) and `partner-collateral-files`
  (one upload per version, FR-MKT-02's mime types, `version` bumped from the previous when blank, `note`, `uploadedBy` from the admin's email, stored
  under `PARTNER_UPLOAD_DIR` = `uploads/collateral`). Marketing editors (the Payload role) create and update both in `/admin`; admins delete.
  **The size limit:** Payload has one `upload.limits.fileSize` for the whole config and a 50 MB `requestSizeLimit` default, so the config now
  carries 200 MB / 201 MB and `src/collections/uploadLimit.ts` (`maxUpload`, a `beforeValidate` hook on `req.file.size`) keeps Media and report
  files at 30 MB and deal files at 10 MB; the collateral's own cap is `partner-settings.collateral.maxMb` (new Collateral tab in the global and on
  the K7 settings page; 200 at most). `collateral-model.ts` (pure: `visibleTo` / `readableBy`, the kinds, `filterLibrary`, `groupLibrary`,
  `parseRange`, `nextVersion`) and `collateral.ts` (`libraryFor(me)`, `loadCollateralFor`, `recordDownload` as one audit row on the organisation,
  `downloadTallies` from the audit rows, `serveCollateralFile` whole or by Range with the path checked against the directory). Pages:
  `/partners/portal/collateral` (by product then category; search, product, category, file type), `…/[id]` (the strip, the version's note, the
  download as the primary action, *Open in the browser*), `…/[id]/download` (the rule again, 206 on Range, `?inline=1`), the K7 ledger
  `/partners/portal/k7/collateral` for Marketing Admins (every state, the rule in words, the current version linked, the tally; *Add an item* into
  the admin) with its own download route (`?file=` for an earlier version), the Collateral links in the header and the desk strip, the block on both
  homes. Section 10 P20–P21 (`partner.css`, `PartnerParts` README, CHANGELOG, `design-system.json`). `pnpm partner:seed-dev … --collateral` files
  four PP-TEST items with generated one-page PDFs. Tests: `partner-collateral` (18 pure) and `partner-collateral-db` (5 against Postgres: two
  organisations against eight items; the file whole and by range; the tally). Two things the tests taught: Payload validates PDFs (header, `xref`
  and `%%EOF` in the tail), so a fixture needs a real xref; and `file-type`, which Payload runs on every upload, throws under vitest's jsdom
  environment (another realm's `Uint8Array`), so the database test runs under `// @vitest-environment node`. Verified: `pnpm generate:types`,
  `npx tsc --noEmit` clean, `pnpm lint` 0 errors (14 pre-existing warnings), `pnpm test:int` with `PARTNER_DB_TESTS=1` 19 files / 179 tests
  passing. **Clicked in Chrome:** the partner side on localhost as pp-test@k7computing.com (the library with the three items the VAR in India may
  read and the draft absent, the datasheet's sheet, the PDF inline through the download route, `?q=smb&category=datasheet`, the draft's sheet a
  404, the home's Collateral block, the download in the recent record); the K7 side on the tunnel host through the probe session that was open
  there (the ledger in Published and All with the rule in words and the state tags, the draft's PDF inline through the K7 route, the tally at 1 /
  1 in 30 days after the partner's download). One thing the browser caught: the filters grid inside section 09's `views` flex row stretched the
  fields to 150px, so the library's filters are their own block (`lib-filters`). **Clicked afterwards in the same session**, when Navin asked for the
  left-out items to be done rather than listed: the dev seed gained `--editor` (a PP-TEST Marketing editor for `/admin`, its password
  `PARTNER_DEV_EDITOR_PASSWORD` in `.env`), and as that editor the admin flow was clicked end to end on localhost: item 24 created with a product,
  a tag and a VARs-only rule, two PDFs added through the Files drawer (versions 1 and 2 from a blank field, the uploader recorded), published
  (the partner's library showed it with v2 within the minute, the sheet with the note and the published date), then retired (the sheet a 404,
  `retiredAt` set). Three bugs it caught, all fixed: (1) a Marketing editor could not read `partner-products`, so the Product select was empty
  for the role that files collateral (read access opened to the role; only admins change the catalogue); (2) `savePartnerSettings` never wrote
  the `collateral` group, so the cap on the K7 settings page said "saved" and stayed at 200 (the group is now written; set to 1 and back to
  200 through the page on the tunnel host, the row checked in Postgres each time); (3) the `maxUpload` hook read `req.file.size`, which Payload
  leaves undefined for a non-image file by the time the hooks run (`generateFileData` rebuilds `req.file`), so a 1.5 MB PDF went through a
  1 MB cap in the admin and through the local API; the hook now reads the `filesize` Payload records on the document, with the request's
  file and its buffer as fallbacks, pinned in the pure test, and the same upload in the admin is refused with "pp-test-big-1500kb.pdf is
  1.5 MB; this library accepts files up to 1 MB" (the row that slipped through was deleted). A phone width (390px, the pages in a frame of
  that width because the window manager keeps the window full-size): the library's filters stack and its table scrolls in its wrap, the sheet's
  strip stacks, the K7 ledger scrolls, the settings field stacks; the portal header's Dark | Light group overflowed the bar under 520px (a
  section 09 rule since M1, the menu already carries the theme), so it now hides there (`portal.css`, SupportParts README, CHANGELOG).
  Nothing committed (Navin commits). **Next:** M7, schemes and eligibility (§9); §7's author questions still open.

- **Session 13 (2026-10-23, Claude Code): M7 built, schemes and eligibility.** Four collections: `partner-schemes` (the catalogue the Scheme Admin writes in `/admin`
  with the Payload marketing-editor role: terms, dates, the registration deadline, types, regions, products, `approvalRequired`, `disputeDays`, slabs threshold → benefit →
  amount, a PDF in `partner-scheme-files` served only through the portal, and a `results` group the desk writes), `partner-scheme-registrations` and `partner-eligibility`
  (portal-written: the deals counted, achieved, the adjustment, final, eligible, slab, target, gap, the dispute, the payout). `schemes-model.ts` (pure: the phase from the dates,
  `appliesTo` by type and region, `registerBlocked`, `countedDeal` = won in the CRM + actual close date inside the window + a named product + the dashboard's order value,
  `standing` against the slabs with the gap to the target or to the next slab, `finalValue`, `resultStatus` (review until published and while a dispute is open), the dispute
  window, `financeCsv`) and `schemes.ts` (reads for both audiences through `me.scope`, `registerForScheme`, `decideRegistration`, `progressOf`, `runEligibility` per approved
  registration with recomputation keeping adjustments, `runDueSchemes` for the cron route, `adjustResult`, `publishResults`, `raiseDispute`, `resolveDispute`, `setPayout`,
  `financeRows`, the counters). Pages: `/partners/portal/schemes` (three filed ledgers), `…/[id]` (slabs, terms, the registration box, the progress line and the deals counted
  while running), `…/[id]/eligibility` (FR-ELG-03/04, the dispute form, the payout), `…/[id]/attachment`; K7: `/partners/portal/k7/schemes` (counters, views, the ledger with
  the results' state, *Compute what is due*), `…/[id]` (registrations to decide in the pending box, the results ledger, compute and publish on the decision panel, the CSV
  link), `…/[id]/results/[partnerId]` (the deals counted, adjust, resolve the dispute, the payout), `…/[id]/export.csv`, `…/[id]/attachment`; `POST /api/partners/schemes/run`.
  The setting `schemes.disputeDays` (14) in the global, the model and the K7 settings page. Section 10 P22–P24 (`partner.css`, `PartnerParts` README, CHANGELOG,
  `design-system.json`). `pnpm partner:seed-dev … --schemes` makes three PP-TEST schemes (open, running with approval and registered, closed and registered). Tests:
  `partner-schemes` (24 pure) and `partner-schemes-db` (3 against Postgres: listing and scope, registration with approval and progress, the run → adjust → rerun → publish →
  dispute → payout → Finance rows). Verified: `pnpm generate:types`, `npx tsc --noEmit` clean, `pnpm lint` 0 errors, `pnpm test:int` with `PARTNER_DB_TESTS=1` 21 files /
  207 tests passing. **Clicked in Chrome:** the partner side on localhost as pp-test@k7computing.com (the listing's three groups, the open scheme registered through the
  terms box with the flash and the registration facts, the running scheme's provisional progress line and deals counted, the closed scheme's Check eligibility page saying
  under review); the K7 side on the tunnel host through the probe session (the ledger with the counters, the closed scheme's sheet, *Compute the results* → 1 organisation
  eligible at ₹7,00,000, the result sheet, an adjustment of −3,00,000 making it not eligible with the gap, then −1,00,000 replacing it, the record showing both). Two things
  the browser caught, fixed: the filed ledger's tab overlapped the heading or paragraph before it (`.phome .counted` margin, since `.phome .ledger` resets margins;
  `.sch-lede`), and at a phone width the listing's first tab met the head's hint (`.sch-list` margin). For the check two PP-TEST deals got a won snapshot by a throwaway
  script: K7D-00030 (the real OPP-2610-00268 row: won 2026-08-24, ₹7,00,000) and K7D-86083; the next CRM read-back puts K7D-00030 back as the CRM has it. **Clicked after
  the session resumed** (the usage limit had interrupted it; an old Claude shell from two days earlier was ended first): publish behind the confirm (the flash, the strip
  reading *Published*, the results ledger's payout column), the Finance CSV fetched through the route from the K7 session (header row and the PP-TEST row with GSTIN, PAN,
  admin email, the adjustment and its reason), the payout recorded as processed with a reference and a note (refused without one in the test), the partner signed in again
  on localhost through the code door and read the published result (Eligible, ₹6,00,000, slab 1, the payout Processed), raised a dispute (the status fell to Under review on
  both sides), K7 resolved it on the result sheet (the answer and the record on both sides), the unauthenticated routes (export, both attachments → the door; the cron route
  401 without the secret, `{"schemes":[],"errors":[]}` with it). A phone width through 390px frames on both sides: the partner listing's ledgers scroll in their wrap, the
  progress and the result stack, the K7 counters, views and ledgers stack and scroll. Not clicked: the attachment routes with a real PDF (none seeded; the collateral test
  proves the upload path). Nothing committed (Navin commits). **Next:** M8 (notifications, templates, SLA, reporting); §7's author questions still open.

- **Session 14 (2026-10-23, Claude Code): M8 built, notifications, templates, the approval SLA and the reports.** The event catalogue (`notify-model.ts`: 37
  events, group, audience, default delivery, the placeholders each fills; a test reads the library's `event:` lines and refuses one missing from the catalogue) and the
  templates (`partner-mail-templates`, one row per event: enabled, delivery at once · daily digest · bell only, subject, body in plain text with `{{placeholders}}`),
  rendered in `notify()` per recipient (`{{recipient}}`), the delivery recorded on the bell row; `notify()` gains `vars` at every call site and an `email` recipient
  kind (mail only, for managers). The daily digest (`digestPass`: rows older than two minutes grouped per address, one mail each, every row marked whether mailed or not,
  then the retention of read rows; `POST /api/partners/notifications/digest`). The approval SLA (`sla-model.ts` on the support engine's business-hours maths: the clock
  from the latest submission of a deal or application, or the extension request, never while the item waits on the partner; `readClock` → due, used, left, ok · at risk ·
  breached; `sla.ts`: `openClocks`, `slaCounts`, `sweepSla` once per clock start to the queue's role, the holders' managers and the escalation addresses;
  `POST /api/partners/sla/sweep`). Settings: the staff row's `manager`, `notify.signature`, the SLA tab (hours, days, zone, warning share, escalation), all on the K7
  settings page. Pages: the templates page under Notifications (the catalogue as filed ledgers by group, the chosen event's form, placeholders, preview on sample
  values, *Send me a test*, *Back to the code's text*, *Run the digest*), the reports page with its four ledgers and CSV routes, the *Decision due* column on both K7
  queues, the SLA value on both K7 sheets, the Approval SLA line on the K7 home, the Reports tab. Section 10 P25–P27 (`partner.css`, `PartnerParts` README, CHANGELOG,
  `design-system.json`). Tests: `partner-notify-model` (9), `partner-sla` (9), `partner-reports` (6) pure; `partner-m8-db` (3 against Postgres: a template on the bell
  row with the digest rule, the digest and the retention, the SLA sweep noticing a deal and an application once). Verified: `pnpm generate:types`, `npx tsc --noEmit`
  clean, `pnpm lint` 0 errors (14 pre-existing warnings), `pnpm test:int` with `PARTNER_DB_TESTS=1` 26 files / 235 tests passing (one run under load timed the onboarding
  test out and left organisation 137 behind, removed by hand; `partner-schemes-db` counted open schemes against a fixed 1 and failed once the dev seed's Festive
  Push applied to its organisation, so it now measures the counters against the listing). **Clicked in Chrome on localhost**, the K7 side through the probe door
  (`SUPPORT_DEV_AGENT=probe` set for the check and put back): two PP-TEST deals seeded by a throwaway script, one four days old (K7D-90801, K7D-90802; removed after);
  the deals queue's *Decision due* column (*due in 1 d 3 h · at risk* on the old one against the 48-hour target, the clock counting Saturday and skipping Sunday), the
  deal sheet's strip, the reports page (the counters, the four ledgers with their sums, the SLA queue), the templates page: a template written for `deal.note` (subject
  and body with placeholders, *Email at once*), saved and read back as *Edited* with the preview on sample values, *Send me a test* refused with the reason (no
  SMTP_URL) and the rendered subject, *Run the digest* (0 emails for 2 rows); a K7 note on K7D-90801 → the partner's bell row carried the template's subject; the
  settings round trip (target 24 h, a manager and an escalation address saved → the queue read *overdue by 1 d 3 h*, the Reports tab counted 01, *Run the SLA pass* sent
  one notice, the staff bell showed *Approval SLA breached: K7D-90801* with the overrun → target back to 48). Four things the browser caught, fixed: the templates page's
  first tab sat on the lede (`tpl-layout` margin); the chosen delivery's hint vanished on the inverted label; the side panel was sticky and taller than a laptop
  viewport, so *Save* could not be reached (no longer sticky); `savePartnerSettings` wrote the SLA days as numbers into a select of strings, so the save failed
  ("SLA > Sla > Days is invalid"; now strings, a test reads them back). Also fixed: the deal sheet's *Waiting* counted from the last note rather than the clock start.
  Known from the dev data: the K7 staff bell had three `sla.breached` rows left by the database test's sweep (the sweep notices every open clock, the test's deals
  among them); the test now removes them by subject and the three stray rows were deleted. Phone width (390px frames): the templates page's ledgers scroll in their
  wrap and the form stacks under them, the reports' counters and ledgers stack and scroll (two things fixed there: a ledger's foot line was clipped and the next
  ledger's tab sat on it, so the foot wraps and the stack's gap clears the tab; the scheme dates no longer break per word), the queue scrolls. **Deviation from §5:** the template body is plain text with
  placeholders, not Lexical: the mail helper sends text with a plain HTML layout and the bell row is text, so a rich-text body would need a renderer for no gain;
  reopen if HTML mail is wanted. Nothing committed (Navin commits). **Next:** M9 (hardening, staging, the go-live gate); §7's author questions and §11's defaults
  still to confirm; the LMS last.

- **Session 15 (2026-10-23, Claude Code): M9 built, hardening and the runbook.** `05-staging-and-go-live.md` written (what a host must provide,
  the environment per stage, the scheduler with its seven routes, watching it, the go-live gate on `07-production-safety.md` §7, backup and restore,
  what is left by decision); hosting is still undecided, so staging is specified, not stood up. Code: `src/lib/cron-auth.ts` (one constant-time
  guard for the seven partner routes and the support sweep; an unset or short `CRON_SECRET` opens nothing), `canSendFrom` / `clientKey` beside
  `canSend` in the OTP module and on the join page and the partner door (thirty codes per client address per fifteen minutes), the portal
  headers in `next.config.ts` (`X-Frame-Options: SAMEORIGIN`, `nosniff`, the referrer policy, `Permissions-Policy`; the API routes `no-store`),
  `crm.features` (account · opportunity · read-back) under the master switch in the model, the global, the K7 settings page and the action, with
  `FEATURE_OF` gating `enqueueOutbox`, `runJob` and the drain (a job whose feature is off waits as pending, no attempt counted) and `syncDeals`
  refusing when `sync` is off, forced or not; the collection `partner-job-runs` with `recordJobRun` around every scheduled route; `ops-model.ts`
  / `ops.ts` (the jobs catalogue, the standing, the readiness checks, health, housekeeping); `/partners/portal/k7/operations` (Channel Manager;
  the Operations tab and the home link), `GET /api/partners/health`, `POST /api/partners/housekeeping`; `scripts/backup.sh` and `restore.sh`
  (`pnpm backup`; `backups/` ignored); `vitest` `testTimeout` 30 s for the database flows. Section 10 P28 (`partner.css`, `PartnerParts`
  README, CHANGELOG, `design-system.json`). Tests: `partner-m9` (29 pure: the four machines as full matrices, the scope corners, the cron door,
  the limiter, the switches, the jobs and readiness, ten anonymised deals against the conflict matcher, a slab fixture against the eligibility
  maths), `partner-routes` (4: every route and server action under the portal read from the source for its door; the shared bell action and
  sign-out are the exceptions), `partner-m9-db` (4 against Postgres). Verified: `pnpm generate:types`, `npx tsc --noEmit` clean, `pnpm lint`
  0 errors (14 pre-existing warnings), `pnpm test:int` with `PARTNER_DB_TESTS=1` 28 files / 276 tests (275 passing, one skipped). Two suite-level flakes fixed on the way:
  the onboarding flow timed out once at the 5 s default while every database file booted, as in session 14, and left organisation 154
  behind, removed by hand (`testTimeout` is now 30 s); and with ten files booting Payload at once, each with its own pool, Postgres refused
  connections ("sorry, too many clients already", 203 times in one run) so two whole files failed at boot (`maxWorkers: 4` in
  `vitest.config.mts`; the suite takes the same 31 s). Asked to test the onboarding flow again: alone and in two full runs, green. **Backup rehearsed:** the development database dumped (6.2 MB) and the uploads tarred into the
  scratchpad, restored into a scratch database with `restore.sh`, the row counts of `partner_orgs`, `partner_deals`, `partner_applications`,
  `partner_audit` and `pages` equal, the upload tree back, the scratch database dropped. **From the shell:** health 200 `{ok:true}`, housekeeping
  401 with a wrong secret and 200 with the right one, the SLA pass 200, the headers on the door and the API. **Clicked in Chrome on localhost**
  (`SUPPORT_DEV_AGENT=probe` set for the K7 side and put back): the partner side as pp-test@k7computing.com: the dashboard's Open · Won · Lost
  views (Lost empty with its line), the partner sheet's CRM facts on K7D-00030 (Won · Pre Sales · the CRM's ₹12,00,000 and order ₹7,00,000 ·
  closed 24-08-2026), the deal file served inline through the partner route, an extension requested on K7D-00030, a deal registered for the
  purpose (K7D-00074), the deals list and the deal sheet at 390px in a same-origin frame (the ledger scrolls in its wrap, the facts stack);
  the K7 side through the probe door: the Operations page (0 failing, 5 notes right for a laptop, the two routes the shell had called as
  Running and five Never run, the recent runs), *Run housekeeping* (0 · 0), the opportunity switch turned off on the settings page and read on
  Operations as "On: accountCreate, sync. The others wait as pending", then on again, K7D-00074 rejected with its note, the extension on
  K7D-00030 declined (back to Approved, the window running on to 21-01-2027), Operations and the settings' switches at 390px; then the invited
  user's first sign-in (pp-test-join@k7computing.com: the code on the verify page, the row active with its sign-in time, the K7P-00003 home).
  Two things the browser taught: `X-Frame-Options: DENY` blocked the 390px frame, so the header is `SAMEORIGIN` (the site may frame its own
  pages, nobody else may); and with `AUTH_URL` still pointing at the 2026-10-22 tunnel host, Auth.js sent the signed-in partner to that origin
  (where an old agent session answered) although the session was set on localhost: a development-configuration artefact, right on a staging
  host where `AUTH_URL` is the host's own URL. Test data left: K7D-00074 (rejected), K7D-00030 with its one extension used (declined),
  pp-test-join active. Nothing committed (Navin commits). **Next:** the LMS (M10 training, M11 certificates); §7's author questions and §11's
  defaults still to confirm; at launch, the gate in `05-staging-and-go-live.md` §5 and the backup rehearsal on staging (§6).

- **Session 16 (2026-10-23, Claude Code): M10 built, training.** Model `training-model.ts` (ranges, completion, rules, unlock, the seeded
  draw, grading, standing, the CSV), the adapter `video.ts` (Vimeo · direct link · uploaded file), the library `training.ts`, the shared
  file server `files.ts` (collateral now uses it); collections `partner-tracks`, `-courses`, `-modules`, `-questions`, `-training-files`,
  `-progress`, `-attempts` (group *Partner training*, Payload role `trainingEditor`); `partner-settings.training` with the K7 settings
  section; the partner pages under `/partners/portal/training` (list, course, module with `Player.client.tsx`, the paper with
  `TestPaper.client.tsx`, the result, the organisation view), the progress and file routes, the K7 desk `/k7/training` (ledger, course
  sheet with learners, the CSV import, the template route); the Training link, tab and home lines; events `training.course.passed` and
  `training.bank.empty`; `pnpm partner:seed-dev … --training --trainer`. Section 10 P29–P32 (`partner.css`, `PartnerParts` README,
  CHANGELOG, `design-system.json`). Decisions 20–23 written. Verified: `pnpm generate:types`, `npx tsc --noEmit` clean, `pnpm lint`
  0 errors (14 pre-existing warnings), `partner-training` (19 pure) and `partner-training-db` (5 against Postgres: gaps do not complete,
  enough does and learns the duration, the unlock after the second module, the paper by the course's rule, the resume, the grading,
  the pass in the standing and the bell, the organisation view, the K7 ledger, scope B, the CSV import); the whole suite with
  `PARTNER_DB_TESTS=1`: 300 tests, 2 failed only because the seed ran during the run and the test assumed no other Sales course
  (fixed to read its own course; green alone). **Clicked in Chrome on localhost** as pp-test@k7computing.com: the training list
  (two tracks, the modules bars, Locked tags), the course sheet (strip, module list, the locked test box with its reason), both Sales modules
  played muted through the browser player (the live watched line moved, *Module complete · 96% / 97% watched · Progress saved*, the next-module
  button appeared), the test started (five questions drawn, the clock, 05/05 answered), submitted wrong (*20% · not passed*, the review with the
  correct options outlined and the explanations), taken again right (*Passed with 100%*), the attempts ledger, the organisation view (two
  users, the Sales user's pass, the Technical user's locked rows), the bell row *PP-TEST Selling the new product passed · 100%*; the empty
  state for an admin without a learning role (pp-test-join); the K7 side through the probe door (`SUPPORT_DEV_AGENT=probe` set and put back,
  the dev server restarted both times): the home's Training line, the Training tab with its count, the courses ledger (views, counters),
  the course sheet (modules, the learner with the pass in signal, the recent attempts, the bank by type), a CSV with four rows imported on
  the Technical course (*3 questions imported; 1 row refused* with the line in the pending box, the bank 3 askable of 3); the admin as the
  seeded Training editor (the *Partner training* group, the course with its rules and joins, the imported questions, the attempts read-only,
  the deals collection refused); then the Technical course end to end at 390px in a same-origin frame (the module complete, the paper
  resumed, *67% · not passed* with the review), and the training list, course, module, organisation, K7 ledger and course sheet at 390px.
  Four things the browser caught, fixed: the paper's option rows collapsed to the key column (the list item was a grid too); a ledger
  tab sat on the *Modules* heading of the K7 course sheet; the ledgers in the `library` grid grew to their table's width on a phone
  (a grid item's `min-width: auto`; now 0, which also fixes the collateral and scheme ledgers); and the browser player's `loadedmetadata`
  fired before hydration in the frame, so the duration was never learnt and the share stayed at zero (the player now reads the duration
  whenever it ticks or flushes). Also the seed's second clip (Google's Big Buck Bunny sample) did not load in Chrome; swapped for MDN's
  CC0 *friday* clip. Test data left: the PP-TEST tracks, courses and banks; pp-test's progress, four attempts (two per course); the
  pp-test-trainer admin user. Nothing committed (Navin commits). **Next:** M11 (certificates), then the certificate gate switch.

- **Session 17 (2026-10-24, Claude Code): M11 built, certificates.** Model `certificates-model.ts` (the numbers and their parser, the
  bands, `expiryFrom`, the state today, `shouldIssueIndividual`, `reminderDue`, `readRule`, `orgMirror`, `verifyView`, the settings),
  the PDF `certificate-pdf.ts` (pdf-lib + fontkit on the Archivo and Plex Mono TTFs now in `design-system/assets/fonts` with their OFL
  texts, the QR from `qrcode`'s modules, the K7 mark from the logo SVG's paths), the library `certificates.ts` (issue on a pass, the
  organisation's request · issue · decline · revoke, the sweep with the backfill, the mirror, the K7 ledger and counts); collections
  `partner-certificates` and `partner-certificate-files`; `partner-settings.certificates` with the admin tab and the K7 settings section
  (the rule as a types × tracks table); ten events in the catalogue and `notify()` carrying attachments (`sendMail` too); the job
  `certificatesSweep` with its route, Operations line and summary; the partner pages `/certificates`, `/[id]`, `/[id]/file`, the public
  `/partners/verify` and `/[id]`, the K7 `/k7/certificates`, `/[id]`, `/[id]/file` and actions; the recertify standing in
  `training-model.ts`/`training.ts` (the certificate on the course view, `issueForPass` from `finalise`); the strips and links on both
  homes, the training list and course page, the result page, the organisation page, the K7 partner sheet, the header and the desk strip.
  Section 10 P33–P35 (`partner.css`, `PartnerParts` README, CHANGELOG, `design-system.json`). Decisions 24–26 written; `.env.example`
  gains `PARTNER_CERTIFICATE_DIR` and `PARTNER_CERT_SIGNATORY`; the runbook's scheduler table the sweep. Verified: `pnpm generate:types`,
  `npx tsc --noEmit` clean, `pnpm lint` 0 errors (14 pre-existing warnings), `partner-certificates` (15 pure, the PDF parsed back with its
  fonts) and `partner-certificates-db` (5 against Postgres: the pass issues the row, the file and the bell and a retake prints nothing; the
  Technical pass meets the rule, the request reaches the Channel Managers, K7 issues and the mirror and the deal gate follow; the public
  view's minimum and the scope; revoke, the gate, the waiver, the renewal after a revocation; the sweep's reminders once per threshold,
  the expiry, the recertify standing, the recertification and the renewal request); the whole partner suite with `PARTNER_DB_TESTS=1`:
  25 files, 239 tests green. **Clicked in Chrome on localhost**: as pp-test (Partner Admin, Sales, Technical): the certificates page
  (the backfilled Sales certificate from the suite's sweep, the rule 1/1 · 0/1), the certificate sheet with its QR, the PDF inline through
  the route, the public page (genuine and valid; an unknown number; a lowercase number redirected to its canonical form), the training
  strip, the Technical test taken and passed (100%, the result page naming K7P-C-EFPPAQ, the mail logged with the PDF attached), the
  rule met and *Requested from K7* on the strip and the card; through the probe door as K7: the desk (1 to issue), the request's sheet,
  *Issue →* (the PDF, the mail with the attachment to the Partner Admins), the organisation PDF, the K7 partner sheet's certificate line
  and panel, the settings' Certificates section saved (the deal gate switched on, Merit 80 and back to 85), revoke with a reason (the
  public page reads *Revoked.*), the sweep by hand (the renewal request raised; the first click surfaced a bug: the action's redirect sat
  inside its try and read as *The sweep failed: NEXT_REDIRECT*, fixed), the request declined, the sweep again (0 requests: the decline
  guard holds), the renewal issued from the revoked sheet (K7P-O-9ZYCY2 renews K7P-O-37MSTG), Operations' Certificate sweep line, the
  templates' Certificates group, the admin's Certificates collection as the seeded Training editor (read-only); then as pp-test again:
  the home strip *Valid to 24-10-2027* with *Register a deal* open under the gate, the bell rows (issued, declined, revoked), the course
  page's panel naming the certificate. At 390px in a same-origin frame: the K7 sheet, the K7 desk, the public page, the partner
  certificates page and sheet; two things caught and fixed (the facts grid's value track had no minimum so the verification URL pushed
  the card out; the card's display number did not scale). Also caught: the suite's sweep backfilled a certificate for the training
  test's organisation before that test removed it, and the foreign key then kept the organisation alive; the training test now removes
  its certificates first, and the leftover (K7P-C-AE2NWE, organisation 239) was removed by hand. Test data left: pp-test's two individual
  certificates (K7P-C-GGCKS6, K7P-C-EFPPAQ), the organisation's K7P-O-37MSTG (revoked), K7P-O-FG3M6K (declined) and K7P-O-9ZYCY2
  (valid to 2027-10-24), the Technical pass, the deal gate on, `SUPPORT_DEV_AGENT` set and put back. Nothing committed (Navin commits).
  **Next:** the M0 items that still wait on people (§7), `/partners/verify` linked from the marketing Partners page when it is written,
  the go-live gate at launch (`05-staging-and-go-live.md` §5).
- **2026-10-27 (18)** — **Test plan for the partner portal team, every case walked.** The plan for the non-technical evaluators is a
  shared doc (https://claude.ai/artifact/7nvCpaaAsq3PtAH1jaKLwd): setup and accounts, 18 partner cases (P-01…P-18) and 20 K7 cases
  (K-01…K-20) as plain steps, the walk-through results with a dropdown column for each tester, the bugs, and what is not built
  (video encoding and hosting, email, SMS, the scheduler, the terms text, the /partners page, the generic admin). All 38 cases run on
  the tunnel production build: in Chrome as Navin (Microsoft door), partner sessions and the admin in Playwright on system Chrome
  (the extension dropped mid-run), the K7 desk after that through the probe door on a local-only `next start -p 3100` (stopped after).
  28 pass, 9 pass with an issue, 1 fail. Bugs: **B-01** a suspended / disabled / removed partner's open session loops
  (`/partners/portal` → `sign-in?error=suspended` → the sign-in page redirects any `kind: 'partner'` session home; seen for
  suspension only, the other two share the path); **B-02** notice links, the certificate verify link and its QR say
  `http://localhost:3000` (`NEXT_PUBLIC_SERVER_URL` in `.env`, baked into the build); **B-03** approvals take 10–20 s with no busy
  state and a second click errors. Smaller: M-01…M-11 in the doc (attachment dropped after a refused deal form, the partner never told
  about a conflict, FR codes in user text, admin dates month-first, a `.mov` refused and an HEVC MP4 accepted that Chrome cannot
  play, …). UAT writes: account ACC-2610-00157 (00:18:23Z), OPP-2610-00269 (00:33:22Z), -00270 (00:34:54Z), -00271 (00:40:12Z).
  Local changes: scheme PP-TEST Q3 Sprint (43) added at 00:45:45Z for the testers' compute case, PP-TEST Walkthrough Scheme (45) and its
  draft duplicate (44), collateral 113 retired, training files 1–2 and module 36, two imported questions; settings protection 60 → 90
  and Navin's Marketing/Training Admin roles added at 00:39:38Z and removed at 00:56:37Z. Nothing committed (Navin commits).
  **Next:** fix B-01…B-03 (B-02 is `.env` + `scripts/serve.sh rebuild`), add the testers to Staff, name the report channel, send the doc.
- **2026-10-27 (19)** — **B-01…B-03 fixed and re-checked in Chrome.** B-01: `session-model.ts` (`signInLanding`, `sessionError`) and
  `partnerSessionState()` in `session.ts`; the sign-in page sends a partner session home only while `canSignIn` still holds, otherwise
  it shows the reason with a working form; `requestPartnerCode` ends a stale session first. B-02: `partnerPublicUrl()`
  (`public-url.ts`: `PARTNER_PUBLIC_URL`, else `AUTH_URL`, else `NEXT_PUBLIC_SERVER_URL`, read at run time) for notices, the status
  link and certificates; the stored certificate PDFs were moved aside (scratchpad) so they redraw with the right address. B-03:
  `SubmitButton.client.tsx` (`useFormStatus`: disabled, "Recording…") on the K7 decision, extension, amend, CRM-run and sync buttons;
  a repeated decision (`isRepeatedDecision` / `isRepeatedDealDecision` / `isRepeatedExtension` in `status.ts`) returns an ok flash
  ("Already approved by …") and changes nothing; design system P10, CHANGELOG, `design-system.json`. tsc clean, lint 0 errors, int
  304 passed; `partner-deals-db` fails on HEAD too (its first `submitDeal` meets the certificate gate, on in the development settings
  since M11): to fix separately. `scripts/serve.sh rebuild` 01:13:32–01:14:23Z. Chrome checks: B-03 01:16:39Z on K7D-00114
  (OPP-2610-00272, one approval in the record, the stale tab got "Already approved by Navin Sylvester."), B-01 suspended 01:18:19Z and
  disabled 01:19:42Z (sign-in page with the reason, no loop; reinstated and re-enabled users signed in again), B-02 01:21:13Z (a new
  invitation's notice and the redrawn K7P-C-VGKWKN PDF carry the tunnel host). Test data: K7D-00114, pp-test-walk-5 (Sales, K7P-00028).
  Not committed (Navin commits). Note: when the tunnel address changes, `AUTH_URL` already carries the new host, so no rebuild is needed for links.
- **2026-10-27 (20)** — `partner-deals-db` and `partner-m8-db` failed on HEAD since M11: their test organisations had no certificate
  and the development settings have `deals.requireCertificate` on, so the first `submitDeal` was refused (correctly). Both tests now
  give their organisations a certificate waiver to 2099-12-31, so they test the deal machine and the M8 templates/digest/SLA whatever
  the setting; the gate keeps its own tests (`partner-deals`, `partner-certificates-db`). Full suite with `PARTNER_DB_TESTS=1`:
  342 passed, 1 skipped; tsc clean, lint 0 errors; no test organisations left behind.
- **2026-10-27 (21)** — **The site menu reaches every part of the portal, and `/partners` has content.** The Header global's *Partners*
  mega menu now has four columns (seed `headerMenu` in `src/endpoints/seed/index.ts`): *Partner programme* (the K7 Partner Network
  page, apply, check a certificate, Let's talk), *Partner portal* (sign in and the eleven partner pages), *K7 partner desk* (the staff
  door and the eleven queues) and *Partner admin* (the CMS screens: settings and staff, products, collateral, schemes, training
  courses, modules, question banks, organisations). Written to the live global by `pnpm tsx scripts/seed-nav-item.ts Partners`, which
  rewrites that one item and keeps the rest of the menu, the primary action and the footer as edited in /admin (`seed:nav` would
  overwrite them). `/partners` is a Payload page (id 57, `partnersPage` in `seed/pages2.ts`, `pnpm seed:page partners`) from the
  content doc's Partners section: the banner, the two partner types, the portal's pages for partners and for K7 staff, and the
  Let's Talk form (new form *Partner enquiry*, created by `seed-page.ts`, which now creates a seed form the database lacks). The
  reseller and MSP lists the doc asks to recreate are not there yet. Found on the way: the site had served a header cached on
  2026-10-15 (one-year `unstable_cache` entry, *Partners* without columns) because the seed scripts write with revalidation off; the
  entry was removed from `.next/cache/fetch-cache` before the rebuild. Fixed: a partner session sent to a K7 desk page looped between
  the desk and the sign-in page (`signInLanding` now keeps it on the door with a note; the staff door replaces the session).
- **2026-10-27 (22)** — **A simple front page and the core links** (Navin: "like support portal", "remove unnecessary links and
  complicated structure"). `/partners/portal` is now the help centre's shape and public (`proxy.ts` lets the exact path through; an
  agent still goes to the desk; an unusable partner session still goes to the door with its reason): visitors get the hero (Sign in,
  Apply), the four ways in and the apply sheet; partner users get the hero with the sales-material search and four counts (deals
  protected, need your answer, schemes open, Register a deal, or training to finish with the reason when registration is closed), the
  four ways in with where each stands, the latest three notifications and the register sheet. The status strip, side column and
  record moved off the home (the organisation page has them). The partner header went from nine links to five (Home · Deals · Sales
  material · Schemes · Training; `HeaderShell` links take `match` and `exact`, so the dashboard counts as Deals and certificates as
  Training; the organisation is behind the name, notifications behind the bell, both in the phone menu), the K7 header to Desk and
  the decision queues (the rest is the desk strip), the footer to two links. The site menu's *Partners* item went from four columns
  (about 35 links: every portal page, the eleven desk queues, the CMS screens) to two (programme 3, portal 5), written live with
  `seed-nav-item.ts Partners` at 03:29:45Z; `/partners` reseeded at 03:29:49Z (page id 57 → 58, untouched since its seed) with the
  portal section cut to four rows and the staff section removed; the footer's *Partner portal* link now points to `/partners/portal`
  (live row updated 03:29:53Z). Header/footer fetch-cache entries moved to the scratchpad before the rebuild. Builds served 03:30:56Z
  and 03:33:20Z. Chrome (localhost): visitor page and header (one bug found and fixed: *The programme* was current on every portal page,
  as `/partners` prefixes `/partners/portal`); signed in as `pp-test@k7computing.com`: the page, the counts, search → collateral
  `?q=datasheet`, Deals current on the dashboard, Training on certificates, the name → organisation, 390 px in a frame (no
  horizontal scroll, phone menu with Organisation and Notifications), light theme and back, sign-out; the K7 header on the desk; the
  site menu and `/partners`. tsc clean, lint 0 errors, int 307 passed. Design system P6 and the header in `PartnerParts`, CHANGELOG,
  `design-system.json`; `04-portal-guide.md`. Not committed (Navin commits).
- **2026-10-27 (23)** — **The Partners menu cut to three places** (Navin: too many links that lead to the same place or do not make
  sense; keep a customer- and partner-friendly approach). Session 22's two columns repeated their own headings (*K7 Partner Network*
  = *Partner programme*, *Portal home* = *Partner portal*) and sent visitors to four signed-in pages that only bounce to the door. Now
  three columns without rows, the About Us pattern: *Partner programme* (`/partners`), *Become a partner* (`/partners/join`),
  *Partner portal* (`/partners/portal`, the front page with both doors); *Support* stays one link. A single column with three rows
  was tried and dropped: the phone menu lists columns only, so Join and the portal would not reach a phone. Live at 03:59:03Z
  (`seed-nav-item.ts Partners`). `/partners` reseeded at 03:54:13Z (id 58 → 59): the portal section removed (its four rows led to the
  door; the portal's front page explains them), leaving the content doc's banner (Apply, Go to the partner portal), the partner
  types and the Let's Talk form. Build served 03:59:40Z. Chrome: the desktop panel, the 390 px phone menu (Partners → Partner
  programme · Become a partner · Partner portal), `/partners` and the portal front page.
- **2026-10-28 (24)** — **The settings page in sub tabs** (Navin: the page needs sub tabs or grouping to declutter it). The K7
  settings page's eleven sections now sit under six tabs on the existing `rtabs` part, server-rendered with `?tab=` as on the case
  sheet: *Staff and roles* (default), *Programme* (with collateral and schemes), *Deals and SLA*, *CRM mirror*, *Training and
  certificates*, *Notifications*. Each tab is its own form posting `section`; the action builds only that section and keeps the rest
  as stored, so a switch on a hidden tab is never read as off (the old single post would have reset them). Links from the
  certificates desk (`?tab=training#certificates`) and the templates page (`?tab=notifications`) follow. Checked on a local-only
  `next dev -p 3100` through the probe door (stopped after): every tab renders; saving all six tabs unchanged left every stored value
  as it was (pg_dump of the `partner_settings*` tables before and after: only Payload's regenerated row ids differ); 390 px in a
  frame: no horizontal page scroll on any tab, the strip scrolls inside itself. Served to testers: `scripts/serve.sh rebuild` at
  23:31:25Z, serving 23:31:58Z (build `1RilaiyPPPwH7paHYKlCF`); signed out, `?tab=crm` goes to the staff door with the tab kept. Design system: `PartnerParts`, CHANGELOG, `design-system.json`; `04-portal-guide.md`.
  Same day, Navin: the desk strip's tab design used again for the sub tabs looked wrong, use the sections as on the reports page.
  The switch is now the reports' and dashboard's `seg-choice` of links (`is-on`), wrapping on a phone (`set-views` in `partner.css`);
  the save button keeps CRM and SLA in capitals and the flash names the section (*CRM mirror saved.*). Checked on :3100 again (390 px:
  the switch wraps to four lines, no page scroll; the CRM save returns to its section), then rebuilt for testers: 23:36:12Z, serving 23:36:38Z (build `Jtn3znYMO-wzRd6jgmukx`).
  Then, Navin: the section headings (K7 staff; Programme, Collateral, Schemes; …) had no separation and the page looked cluttered.
  Each heading on the settings form now stands on a `line` hairline with a 32 × 2px signal segment at its start (`set-form .sub-head`
  in `partner.css`, scoped so the shared `sub-head` elsewhere is untouched). Checked on :3100 in dark and light (theme set back to
  dark), then rebuilt for testers: 23:42:20Z, serving 23:42:45Z (build `3sa-LdDc_CTgiZXuhOQ3s`).
- **2026-10-28 (25)** — **The section heading on both portals** (Navin: the heading rule not only on the settings page but on
  every page, partner and support). `sub-head` in `portal.css` (section 09 S30) now stands on a hairline with the 32 × 2px signal
  segment; over a block that opens on its own ink rule (ledgers in `table-wrap`, rows, facts, threads, empty states; the list in
  `portal.css`) the hairline drops and the segment lies on that rule, so no page gets a double line. The KPI settings' section titles
  take it too; the product desk's inline-ruled item lists became `item-rows`; the settings-only rule left `partner.css`. Measured on a
  local-only `next dev -p 3100` (stopped after) by walking every page the probe agent, the K7 desk and `pp-test@k7computing.com`
  reach: 58 workspace and desk pages with 70 headings, 21 partner pages with 11, no heading left with its own line over a ruled block;
  the customer case sheet and profile were read from the source (a customer sign-in would create a UAT contact). Dark and light
  checked (theme set back to dark). Design system: SupportParts S30, PartnerParts, CHANGELOG, `design-system.json`.
  Rebuilt for testers: 00:03:46Z, serving 00:04:22Z (build `EPNxEy7fHr5weHHo8psLW`).

