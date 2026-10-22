# K7 Partner Portal: requirements (verbatim from the source document)

Source: `source/K7 Partner Portal Requirements Document.docx`, written by Vijaichristopher, created
2026-10-05, last modified 2026-10-06, copied from `~/office_docs/website/requirements/` on 2026-10-22.
This file is a faithful Markdown conversion: headings, requirement IDs, tables and wording are the
author's. Only the spacing inside IDs ("FR-REG-03(Must)") was normalised. Nothing was added or
removed; what the document leaves open is listed in the appendix at the end, and the decisions
taken on it live in `02-build-plan.md`.

---

# K7 Partner Portal: Requirements Document

## 1. Overview and scope

The K7 Partner Portal is a web application where channel partners join K7 CyberSecurity's program, get trained and certified, register deals, and claim scheme benefits, with deal data synchronised from Microsoft Dynamics CRM. This document gives the development team the functional and non-functional requirements.

### 1.1 Objectives

- Move partner onboarding, certification, deal registration and scheme registration into one system.
- Give partners self-service visibility of their deals and scheme eligibility, reducing queries to the K7 channel team.
- Give K7 an auditable approval trail for partner, deal and scheme decisions.

### 1.2 In scope

- Partner registration for three partner types, with K7 approval.
- Sales and technical training (videos and tests), with individual certificates.
- Official partner organisation certificate once training requirements are met.
- Marketing collateral library.
- Deal registration with K7 approval.
- Deal status and value dashboard, sourced from Dynamics CRM.
- Scheme listing, scheme registration and eligibility check.
- K7 admin back-office for all of the above.

### 1.3 Definitions

| Term | Meaning |
|---|---|
| Distributor | Partner that buys from K7 in bulk and supplies resellers. |
| Integration Partner | Partner that integrates K7 products into its own solutions or services. |
| VAR | Value Added Reseller: sells K7 products bundled with its own services to end customers. |
| Partner organisation | The company that registers; it has one or more partner users. |
| Partner user | An individual employee of a partner organisation with a portal login. |
| Deal | A sales opportunity a partner registers with K7 for protection and tracking. |
| Scheme | A time-bound incentive programme with targets and a benefit (rebate, reward or similar). |
| Dynamics CRM | K7's Microsoft Dynamics system of record for accounts, opportunities and sales values. |

## 2. User roles and permissions

The portal has two user groups: partner users, scoped to their own organisation's data, and K7 internal users, scoped by function. Every API call must enforce these roles server-side, not only in the UI.

| Role | Group | Main permissions |
|---|---|---|
| Partner Admin | Partner | Manages the organisation profile and its users; registers deals and schemes; sees all organisation data. |
| Partner Sales User | Partner | Takes sales training; registers and views own deals; downloads collaterals. |
| Partner Technical User | Partner | Takes technical training; views deals; downloads collaterals. |
| Channel Manager | K7 | Approves or rejects partner applications; views all partners. Reviews registered deals, checks conflicts, approves or rejects. |
| Training Admin | K7 | Manages courses, videos, tests, question banks and certificate templates. |
| Marketing Admin | K7 | Uploads and manages collaterals and visibility rules. Creates schemes, approves scheme registrations, runs eligibility and publishes results. |

- **FR-ROLE-01 (Must):** A partner user belongs to exactly one partner organisation and can never see another organisation's data.
- **FR-ROLE-02 (Must):** A partner user/technical user/sales user can be the same user.
- **FR-ROLE-03 (Should):** A K7 user may hold more than one role.

## 3. Partner registration and onboarding

A company applies as one of three partner types, K7 reviews the application, and an approved partner gets portal access. Training and certification follow (sections 4 and 5).

### 3.1 Requirements

- **FR-REG-01 (Must):** A public registration form lets a company choose Distributor, Integration Partner or Value Added Reseller.
- **FR-REG-02 (Must):** Common fields: legal name, trade name, registered address, country, state, city, PIN/postal code, website, year of incorporation, company size, annual turnover band, primary contact (name, designation, email, mobile), and the K7 regions they operate in.
- **FR-REG-03 (Must):** Email and mobile OTP verification of the primary contact before the application is submitted.
- **FR-REG-04 (Must):** The applicant accepts the partner program terms; the accepted version and timestamp are stored.
- **FR-REG-05 (Must):** K7 Channel Managers review applications and can approve, reject with a reason, or send back for clarification. The partner can edit and resubmit.
- **FR-REG-06 (Must):** On approval, the system creates the partner organisation, a Partner Admin login, and a partner ID; the account is created or matched in Dynamics CRM.
- **FR-REG-07 (Should):** Partner profile edits that affect legal identity (name, GSTIN, PAN) go through K7 re-approval.

### 3.2 Application statuses

| Status | Meaning | Next states |
|---|---|---|
| Submitted | Awaiting K7 review | Under review |
| Under review | Assigned to a Channel Manager | Approved, Rejected, Clarification needed |
| Clarification needed | Partner must respond | Submitted |
| Approved | Account active; training unlocked | Suspended |
| Rejected | Final, reason recorded | none |
| Suspended | Access blocked by K7 | Approved |

- **FR-REG-08 (Must):** Every status change is logged with user, time and comment, and triggers an email to the applicant.

## 4. Sales and technical training

Approved partner users learn through self-paced videos and pass a test per course. Passing earns the individual a certificate.

- **FR-TRN-01 (Must):** Two learning tracks, Sales and Technical, each made up of courses, and each course of ordered modules (video plus optional reading material).
- **FR-TRN-02 (Must):** Video playback is streamed from a managed video host, works on desktop and mobile, supports resume from last position, and prevents easy download.
- **FR-TRN-03 (Must):** A module counts as complete only when the user has watched at least a configurable share (default 90%) of the video; skipping ahead does not count.
- **FR-TRN-04 (Must):** A test unlocks after all modules of a course are complete. Question types: single-choice, multiple-choice and true/false. Questions and options are shuffled per attempt, drawn from a larger question bank.
- **FR-TRN-05 (Must):** Per course, K7 configures pass mark (default 70%) and time limit.
- **FR-TRN-06 (Must):** Results show the score and, for a configurable setting, the correct answers after submission. Attempts and answers are stored.
- **FR-TRN-07 (Must):** On passing, the system generates an individual certificate (PDF) containing the participant's name, partner organisation, course or track, date, score band, unique certificate ID, and a QR code or URL for public verification.
- **FR-TRN-08 (Must):** Certificates are available for download in the user's profile at any time and are emailed on issue.
- **FR-TRN-09 (Must):** A public verification page confirms a certificate ID is genuine and shows name, organisation, course and issue date, without exposing other personal data.
- **FR-TRN-10 (Should):** Certificates carry an expiry (default 12 months, configurable) with reminders at 60 and 30 days and a recertification test.
- **FR-TRN-11 (Should):** A progress dashboard shows each user's modules, test status and certificates; the Partner Admin sees the same for all users in the organisation.

### 4.1 Training admin requirements

- **FR-TRN-12 (Must):** Training Admin can create, edit, reorder, publish and retire tracks, courses, modules and tests without a code release.
- **FR-TRN-13 (Must):** Training Admin can upload or link videos, attach documents, and manage question banks, including bulk upload via a template file.
- **FR-TRN-14 (Must):** Course versioning: publishing a new version keeps earlier certificates valid and shows which version each user completed.

## 5. Partner organisation certificate

When a partner organisation meets K7's training requirement, it receives an official K7 Partner Certificate. The requirement is rule-based and set by K7 per partner type.

- **FR-CRT-01 (Must):** K7 configures, per partner type, the minimum certifications required.
- **FR-CRT-02 (Must):** When the rule is first met, the system raises an issuance request to the Channel Manager.
- **FR-CRT-03 (Must):** The certificate is a PDF with K7 branding, partner legal name, partner type, partner ID, issue date, validity period, a unique certificate number, authorised K7 signatory (image signature) and a QR code linking to a public verification page.
- **FR-CRT-04 (Must):** The certificate is downloadable by the Partner Admin, emailed to the primary contact, and listed in the partner profile.
- **FR-CRT-05 (Must):** Validity is configurable (default 12 months). The partner status on the portal shows Certified, Expiring soon or Expired.
- **FR-CRT-06 (Should):** Renewal is triggered when individual certificates lapse; the partner gets reminders at 60 and 30 days before expiry.
- **FR-CRT-07 (Should):** K7 can revoke a certificate with a recorded reason. A revoked certificate shows as invalid on the verification page.

## 6. Marketing collaterals

Approved partners browse and download K7 brand and sales material from a searchable library managed by the K7 marketing team.

- **FR-MKT-01 (Must):** Collaterals are organised by product and within that by category (for example brochures, datasheets, presentations, case studies, videos, logos and brand guidelines, social media creatives, email templates).
- **FR-MKT-02 (Must):** Supported file types: PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, JPG/PNG, SVG, MP4 and ZIP, up to a configurable size limit (default 200 MB).
- **FR-MKT-03 (Must):** Visibility rules per collateral: by partner type, by partner tier or certification status, and by country or region.
- **FR-MKT-04 (Must):** Marketing Admin can upload, replace, version, tag, and retire items, with no developer involvement.

## 7. Deal registration

A partner registers an opportunity with an end customer; the K7 team approves it, and an approved deal is protected for a set period and created in Dynamics CRM.

### 7.1 Requirements

- **FR-DEAL-01 (Must):** Only active, certified partner users can register deals.
- **FR-DEAL-02 (Must):** Deal form fields: end-customer name, industry, city, contact name, designation, email and phone, product(s) and SKU, quantity, expected deal value, expected closure date, source of lead, competing vendor (optional), notes, and attachments (quote, RFP or purchase intent).
- **FR-DEAL-03 (Must):** Partner type determines routing: a Distributor can name the reseller the deal is for; a VAR or Integration Partner registers in its own name.
- **FR-DEAL-04 (Must):** On submission the system runs a conflict check against Dynamics CRM opportunities by customer name, domain and contact email. Matches are shown to the K7 approver; the partner is not told which other partner holds the match.
- **FR-DEAL-05 (Must):** The Deal Desk Approver can approve, reject with a reason, request more information, or approve with changes (for example a corrected value). Partners are notified by email and in-portal.
- **FR-DEAL-06 (Must):** On approval the deal gets a deal registration ID, a protection period (configurable, default 90 days) and is pushed to Dynamics CRM as an opportunity linked to the partner account.
- **FR-DEAL-07 (Must):** The partner can request an extension before protection ends; K7 approves or rejects it.
- **FR-DEAL-08 (Must):** Registered, approved, rejected and expired deals are visible in a list with filters (status, product, date, value).
- **FR-DEAL-09 (Should):** A deal can be edited before submission and after a clarification request. After approval, only K7 can change value or customer; the partner can add notes and attachments.

### 7.2 Deal registration statuses

| Status | Set by | Meaning |
|---|---|---|
| Submitted | Partner | Awaiting K7 review |
| Information requested | K7 | Partner must reply |
| Approved | K7 | Protected; pushed to CRM |
| Rejected | K7 | Not accepted, reason recorded |
| Extension requested | Partner | Awaiting K7 decision |
| Expired | System | Protection period ended without an extension |
| Withdrawn | Partner | Cancelled by the partner |

After approval, the deal's sales stage (won, lost, open) comes from Dynamics CRM, not from this table (section 8).

## 8. Deal status and value dashboard

A page where partners see the status and value of every deal they handle, read from Microsoft Dynamics CRM rather than re-keyed.

- **FR-DASH-01 (Must):** Summary cards: total deals, open deals, won deals, lost deals, total pipeline value, won value and win rate, for the selected period.
- **FR-DASH-02 (Must):** A deal list showing deal ID, customer, product, registered date, expected value, current CRM stage, status (open, won, lost, on hold), actual order value (where won), expected closure date and last updated time.
- **FR-DASH-03 (Must):** Data is limited to the logged-in partner's organisation.
- **FR-DASH-04 (Must):** The data source is Dynamics CRM through the integration layer. The portal never exposes CRM credentials to the browser.
- **FR-DASH-05 (Must):** Data freshness: a scheduled sync every 60 minutes (configurable) into a portal read-model. The page shows a Last updated timestamp.
- **FR-DASH-08 (Should):** Charts: pipeline by stage, value by month and value by product.
- **FR-DASH-10 (Should):** Deals created in CRM by K7 on the partner's behalf, not registered in the portal, appear if linked to the partner account.
- **FR-DASH-11 (Must):** Reconciliation rule: if the portal and CRM disagree on stage or value, CRM wins; changes are written to the audit log.

## 9. Schemes and eligibility

K7 publishes incentive schemes; partners browse them, register, and after the scheme ends check whether they qualified.

### 9.1 Scheme catalogue and registration

- **FR-SCH-01 (Must):** Scheme Admin can create a scheme with name, description, terms and conditions, start and end date, registration deadline, applicable partner types, regions and products, and an attachment (PDF).
- **FR-SCH-02 (Must):** Schemes are listed as Open for registration, Running and Closed. Partners see only schemes that apply to their type and region. Only registered partners are eligible to see the schemes.
- **FR-SCH-03 (Must):** A Partner Admin registers the organisation for a scheme after accepting its terms. Registration is stored with date and accepting user.
- **FR-SCH-04 (Must):** A scheme can require K7 approval of registrations, or allow auto-registration. This is a setting per scheme.
- **FR-SCH-05 (Should):** Running schemes show the partner's progress against each target as the numbers update from CRM, labelled provisional until the scheme closes.

### 9.2 Eligibility check

- **FR-ELG-01 (Must):** After a scheme closes, the eligibility status for each registered partner is computed from won deals in Dynamics CRM that fall inside the scheme rules and dates.
- **FR-ELG-02 (Must):** Scheme Admin reviews the computed results, can adjust with a recorded reason, and publishes them. Partners see results only after publication.
- **FR-ELG-03 (Must):** The partner's Check eligibility page shows status (Eligible, Not eligible, Under review), the achieved value against the target, the slab reached, the benefit amount or reward, and a breakdown of the deals counted.
- **FR-ELG-04 (Must):** If not eligible, the page shows the gap to the target.
- **FR-ELG-05 (Should):** A partner can raise a query or dispute on the result within a configurable window; Scheme Admin resolves it in the portal.
- **FR-ELG-06 (Should):** Payout status is tracked (Pending, Processed, Paid) with reference number, updated by Scheme Admin. Payment execution itself is out of scope.
- **FR-ELG-07 (Should):** Export of results for Finance, with all partner, scheme and benefit fields.

## 10. K7 admin back-office, notifications and reporting

### 10.1 Notifications

- **FR-NTF-01 (Must):** Email notifications for each event below, using templates K7 can edit, plus an in-portal notification bell.

| Event | Recipient |
|---|---|
| Application submitted, approved, rejected, clarification needed | Applicant; Channel Manager |
| Training course passed; certificate issued or expiring | Participant; Partner Admin |
| Partner certificate issued, expiring or revoked | Partner Admin |
| Deal submitted; decision made; protection ending | Approver; Partner user |
| Scheme published; registration decision; results published | Partner Admin |
| Approval SLA breached | Approver; their manager |


---

## Appendix (added 2026-10-22, not part of the source): what the document leaves open

The document stops after the notification table in §10.1. These are the gaps and ambiguities a
reader hits; each is either a question for the author or a decision recorded in `02-build-plan.md` §3.

1. **Missing sections.** §1 promises functional *and non-functional* requirements; none are given
   (availability, response time, data residency, retention, accessibility, browser support, audit
   retention, backup). §10 is titled "back-office, notifications and reporting" but only §10.1
   Notifications exists: no reporting requirements, no back-office requirements beyond those spread
   through §3–§9, no "Approval SLA" definition although FR-NTF-01 notifies on its breach.
2. **Numbering.** FR-DASH-06, 07 and 09 do not exist (the list jumps 05 → 08 → 10 → 11). Either
   requirements were deleted or the numbering is loose; treat the IDs as stable and do not renumber.
3. **Roles named in requirements but not in the role table (§2).** "Deal Desk Approver" (FR-DEAL-05)
   and "Scheme Admin" (FR-SCH-01, FR-ELG-02, 05, 06). §2 puts scheme creation and eligibility under
   Marketing Admin and deal review under Channel Manager. Assumed: Deal Desk Approver = Channel
   Manager, Scheme Admin = Marketing Admin, both as separate role flags so they can be split later.
4. **Partner types.** The document has Distributor, Integration Partner and VAR. The CRM's account
   type has Partner / Distributor / MSP (and the sub-type Partner), and the website's Partners page
   lists Value Added Resellers and MSPs ("Integration Partners" is the heading over the MSP list).
   Whether MSP is a fourth type, or is what the document calls Integration Partner, needs the author.
5. **Tiers.** FR-MKT-03 filters collateral "by partner tier or certification status"; no tier is
   defined anywhere. Assumed: no tiers at launch, certification status only.
6. **GSTIN and PAN.** FR-REG-07 re-approves edits to GSTIN and PAN, but FR-REG-02 does not collect
   them. Assumed: both are optional registration fields (India only).
7. **"Certified" in FR-DEAL-01.** Only "active, certified partner users" may register deals. Unclear
   whether the *user* needs an individual certificate (§4) or the *organisation* the partner
   certificate (§5), and what a newly approved partner does before anyone is certified. Assumed:
   the organisation must hold a valid partner certificate (§5); the Channel Manager can waive it per
   organisation for a set period.
8. **FR-ROLE-02** ("A partner user/technical user/sales user can be the same user") is read as: one
   user may hold several partner roles at once.
9. **FR-SCH-02** last sentence ("Only registered partners are eligible to see the schemes") is read
   as: only approved partner organisations see schemes at all; registration *for a scheme* is
   FR-SCH-03.
10. **Mobile OTP (FR-REG-03)** needs an SMS gateway; none exists in the stack. Email codes exist
    (the support portal's one-time-code door). Decision in the plan.
11. **Dynamics CRM facts the document assumes** and that are not yet confirmed (the support portal
    discovery covered the support tables only): that sales keeps opportunities in Dynamics with
    stage, estimated and actual value and close date; which fields link an opportunity to the
    partner account; whether the portal may add columns (deal registration ID, protection end) or
    must map onto existing ones (`07-production-safety.md` §2 forbids schema changes without the
    CRM admin). **Explored on UAT 2026-10-22: `03-dynamics-exploration.md`** (opportunities exist with
    stage, values and close dates; the partner is `alletec_partnername`; no new columns needed;
    production volumes still to be counted).
12. **Video host (FR-TRN-02)**, **file storage for 200 MB collateral (FR-MKT-02)** and **certificate
    signatory image (FR-CRT-03)** are supplier and asset decisions, not requirements; listed in the
    plan's decisions.
13. **Extension requests (FR-DEAL-07)**: no limit on how many, or how long. Assumed: one extension of
    the same length as the protection period, configurable.
14. **Deals registered by a Distributor for a reseller (FR-DEAL-03)**: whether the named reseller
    must itself be a registered partner, and whether it sees the deal. Assumed: free-text reseller
    name at launch, optionally linked to a partner organisation when one matches; the reseller does
    not see the deal.
15. **Scheme targets** (FR-ELG-03 "slab reached", "benefit amount") imply a slab table per scheme
    (target value → benefit) that FR-SCH-01's field list does not include. Assumed: a scheme carries
    an ordered list of slabs (threshold value, benefit text, benefit amount), optionally per product
    or region.
