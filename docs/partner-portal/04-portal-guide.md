# The partner portal as built (M1–M2, 2026-10-22): routes, doors, rules, how to run it

What exists in the repo after the skeleton (M1) and onboarding (M2) milestones, how it fits the support portal it stands on, and
what to check before trusting a page. `02-build-plan.md` is the plan and the cross-session state; this file is "what is built",
like the support portal's `09-portal-guide.md`. Dynamics is touched by one job so far: the partner account and its contact on
approval, through the outbox (§5), only when the mirror is switched on; the opportunity arrives with M4.

## 1. Run it
```
docker compose up -d                                   # Postgres for Payload (the portal's system of record)
pnpm dev                                               # site + admin + both portals on :3000
pnpm partner:seed-dev you@example.com "Your Name"      # once: the PP-TEST organisation (K7P-00000) and you as its Partner Admin
```
`.env` needs the support portal's keys (`AUTH_SECRET`, Postgres, and for the K7 door the Entra app or `SUPPORT_DEV_AGENT=probe`)
plus `PARTNER_PORTAL_ENABLED` (on in development unless `0`; production needs `1`, or every `/partners/portal` page is a 404).
`SUPPORT_DEV_SHOW_CODE=1` shows the partner's one-time code on the verify page while no `SMTP_URL` is set, under the same
localhost-or-allowlist rule as the support door. `SUPPORT_MAIL_ALLOWLIST` applies to partner codes and notifications too.

Then open http://localhost:3000/partners/join (apply), http://localhost:3000/partners/portal (partner users) or
http://localhost:3000/partners/portal/sign-in?staff=1 (K7 staff). A K7 person opens the queues only when listed as Channel Manager
in the settings (`/admin/globals/partner-settings` → Staff the first time; then `/partners/portal/k7/settings`), or through the probe
door with `devStaffPass` on. `PARTNER_SMS_PROVIDER` is empty by default: the join step records the mobile and marks its verification
skipped. Tests: `pnpm test:int` runs `partner-session` (scope, roles, settings, the code doors) and `partner-registration` (the
application machine, validation, the CRM mapping) without a tenant; with `PARTNER_DB_TESTS=1` also `partner-notify` and
`partner-onboarding` (draft → approved against Postgres, rows removed again).

## 2. Sign-in: one Auth.js instance, a third kind of session (`src/auth.ts`)
| door | who | how | session |
|---|---|---|---|
| `partner` | partner users | the support portal's signed one-time code (`src/lib/support/otp.ts`) with the purpose `partner-sign-in` and its own cookie (`k7-partner-otp`, path `/partners`, `src/lib/partner/otp.ts`); the code goes to the email of an existing `partner-users` row whose organisation is approved and who is not disabled; the first sign-in activates an invited user | `kind: 'partner'`, `partnerUserId`, `orgId`, `roles[]` |
| `microsoft-entra-id` / `dev-agent` | K7 staff | the support portal's doors unchanged; the partner-portal roles are **not** Dataverse roles but the `staff` list of the Payload global `partner-settings` (work email → roles), so a Marketing Admin needs no CRM access | `kind: 'agent'`; roles resolved per request by `staffRolesFor` |

A code's purpose is inside the signed payload, so a partner code never opens the customer door or the reverse (pinned by the
test). One cookie carries one session: signing in on one side ends the other side's session. The two sides ignore each
other's sessions rather than looping: `/support` treats a partner session as signed out (`proxy.ts`, `requireCustomer`,
`optionalSession`, the support header), `/partners/portal` sends a customer session to the partner door and an agent session to
the K7 side.

`src/proxy.ts` (Next 16's proxy, Node runtime) gates `/partners/portal/k7/*` to an agent session and the rest of
`/partners/portal/*` to a partner session; `sign-in` and `verify` are public. The role check needs Payload and happens in the
page (`requireK7Role`). The `partner` provider loads its Payload lookup lazily so the proxy's bundle does not carry the config.

## 3. Routes (`src/app/(partner)/`, own root layout: site chrome, noindex, `force-dynamic`, `portal.css` + `partner.css`)
```
/partners/join                       public (M2): step 1, the partner type; a draft row is created and its resume key set in an httpOnly cookie on /partners/join
/partners/join/company · /verify · /terms   steps 2–4: company, contact and regions → the code to the contact email (and SMS when a gateway exists) → the summary, the terms (version + time stored), Submit
/partners/join/submitted             the receipt with the number (K7A-00001)
/partners/join/status?a=&k=          the applicant's view from the emailed link: state, K7's note, the record; "Edit and resubmit" after a clarification reopens the steps
/partners/portal                     partner home: the status strip (type, status, roles, certificate), latest notifications, the organisation's facts and recent record
/partners/portal/notifications       the bell's page, mark all as read
/partners/portal/no-access           a partner user without the role a page needs
/partners/portal/sign-in · /verify   the partner door and the K7 door on one page; `?staff=1` leads with the K7 side
/partners/portal/k7                  the K7 desk: who you are, the roles you hold and what each opens, the settings summary
/partners/portal/k7/notifications    the staff bell (rows sent to the roles you hold, shared by every holder)
/partners/portal/k7/no-access        an agent without a partner-portal role
/partners/portal/k7/applications     Channel Managers (M2): counters, views (open · new · under review · awaiting partner · decided · all), search, "assigned to me", the ledger; Run the waiting CRM jobs
/partners/portal/k7/applications/[number]   the application sheet: the filed facts, Take it, the decision panel (approve · send back · reject, with the note), the record, the organisation and its CRM job (Run / Retry)
/partners/portal/k7/settings         Channel Managers: the whole `partner-settings` global as a form (staff and roles, programme, deals, CRM mirror, notifications)
/api/partners/outbox                 POST with `Authorization: Bearer <CRON_SECRET>`: runs the pending, failed and skipped CRM jobs as the service identity
```
The desk strip (`K7Nav`) shows a tab only to a role that opens it. Everything the plan lists for later milestones (organisation
and users, deals, dashboard, collateral, schemes, reports) is not there yet.

## 4. Library (`src/lib/partner/`)
| file | what |
|---|---|
| `session.ts` | `requirePartner(next?)` → `PartnerContext { user, org, scope, roles, actor }`, re-reading the user and organisation from Payload on every request so a suspension or role change bites at once; `requirePartnerRole(roles)`; `requireK7(next?)` / `requireK7Role(roles)` → `K7Context { email, name, roles, dev, actor }`; `tryPartner`, `tryK7`, `partnerSideSession` for the header (never redirect) |
| `scope.ts` | `orgWhere(scope, extra?, field)` puts the organisation into every Payload `Where` first and throws `ScopeError` on an empty scope; `inScope(scope, row)` for detail pages reached by id. **Rule:** every partner query takes `me.scope`; a review checklist item (FR-ROLE-01) |
| `settings-model.ts` / `settings.ts` | the typed settings with defaults and the normaliser; `getPartnerSettings()` (30 s memo), `savePartnerSettings()`, `partnerPortalEnabled()`; `staffRolesFor(email, settings, { dev })` with the two default-on fallbacks (Channel Manager → Deal Desk Approver, Marketing Admin → Scheme Admin); `staffWithRole(role)` for notifications, each person once |
| `users.ts` | `findPartnerUserByEmail`, `loadPartnerUser`, `canSignIn(user, org)`, `touchSignIn`, `orgUsers(orgId, roles?)` |
| `audit.ts` | `audit({ actor, object, objectId, objectLabel, action, from, to, orgId, comment, meta })` → one `partner-audit` row, failures logged not thrown; `orgAudit(scope)`, `objectAudit(object, id)` |
| `notify.ts` | `notify({ event, subject, body, href, to, email? })` with recipients `user`, `org` (its active users, optionally by role) or `staff` (a role): one bell row per partner user, one shared row per staff role, and an email per address when `partner-settings.notify.emailEnabled` (through `sendMail`: `SMTP_URL`, allowlist, the partner sender from the settings); `unreadCount`, `listNotifications`, `markAllRead` over a `BellScope` |
| `otp.ts` | the partner door's purpose and cookie names over the support primitives |
| `status.ts` | (M2) the application machine of 01-requirements §3.2 plus `draft` (`canMoveApplication`, `decisionPath`: a decision on a Submitted application assigns it first), the decisions and their labels, the organisation toggle; pure |
| `ids.ts` | (M2) `nextId('partner' \| 'application' \| 'deal')` → `K7P-00001` … from `partner-counters` by compare-and-swap; the unique index on the target column is the last line |
| `registration-model.ts` | (M2) the application type, the size and turnover bands on the CRM's option values, `yearsInBusinessBand`, `validateCompany` / `validateContact` / `validateRegions` / `readyToSubmit`, `accountBody` and `contactBody` (03-dynamics-exploration.md §6); pure |
| `registration.ts` | (M2) `createDraft`, `loadByKey`, `findByNumber`, `saveDetails` (a changed email needs verifying again), `markVerified`, `submitApplication` (number, terms, staff notification, applicant mail with the status link), `listApplications` / `applicationCounts`, `assignApplication`, `decideApplication`, `approveApplication` (organisation with the next partner ID, the primary contact as invited Partner Admin, the invitation through `notify`, the `account.create` job). Every move: one audit row, one applicant mail |
| `mirror.ts` | (M2) the outbox: `enqueueOutbox` (runs at once when `crm.enabled`), `runJob` (`account.create`: region, state, city and country looked up by name, the account (its id stored on the organisation at once, so a retry resumes rather than duplicates), the contact parented and set as primary, `alletec_accountid` read back, an audit row), `drainOutbox`, `outboxOf`, `owedOutboxCount`. The production guard and the writes switch give `skipped`; other failures `failed` with a code |
| `sms.ts` | (M2) the mobile-code adapter: `PARTNER_SMS_PROVIDER` empty = none (verification `skipped`), `console` in development; a gateway is one more case |
| `join.ts` | (M2) the join cookie names and `currentDraft()` |

## 5. Data (Payload, `src/collections/partner/`, admin group "Partner portal")
| collection / global | holds | notes |
|---|---|---|
| `partner-orgs` | approved organisations: `partnerId` (unique), type, status approved/suspended, legal fields, regions, `crm.{accountId, accountCode, contactId}`, `certificate`, `waiverUntil`, `pendingLegalEdit` | created by approval (M2); `partner:seed-dev` creates the PP-TEST one |
| `partner-users` | one person in one organisation: email (unique, lowercased), roles admin/sales/technical (several at once), status invited/active/disabled, `lastSignInAt` | the door's lookup |
| `partner-audit` | the trail: actor, object, objectId, label, action, from → to, orgId, comment, meta | append-only; admin read |
| `partner-notifications` | the bell: audience user (userId, orgId) or staff (staffRole), event, subject, body, href, readAt, emailedAt / emailTo / emailError | append-only except `readAt` |
| `partner-applications` | (M2) one per application: number, type, status (draft · submitted · underReview · clarification · approved · rejected), the company fields, `contact` (with `emailVerifiedAt`, `mobileVerifiedAt`, `mobileVerification` none/sms/skipped), regions, `terms` (version, acceptedAt), `assignee`, `decisions[]` (to, by, at, comment), `resumeKey` (never shown), `orgId`, submittedAt, decidedAt | written by `registration.ts` |
| `partner-outbox` | (M2) the CRM jobs: kind (`account.create`; `opportunity.create` in M4), state pending/done/failed/skipped, attempts, orgId, object/objectId/objectLabel, `payload` (the approver, the owner rule at the time), `result` (the ids), lastError (a code), doneAt | written by `mirror.ts` |
| `partner-counters` | (M2) one row per identifier kind with the last number given | advanced by `ids.ts` |
| global `partner-settings` | Staff (email → roles, the two fallback flags, `devStaffPass`), Programme (types, regions, terms version and URL), Deals (protection 90, extension 90, approval SLA 48 h, `requireCertificate` off, `conflictCheckCrm` off), CRM mirror (off; owner rule, enquiry source 1, product category 36, name pattern), Notifications (email on, sender, retention) | edited in `/admin` until the K7 settings page (M2) |

## 6. Design system: section 10 · Partners
`design-system/components/PartnerParts/README.md` and `src/app/(partner)/partner.css`, loaded over section 09's `portal.css`
(chrome, forms, flashes, ledgers are shared). Parts P1–P6: the partner ID, the organisation state and type tags, the status
strip, the bell and its rows, role tags, the partner home. The header is the support portal's `HeaderShell` with `home` and
`name` props. M2 adds P7 the join steps, P8 the application state tag (and the mobile verification tag), P9 the application summary and P10 the decision panel, with the terms box, the desk strip's count and the settings page's staff table. No partner artboards yet.

## 7. Rules the code enforces
- A partner page reads nothing without `me.scope` (`orgWhere`); an empty scope throws rather than widening.
- Roles and status are re-read from Payload per request; the JWT's copy is a hint for the proxy only.
- K7 roles come from `partner-settings`, never from Dynamics; development sign-ins hold every role unless `devStaffPass` is off, never in production.
- Mail leaves only through `sendMail`: `SMTP_URL`, `SUPPORT_MAIL_ALLOWLIST`, the partner sender. No SMTP: the console, and the on-screen code on localhost or with the allowlist set.
- An application moves only along 01-requirements §3.2 (`status.ts`); every move writes an audit row and emails the applicant; a rejection or a clarification needs a note.
- An application is submitted only with the contact email verified by code; the mobile is verified by SMS when a gateway exists and otherwise marked skipped where the Channel Manager sees it.
- The status link is number + an unguessable key; a wrong key shows nothing. The join cookie carries the same key, httpOnly, scoped to `/partners/join`.
- Approval refuses an email that is already a partner user somewhere; the organisation and the Partner Admin are created together, the partner ID from the counter.
- Dataverse is written only by the outbox, as the service identity, only when `partner-settings.crm.enabled` is on, only to UAT (production refused in code); the job is recorded whatever happens and can be re-run.

## 8. Not done (next: M3)
The organisation page, users and roles for the Partner Admin, legal-identity edits with re-approval, suspension (M3); the marketing
Partners page and its "Join" link (the page is not written; the link is in the header seed, on the sign-in page and in the portal
footer); the editable mail templates and the approval SLA notice (M8); an SMS gateway. Both sides were clicked end to end on
localhost on 2026-10-22 (K7A-00003 → K7P-00003, account ACC-2610-00154 with its contact on UAT). Not clicked: the invited Partner
Admin's first sign-in through the partner door (verified in M1 with the seeded user).
