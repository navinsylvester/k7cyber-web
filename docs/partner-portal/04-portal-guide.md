# The partner portal as built (M1, 2026-10-22): routes, doors, rules, how to run it

What exists in the repo after the skeleton milestone, how it fits the support portal it stands on, and what to check before
trusting a page. `02-build-plan.md` is the plan and the cross-session state; this file is "what is built", like the support
portal's `09-portal-guide.md`. Nothing here touches Dynamics yet: the CRM mirror arrives with M2 (account) and M4 (opportunity).

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

Then open http://localhost:3000/partners/portal (partner users) or http://localhost:3000/partners/portal/sign-in?staff=1
(K7 staff). Tests: `pnpm test:int` runs `tests/int/partner-session.int.spec.ts` (the organisation scope, the K7 role
resolution, the settings normaliser, the two code doors) without a tenant.

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
/partners/portal                     partner home: the status strip (type, status, roles, certificate), latest notifications, the organisation's facts and recent record
/partners/portal/notifications       the bell's page, mark all as read
/partners/portal/no-access           a partner user without the role a page needs
/partners/portal/sign-in · /verify   the partner door and the K7 door on one page; `?staff=1` leads with the K7 side
/partners/portal/k7                  the K7 desk: who you are, the roles you hold and what each opens, the settings summary
/partners/portal/k7/notifications    the staff bell (rows sent to the roles you hold, shared by every holder)
/partners/portal/k7/no-access        an agent without a partner-portal role
```
Everything the plan lists for later milestones (join, organisation, deals, dashboard, collateral, schemes, the K7 queues) is
not there yet; the nav shows only what exists.

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

## 5. Data (Payload, `src/collections/partner/`, admin group "Partner portal")
| collection / global | holds | notes |
|---|---|---|
| `partner-orgs` | approved organisations: `partnerId` (unique), type, status approved/suspended, legal fields, regions, `crm.{accountId, accountCode, contactId}`, `certificate`, `waiverUntil`, `pendingLegalEdit` | created by approval (M2); `partner:seed-dev` creates the PP-TEST one |
| `partner-users` | one person in one organisation: email (unique, lowercased), roles admin/sales/technical (several at once), status invited/active/disabled, `lastSignInAt` | the door's lookup |
| `partner-audit` | the trail: actor, object, objectId, label, action, from → to, orgId, comment, meta | append-only; admin read |
| `partner-notifications` | the bell: audience user (userId, orgId) or staff (staffRole), event, subject, body, href, readAt, emailedAt / emailTo / emailError | append-only except `readAt` |
| global `partner-settings` | Staff (email → roles, the two fallback flags, `devStaffPass`), Programme (types, regions, terms version and URL), Deals (protection 90, extension 90, approval SLA 48 h, `requireCertificate` off, `conflictCheckCrm` off), CRM mirror (off; owner rule, enquiry source 1, product category 36, name pattern), Notifications (email on, sender, retention) | edited in `/admin` until the K7 settings page (M2) |

## 6. Design system: section 10 · Partners
`design-system/components/PartnerParts/README.md` and `src/app/(partner)/partner.css`, loaded over section 09's `portal.css`
(chrome, forms, flashes, ledgers are shared). Parts P1–P6: the partner ID, the organisation state and type tags, the status
strip, the bell and its rows, role tags, the partner home. The header is the support portal's `HeaderShell` with `home` and
`name` props. No partner artboards yet.

## 7. Rules the code enforces
- A partner page reads nothing without `me.scope` (`orgWhere`); an empty scope throws rather than widening.
- Roles and status are re-read from Payload per request; the JWT's copy is a hint for the proxy only.
- K7 roles come from `partner-settings`, never from Dynamics; development sign-ins hold every role unless `devStaffPass` is off, never in production.
- Mail leaves only through `sendMail`: `SMTP_URL`, `SUPPORT_MAIL_ALLOWLIST`, the partner sender. No SMTP: the console, and the on-screen code on localhost or with the allowlist set.
- Nothing is written to Dataverse by this milestone.

## 8. Not done (next: M2)
The join flow, applications and their status machine, the approval that creates organisations and users, the CRM account
outbox, the K7 queues and settings page, the SMS adapter, the editable mail templates (M8). The partner door was verified on
localhost with the seeded user; the Microsoft door for the K7 side reuses the one verified for support on 2026-10-15.
