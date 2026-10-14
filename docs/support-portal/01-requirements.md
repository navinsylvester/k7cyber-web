# Support portal requirements (agent workspace + customer self-service on Dataverse)

Sources: the ten view exports (`04-data-profile.md`), the agent dashboard screenshot, and
live metadata/app discovery on 2026-10-10 (`03-metadata-summary.md`). Decision taken
2026-10-10: **one product for both audiences, phased, agent workspace first.**

## 1. Audiences and phasing
| phase | audience | replaces | sign-in | size |
|---|---|---|---|---|
| 1 | Support agents and managers | model-driven app "Dynamics 365 Mobile – custom" (+ parts of Customer Service Hub) | Microsoft 365 / Entra ID, calls Dataverse as the user | 65 licensed users |
| 2 | Customers (consumer + business contacts) | nothing today (only 0.4% of cases arrive via Web) | email link or mobile OTP, backend calls Dataverse as an application user | 224k contacts, ~40 new cases/day |
| 3 (later, decided 2026-10-10) | Partners / dealers (8% of cases, 5,881 partner accounts) | nothing | as phase 2, scoped to the partner account | not before phase 2 is live |

Dataverse stays the system of record; Customer Service Hub remains available to admins.

## 2. What the data says (condensed)

```
k7_region (8) ◄── k7_state (39) ◄── alletec_city (2,200)
                                           ▲ City
account (36,982) ◄── parentcustomerid ── contact (224,400)
     ▲  customerid (account OR contact)      ▲ primarycontactid
     └──────────────── incident (383,180) ───┘
            │ new_issue → new_issuecategory (24) → new_subcategory (536)
            │ productid → product (1,982; 957 active)
            │ k7_rfe → k7_rfe (139)   k7_defectnew → k7_defect (76)
            └ timeline: email (858k; ~5 per case), annotation (625k; ~2 per case); phone calls and tasks are unused
knowledgearticle (93, 3 published)   alletec_k7contract (8,379)   queue (582; 2 public)
```

- Cases: about **2,300 per month** (13,932 created in the six months to 2026-10-10, read live
  from production; the Excel export under-counted because it was capped at 100,000 rows).
  Origin: Phone 79%, Email 19%, Chat 1.6%, Web 0.4%.
  Status reasons: Active = Open, Reassigned, In Progress-Support/-Customer/-Lab/-Principle
  Support; Resolved = Closed-Call (5), Closed-Remote (1000); Canceled = Canceled, Merged.
  Internal KPIs: `k7_caseconsideredas` FCR 71%, SLA KPIs (first response / resolve by).
- Pickers on a case: Product (`productid`, show `alletec_productnamecrm`), Issue Category →
  Sub Category (cascading lookups), Vertical Type, Customer Type, Priority, Origin.
- Contacts: email 97.8% filled but duplicated; mobile 89% (Indian 10-digit); surname 19%.
- Accounts: type Customer/Partner/Distributor/MSP; Life Cycle Stage; city/state/region
  lookups; `k7_description` holds a licence key.
- KB is effectively empty (3 published; the rest are 2026-07-28 Copilot samples).
- RFEs are live (2025 entries); defects dormant since 2020.

## 3. Data-quality rules
1. Duplicate contacts per email: pick newest-modified on sign-in; merge before launch.
2. Cases owned by an account: business users see `customerid = account` plus cases where
   they are `primarycontactid`.
3. Merged / Canceled cases are hidden from customers.
4. Ignore empty columns (Assign Date, Escalated On, Follow Up By, Middle Name) and the
   legacy pre-sales survey strings on incident.
5. Display products by `alletec_productnamecrm`; store the GUID.

## 4. Part A — agent workspace (phase 1, parity with the mobile app)

### 4.1 Sign-in and security
Entra ID sign-in; every Dataverse call runs as the signed-in user, so existing security
roles, business units, queues and audit apply unchanged. Nothing in the portal grants
access the user does not already have in Dynamics.

### 4.2 Navigation (from the app's sitemap)
Dashboards · Activities · Accounts · Contacts · Cases · Queues · Knowledge Articles ·
Products · RFEs · Defects · City / State / Region (reference admin). Out of scope:
Voice of the Customer surveys, social profiles, sync errors.

### 4.3 Cases
- **Phase-1 must-have views** (decided 2026-10-10): My Active Cases, My Resolved Cases,
  Active Cases, Email Cases - Open, FCR Cases. Phase-1 dashboards: "Active Cases
  Dashboard - Rafi" and "Customer Service Manager Dashboard". The rest follow.
- **Views**: reuse the 21 saved views as-is through `?savedQuery=<id>` (no re-implementation):
  personal (My Active, My Resolved), operational (Active, All, Email Cases open/overall,
  Channel Support Email Cases, Escalations Handled Daily, FCR Cases), service requests
  (All Service Requests, SR daily/weekly/monthly, POC/DEMO weekly/monthly, Technical
  discussion weekly), reporting (Daily Resolved <2 h Consumer / <4 h Enterprise, Monthly
  Report, Customer Connect, Customer Onboarding). Column chooser, sort, search, paging.
- **Case form**: title, description, customer (account/contact search + inline create),
  primary contact, origin, product, issue category → sub category, vertical, customer
  type, priority, product version, serial number, module/sub-module, case considered as,
  RFE / defect links, owner, status reason. Autonumber shown after save.
- **Timeline**: emails (with attachments) and notes with attachments are what production
  holds (six months: 71,511 emails, 24,231 notes, 1 phone call, 1 task); render phone
  calls/tasks generically if present. Add note; reply by email (optional, phase 1b).
- **Actions**: assign (user/team), resolve (Closed-Call / Closed-Remote with resolution
  text), cancel, reopen, merge (optional), add to queue / pick from queue, convert to
  RFE or defect (creates linked k7_rfe / k7_defect).
- **Queues**: "Items I am working on" and public queues (Default entity queue, Spam);
  most of the 582 queues are personal queues, so routing UI can stay simple.

### 4.4 Dashboards
Rebuild the two primary dashboards first: "Active Cases Dashboard - Rafi" (Active cases
by Agent, Case by Product, Case by Issue, Case by Status Reason, Product by Vertical
Type) and "Customer Service Manager Dashboard". 46 incident chart definitions exist in
Dataverse (`savedqueryvisualizations`); use their FetchXML aggregates as the data source
and render with your own chart library.

### 4.5 Customers, KB, products, reference data
- Accounts and contacts: list/search/create/edit with the city → state → region
  pickers; account page shows contacts, cases, contracts (`alletec_k7contract`).
- Knowledge: search and read published articles; create/edit drafts (publishing stays in
  Dynamics until the KB is populated).
- Products: read-only catalogue (Active, by marketing name, user band, years).
- RFE / defect: list, create, edit, link to case; YODIZ id field.
- City / State / Region: read, admin create/edit for a limited role.

### 4.6 Mobile
Responsive web app only (decided 2026-10-10): no offline editing, no native wrapper.
Phone layout must cover the phase-1 views, case form and timeline.

## 5. Part B — customer self-service (phase 2)

### 5.1 Identity
**Microsoft Entra External ID** (decided 2026-10-10): a separate external (CIAM) tenant
with an email + one-time-passcode sign-up/sign-in user flow (social providers optional
later). After sign-in the backend maps the External ID account (`oid` + email) to a
`contact` (duplicate rule in §3), creating one on first sign-in. Business users are
linked to their account through `parentcustomerid`. The External ID account id is
stored on the contact (reuse `adx_identity_username`, a free string column that
already exists, or add `k7_externalid` in a later schema release).

### 5.2 Features
- My cases (open / closed), paginated, sorted by modified date.
- Case detail: number, title, description, customer-facing status, product, issue
  category, created/modified, conversation (notes and emails flagged as public), attachments.
- Create case: title, description, product (Active), issue category (24) and optionally a
  curated sub-category list, attachments; origin = Web or Mobile App; customer = contact
  (+ account for business users); attribution in `adx_createdbyusername`.
- Reply on a case (note), reopen within N days.
- Knowledge base: published, non-internal articles; search.
- Profile: contact details, city/state/region, parent account; optional licence view from
  `alletec_k7contract`.
- Notifications on status change (email from Dynamics, or push from a webhook).

### 5.3 Customer-facing status mapping
| Dynamics status reason | Portal state |
|---|---|
| Open, Reassigned | Open |
| In Progress-Support, In Progress-Lab, In Progress-Principle Support | In progress |
| In Progress-Customer | Waiting for you |
| Closed-Call, Closed-Remote | Closed |
| Merged, Canceled | Hidden |

## 6. Shared backend
- One API layer with two credential modes: delegated (agent token, on-behalf-of to
  Dataverse) and application user (customer requests, with mandatory contact/account
  filters). The mode is chosen by the caller's identity type, never by the client.
- Option-set labels, products, geography, issue categories cached server-side (hours).
- Change-tracking poll or Dataverse webhook feeds notifications to both audiences.
- Audit: agent actions are attributed natively; customer actions carry the contact id in
  `adx_createdbyusername` / `primarycontactid`.

## 7. Non-functional
- Load: 65 concurrent agents handling ~2,300 cases/month (~110 per working day) plus the
  customer channel is far below Dataverse service protection limits (6,000 requests / 5 min
  per user per web server) if lists are paged.
- PII: India DPDP Act 2023; no PII in logs; data stays in the crm8 (India) region.
- Availability: read-only banner when Dataverse throttles (429) or is unavailable.
- Licensing: agents are already licensed; external customers on a custom portal must be
  confirmed in writing with Microsoft before phase 2 goes live.

## 8. Resolved by discovery (2026-10-10)
All logical names, option values and lookups are in `03-metadata-summary.md`. There is no
customer support portal today (the only Power Pages site is a 2019 marketing Event
Portal). Case history lives in `annotation` and `email`. Counts: 383,180 cases, 224,400
contacts, 36,982 accounts, 93 KB articles, 65 licensed users.

## 9. Decisions taken 2026-10-10
1. Responsive web app, no offline editing.
2. Phase-1 views: My Active, My Resolved, Active, Email Cases - Open, FCR Cases; dashboards:
   Rafi + Customer Service Manager.
3. Customer identity: Microsoft Entra External ID.
4. Partners: later, after phase 2.
5. Implementation lives in the enterprise website repo (`k7cyber-web`, Next.js 16 +
   Payload 3); production Dataverse must not be disturbed (see `07-production-safety.md`).
6. Development runs against a new sandbox: Minimal copy of production, seeded with the
   last 3–6 months of cases and their related records (not the full data).

## 10. Still open
- Which sub-categories (if any) customers may pick; reopen window; status wording.
- Whether to expose licence/contract data (`alletec_k7contract`) on the customer profile.
- URL paths inside the site (proposed: `/support` for customers, `/support/workspace`
  for agents).
- External-user licensing confirmation from Microsoft before phase 2 goes live.
