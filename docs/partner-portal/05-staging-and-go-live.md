# Partner portal: staging, operations and the go-live gate (M9, written 2026-10-23)

What a host must provide to run the partner portal, how it is watched, how it is backed up, and the order in which its
CRM features are switched on in production. `04-portal-guide.md` is what is built; `02-build-plan.md` §11 the non-functional
requirements this file carries out; `docs/support-portal/07-production-safety.md` the CRM rules both portals obey. Hosting
is still undecided (`CLAUDE.md`), so this file says what the host must give, not which host.

## 1. What the host must provide
| need | why | where it is read |
|---|---|---|
| Postgres 17 reachable at `DATABASE_URL`, nightly backup (§6) | the system of record (decision 2) | Payload |
| a persistent `uploads/` directory (or `PARTNER_UPLOAD_DIR` and the two fixed ones) that survives deploys and is writable by the app | collateral, deal files, scheme PDFs are files on disk served through routes; object storage is a later adapter, not needed for launch 1 | `src/collections/partner/PartnerCollateralFiles.ts`, `src/lib/partner/deal-files.ts`, `src/lib/partner/schemes.ts` |
| `SMTP_URL` and a sender the mail provider lets `partners@k7computing.com` use | every sign-in is a code by email; every notification leaves by mail | `src/lib/support/mail.ts` |
| a secret store for `AUTH_SECRET` (32+ characters), `CRON_SECRET` (16+), `DATAVERSE_CLIENT_SECRET`, `SMTP_URL` | nothing secret in the repository | `.env.example` lists every key |
| a scheduler that can POST with a bearer header (§3) | the outbox, the read-back, the sweeps, the digest, housekeeping | `src/app/api/partners/*` |
| TLS at the edge with `Strict-Transport-Security` | the app sets the other headers itself (§4) | `next.config.ts` |
| one monitor on `GET /api/partners/health` (§4) | the portal says itself when it is not ready | `src/lib/partner/ops.ts` |
| the Entra app registration for the host's URL (`docs/support-portal/06-entra-setup.md`) | K7 staff sign in with Microsoft | `src/auth.ts` |
| a Dataverse application user on UAT, later production (`07-production-safety.md` §2) | the outbox and the read-back run as the service identity | `src/lib/dataverse/auth.ts` |

Staging is the same deployable as the support portal on the same host: one Next.js process, one Postgres, one `uploads/`
tree. The partner portal is on when `PARTNER_PORTAL_ENABLED=1`; without it every `/partners/portal` page is a 404 in
production, which is also the kill switch.

## 2. Environment per stage
| key | development | staging | production |
|---|---|---|---|
| `PARTNER_PORTAL_ENABLED` | on by default | `1` | `1` |
| `AUTH_SECRET`, `CRON_SECRET` | local throwaways | from the store | from the store |
| `SMTP_URL` | empty (console; codes on screen on localhost) | set | set |
| `SUPPORT_MAIL_ALLOWLIST` | empty | **set** (`@k7computing.com` and the test partners' addresses) | empty |
| `SUPPORT_DEV_AGENT`, `SUPPORT_DEV_SERVICE`, `SUPPORT_DEV_SHOW_CODE` | `probe` / implied / `1` | **unset** | **unset** |
| `DATAVERSE_URL` | `k7crmuat` | `k7crmuat` | `k7crm` (read-only in code) until the gate's last step |
| `DATAVERSE_CLIENT_ID` / `_SECRET` | optional (the probe token stands in) | the UAT application user | the production application user |
| `DATAVERSE_WRITES_ENABLED` | `1` | `1` | `1` only after the gate (§5) |
| `PARTNER_SMS_PROVIDER` | empty | empty | empty until a gateway exists |
| `PARTNER_UPLOAD_DIR` | `uploads/collateral` | a persistent path | a persistent path |
| `BACKUP_DIR`, `BACKUP_KEEP_DAYS` | unused | a path off the app disk, 30 | a path off the app disk, 30 |

The Operations page (§4) reads the same keys and says which line is wrong for the stage it runs in.

## 3. The scheduler
Every job is a POST with `Authorization: Bearer <CRON_SECRET>`; the guard (`src/lib/cron-auth.ts`) compares in constant
time and refuses an unset or short secret, so a host that forgot the secret runs nothing rather than running for anyone.
Each run writes a `partner-job-runs` row; the Operations page lists the newest per job and calls a job overdue after twice
its cadence (two hours at least).

| job | route | every | what |
|---|---|---|---|
| CRM outbox drain | `/api/partners/outbox` | 15 min | the pending, failed and skipped CRM jobs, when the mirror and the job's feature are on |
| CRM read-back | `/api/partners/sync` | 60 min | the portal's own opportunities, at most every `crm.syncMinutes` unless `{"force":true}` |
| Approval SLA pass | `/api/partners/sla/sweep` | 60 min | one breach notice per clock to the approvers, the managers, the escalation addresses |
| Deal sweep | `/api/partners/deals/sweep` | daily | expires approved deals past protection; the ending notice once |
| Daily digest | `/api/partners/notifications/digest` | daily | the digest mails; read bell rows past `notify.bellRetentionDays` removed |
| Scheme eligibility | `/api/partners/schemes/run` | daily | results of published schemes that have closed |
| Certificate sweep | `/api/partners/certificates/sweep` | daily | expires certificates past their date, the 60- and 30-day reminders once each, certificates for passes that predate them, the organisations' certificate mirror, the renewal request where the rule holds |
| Housekeeping | `/api/partners/housekeeping` | daily | join drafts untouched for 30 days and job-run rows older than 90 days removed |

```
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/partners/outbox
```
Any job can also be run by hand from the desk (the outbox and sync on the applications and deals pages, the SLA pass on
the reports page, the eligibility run on the schemes page, the digest on the templates page, the certificate sweep on the certificates desk, housekeeping on Operations);
those runs are recorded too, with the person's address. The limits that live in memory (one-time-code attempts, the
per-address and per-client send windows) are per process: on more than one instance they are per instance until a shared
store replaces the maps (`src/lib/support/otp.ts`).

## 4. Watching it
- **`/partners/portal/k7/operations`** (Channel Manager): the readiness ledger (the environment, the settings, the upload
  directories; *Fails* stops the portal or a feature, *Note* is right for one stage and wrong for another), the scheduled jobs
  with their newest run and standing, the recent runs. Read it after every deploy and whenever the bell goes quiet.
- **`GET /api/partners/health`**: `200 {"ok":true}` when the database answers and no check fails, else `503` with the failing
  checks by key and nothing else. Point the host's monitor at it; it needs no secret and gives none.
- **Headers** on `/partners/*`: `X-Frame-Options: SAMEORIGIN` (the site may frame its own pages, nobody else may), `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` without camera, microphone, location or payment; the API routes
  `no-store`. `Strict-Transport-Security` is the edge's. `/support` can take the same block when it is hardened.
- **The doors**: five wrong codes kill a token; five codes per address and thirty per client address per fifteen minutes
  (the client is the first `x-forwarded-for` hop, so the host's proxy must set it); a code's purpose is inside its signature.
  The sign-in door tells an unknown address that it is unknown (04 §2); accepted, since the join page tells the same.
- **Tests** that stand guard: `tests/int/partner-routes.int.spec.ts` reads every route and action under the portal and fails
  when one is added without its door; `partner-m9` holds the status machines as full matrices, the scope rule's corners, the
  cron guard, the limiter, the feature switches and the readiness checks; `partner-m9-db` the switches against Postgres.

## 5. The go-live gate (after `07-production-safety.md` §7)
The CRM mirror has a master switch (`crm.enabled`) and three feature switches under it (`crm.features`): the partner account
on approval, the end customer and opportunity on deal approval, the dashboard read-back. A job whose feature is off waits as
pending, no attempt counted, and runs when the switch turns; the read-back refuses, forced or not. All four are on the K7
settings page and in `/admin/globals/partner-settings`.
1. **Staging on UAT, everything on.** The portal clicked end to end on both sides by the channel team with the allowlist
   set; the Operations page shows every job running and no check failing.
2. **Production, read-only.** `DATAVERSE_URL` → `k7crm`, the production application user, `DATAVERSE_WRITES_ENABLED` unset,
   `crm.enabled` **off**. The portal runs for a week without the CRM: applications, organisations, users, collateral, schemes
   and deals all work (the CRM-facing lines show "queued"). Error budget: zero `5xx` from the portal's routes.
3. **Read-back on.** `crm.enabled` on, only `sync` on. Register one `PP-TEST` deal whose opportunity the CRM admin created
   by hand, paste its id, watch the dashboard read it. The client still refuses production writes in code, so nothing can be
   written by accident at this step.
4. **Account on.** `DATAVERSE_WRITES_ENABLED=1` and the production guard's exception for the partner jobs (a decision for
   the CRM admin and the support lead, recorded in `07-production-safety.md`; not taken in code yet), then `accountCreate` on.
   Approve one test application; the account and contact land; the outbox row says `done`.
5. **Opportunity on.** `opportunityCreate` on; approve one test deal; the end customer, its contact and the opportunity land.
6. **Rollback** is the switch: off, jobs wait; `PARTNER_PORTAL_ENABLED=0` takes the whole portal off. Nothing to undo in the
   CRM because the portal writes the same records sales would.

## 6. Backup and restore
`scripts/backup.sh` (also `pnpm backup`) writes one dated folder under `BACKUP_DIR`: `db.dump` (`pg_dump --format=custom`
of `DATABASE_URL`), `uploads.tar.gz` (the upload tree) and `SHA256SUMS`, and prunes folders older than `BACKUP_KEEP_DAYS`
(30). Run it nightly from the host's scheduler with a `pg_dump` of the server's major (17) on the path, or
`BACKUP_PG_DUMP` pointing at one. `scripts/restore.sh <folder> <target DATABASE_URL> [uploads dir]` checks the sums,
restores with `--clean --if-exists` into the target database (make it first; never the live one while the app runs) and
unpacks the files beside the folder unless told where. **Rehearsed 2026-10-23** against the development Postgres: dumped
(6.2 MB), restored into a scratch database, the row counts of five tables equal, the upload tree back, the scratch database
dropped. Do the same once on staging before launch 1 (non-functional requirement 9) and record the date here.

## 7. Not done, by decision
Object storage (a persistent disk is enough for launch 1; the three directories are the only places files live); the SMS
gateway; a shared store for the in-memory limits (one instance at launch); the production guard's exception for the
partner jobs (step 4 of the gate, a decision to record, not code to write); the same headers and limiter on `/support`.
