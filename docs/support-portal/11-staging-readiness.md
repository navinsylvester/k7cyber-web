# Staging readiness: what is left before support staff can test the portal on GCP

Written 2026-10-15 from the state in `09-portal-guide.md`, the safety rules in `07-production-safety.md` and the
tree on that day. Purpose: the work list for a **staging deployment on GCP against UAT**, used by support staff
side by side with the production Dynamics desk. Tick items off here; the guide stays the description of what is built.

## 0. Where the build stands on 2026-10-15
- Built and verified on UAT: the agent workspace, customer self-service with one-time codes, the manager view, CSAT and
  the unhappy-customers view, the product desk phase A with the CRM mirror rows (`09-portal-guide.md` §3–§4f).
- `pnpm build` passes (every portal route is dynamic, the marketing `[slug]` pages prerender), `npx tsc --noEmit` is clean,
  `pnpm test:int` is 71 passed and 1 skipped (the UAT write test, which needs the probe token).
- Product desk phase A (37 files) is **uncommitted** on `support-portal/planning`.
- The production guard means a staging deployment can never write to `k7crm` even if misconfigured (`07` §1b).

What keeps testers out is not the features: it is identity, mail and hosting plumbing, plus a few code changes a hosted
build needs. The items below are grouped by who unblocks them. Sizes are rough and only on code items.

## 1. Blockers outside the code
| # | item | who | notes |
|---|---|---|---|
| 1 | ~~Entra admin consent for the agent app~~ **done 2026-10-15**: Navin signed in through the Microsoft door and got a working delegated Dataverse token (consent exists; user consent or an admin grant, not established) | Navin (owner) | Left: add the staging redirect URI `https://<staging host>/api/auth/callback/microsoft-entra-id`, register the Graph OIDC scopes if a tester's first sign-in prompts for them, and set *assignment required* with a testers group (`06-entra-setup.md` §A step 7). |
| 2 | **Service app registration and its application user in UAT** | Navin creates the registration (`06` §B); the CRM admin adds the application user | Customer registration and sign-in, My cases, the sweep endpoint and the CSAT pass all run as `{ kind: 'service' }`. In development that falls back to the probe token; a production build has no fallback. System Customizer for the smoke test, then the *Portal API* role from `07` §4. |
| 3 | **An SMTP relay** (`SMTP_URL`) | Navin with IT | One-time codes are the only way a customer gets in and they leave only through SMTP; a production build does not even log them. Also survey invitations, low-score and prevention mails, product desk mails. Microsoft 365 SMTP AUTH on a support mailbox, or a transactional sender. Switch it on only after item 11. |
| 4 | **UAT capacity deadline** | the licence owner | Tenant over its Dataverse entitlement (47.5 GB entitled, 49.2 GB used on 2026-10-12). Microsoft's storage validation rolls out 2026-11-09 to 2026-12-04 and puts non-PAYG sandboxes into administration mode 30 days after it starts, UAT included. Buy capacity, link UAT to pay-as-you-go, or request the 45-day extension before the window. |
| 5 | **Agree the window with the CRM admin** | Navin | UAT is shared with Kathiresan M (solution staging, reporting). The re-seed, the tester roles and the application user land in their environment (`07` §1c). |
| 6 | **Commit the product desk** | Navin runs the push and PR (`!` prefix) | Commit phase A, PR `support-portal/planning` → `main`, merge with a merge commit, keep the branch. |

## 2. Code changes before the first deploy
| # | item | size | notes |
|---|---|---|---|
| 7 | **Standalone output and a `.dockerignore`** | ½ day | The template `Dockerfile` expects `output: 'standalone'`, which `next.config.ts` does not set. There is no `.dockerignore`: the context would carry `node_modules`, 1.6 GB of `public/media`, `uploads/`, `.env` and `scripts/.token_cache.json`. Run the image locally once. |
| 8 | **A database the build can reach** | decision + ½ day | `src/app/(frontend)/[slug]/page.tsx` prerenders through `generateStaticParams`, so `next build` queries Postgres. Options: Cloud Build with the Cloud SQL proxy; build on the dev machine against the local database and push the image; or make those pages dynamic on staging. First deploy: build locally and push. |
| 9 | **Payload migrations** | 2–3 h | No `src/migrations`. Local dev uses push mode, which runs only under `next dev`. Generate the first migration (ten support collections, two globals, the site's collections) and run `payload migrate` at container start or as a deploy step. |
| 10 | **Durable file storage** | ½ day | `Media` (`public/media`), `ReportFiles` (`uploads/reports`) and `ProductEvidence` (`uploads/product`) write to local disk; Cloud Run's disk is ephemeral, so a tester's evidence file vanishes at the next restart. Add the Payload GCS storage adapter for those three collections, enabled only when a bucket name is set so local stays local. **First cloud-specific dependency in the repo** (against the "nothing cloud-specific" decision in `CLAUDE.md`): needs Navin's okay. |
| 11 | ~~A mail allowlist for staging~~ **done 2026-10-15** | — | `SUPPORT_MAIL_ALLOWLIST` (addresses and `@domains`) in `src/lib/support/mail.ts`: listed recipients are mailed, the rest logged as suppressed (the sweep log says which); the one-time-code steps refuse unlisted addresses before any contact lookup, and the on-screen code appears off localhost only when the list is set. Set it on every shared host; keep `inviteMode` = portal and `sweep.live` off until SMTP exists. |
| 12 | **One instance, or a shared store** | none if pinned | OTP attempt counts and the send limiter (`otp.ts`), the reference memo (`memo.ts`) and the service token cache are per process. Staging: min = max = 1 instance, documented. Production: OTP counters move to Postgres. |
| 13 | **Robots and access on the staging host** | small | The portal layout is `noindex`, but the public site and `/admin` ship in the same image. Make `next-sitemap.config.cjs` disallow everything under a staging flag; decide whether an IP allowlist goes in front (item 23). |
| 14 | **Secure cookies behind HTTPS** | config | `session.ts` reads the session cookie by the rule Auth.js writes it: `AUTH_URL` when set, else the request's `x-forwarded-proto` (done 2026-10-15). On Cloud Run set `AUTH_URL` to the https staging origin anyway. `trustHost` is already on. |
| 15 | **Health route and structured logs** | small | `/api/health` that checks Postgres; JSON log lines for Cloud Logging. Bodies are never logged already (`07` §1b). |
| 16 | **Feature gaps testers will hit against the Hub** | decide | Case merge is missing. City/State/Region admin is missing. Email from the workspace is created but never sent (UAT has no synced mailbox; Pending Send). Per-status durations are coarse. The product desk has no Yodiz adapter (phase B); tracker keys are typed by hand. Decide which block the test and which the tester guide lists as known. |
| 17 | **Keep off** | none | `SUPPORT_DEV_AGENT`, `SUPPORT_DEV_SERVICE`, `SUPPORT_DEV_SHOW_CODE`, `SUPPORT_UAT_WRITE_TESTS`, `DATAVERSE_MOCK` unset; the token cache never in the image. `SUPPORT_PORTAL_WRITES` is read nowhere yet and belongs to go-live (`07` §7), not staging. |

## 3. GCP staging
| # | item | notes |
|---|---|---|
| 18 | **Project and region** | One project, `asia-south1` (Mumbai): the Payload copies of case facts (CSAT rows), evidence files and product items stay in India. Enable Cloud Run, Cloud SQL, Secret Manager, Artifact Registry, Cloud Build, Cloud Scheduler, Cloud Storage, Logging. |
| 19 | **Cloud SQL Postgres 17** | Smallest shared-core tier. Private IP or the Cloud SQL connector from Cloud Run. Automated backups and point-in-time recovery **on**: ratings, follow-ups, care flags, product items, the sweep log and the KPI settings exist only there. |
| 20 | **Artifact Registry and the image pipeline** | One repository. First push from the dev machine (item 8); a Cloud Build trigger on `main` later. |
| 21 | **Cloud Run service** | 2 GiB memory (Next + Payload + sharp), 1 vCPU; min = max = 1 instance (item 12); request timeout 300 s (sweep, CSV exports); Cloud SQL attached; secrets as env; migrations at start (item 9). |
| 22 | **Secrets and env** | see the block below |
| 23 | **Hostname and TLS** | Pick the name first (e.g. `support-staging.k7computing.com`): the Entra redirect URI, the public URL and the cookie flag depend on it. Cloud Run domain mapping is enough; an IP allowlist needs an HTTPS load balancer with Cloud Armor. |
| 24 | **Cloud Scheduler** | `POST https://<staging host>/api/support/sla/sweep` every 15 min with `Authorization: Bearer $CRON_SECRET`; body `{"live":true}` only once item 11 exists and `sweep.live` is switched on deliberately. |
| 25 | **GCS bucket** | Same region, uniform access; the service's own service account with object access to that bucket alone (item 10). |
| 26 | **Monitoring** | Uptime check on `/support`; alerts on the 5xx rate and on `[dataverse]` errors in the logs, including 429. |
| 27 | **Outbound checks** | With the CRM admin: UAT has no IP firewall enabled (Power Platform admin → environment → settings); conditional access does not block the server's refresh-token calls from a GCP address. |

```
Secret Manager:  DATABASE_URL  PAYLOAD_SECRET  AUTH_SECRET  CRON_SECRET  PREVIEW_SECRET
                 AUTH_MICROSOFT_ENTRA_ID_ID  AUTH_MICROSOFT_ENTRA_ID_SECRET
                 DATAVERSE_CLIENT_ID  DATAVERSE_CLIENT_SECRET  SMTP_URL
Plain env:       NEXT_PUBLIC_SERVER_URL=https://<staging host>   AUTH_URL=https://<staging host>
                 AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/005ef94f-7dbd-4d0e-a29a-494e2a63d911/v2.0
                 DATAVERSE_URL=https://k7crmuat.crm8.dynamics.com   DATAVERSE_TENANT_ID=005ef94f-7dbd-4d0e-a29a-494e2a63d911
                 DATAVERSE_WRITES_ENABLED=1   SUPPORT_MAIL_FROM="K7 Support <support@k7computing.com>"   YODIZ_URL_PATTERN=…
                 SUPPORT_MAIL_ALLOWLIST=@k7computing.com,...   (item 11)
                 new (items 10, 13): the GCS bucket name, the staging robots flag
Never set:       SUPPORT_DEV_AGENT  SUPPORT_DEV_SERVICE  SUPPORT_DEV_SHOW_CODE  SUPPORT_UAT_WRITE_TESTS  DATAVERSE_MOCK
```

## 4. Test readiness (UAT and people)
| # | item | who | notes |
|---|---|---|---|
| 28 | **Re-seed UAT before the window** | Navin, after telling the CRM admin | Seeded cases stop on 2026-10-12. `python3 -I scripts/dataverse-seed.py --target https://k7crmuat.crm8.dynamics.com --since <date>` (dry run first) brings in the cases testers handled in production that week; it skips existing rows. Resolution dates still read as the run date, so SLA numbers on seeded cases stay an artefact (`09` §4c). Cadence: once at the start, weekly during the window. |
| 29 | **Testers and roles in UAT** | Navin + CRM admin | All 65 agents exist in UAT with production UPNs; seven have no security role and the seed gave their rows to Navin (`migration/dataverse-seed-report.json`, `owner_fallbacks`). Assign roles, re-assign if those agents test. Managers need one of the configured roles or a listed email (`09` §4c); principal support its roles or emails (`09` §4f). |
| 30 | **Configure Payload on staging** | Navin | It starts empty: first admin user at `/admin`; `/support/workspace/manage/kpis` with `sweep.enabled` off, `sweep.live` off, `csat.inviteMode` = portal, manager emails; `/support/product/settings` with the principal emails and the mirror switches (`mirror.enabled`, `createCrmRows`) as decided for staging. Local test data (PD-0001…3, CS-0119x, the Portal Test contact) stays local. |
| 31 | **Tester guide and script** | Navin | One page: production stays the system of record; the portal reads UAT, nothing reaches production; what to compare; never resolve or cancel seeded cases of real customers; emails from UAT reach nobody; known artefacts; how to report. A checklist drawn from the verified flows in `09` §4b–§4f: sign-in, the five views against the Hub, the case sheet and timeline, note / assign / resolve / queue, both dashboards' numbers, the customer journey (register, case, reply), the manager pages, a phone CSAT rating and its follow-up, a product item raised, triaged and closed. |
| 32 | **Exit criteria** | the support lead | `07` §7 step 1: parity sign-off on the five must-have views, the case form, the timeline and the two dashboards; add the customer journey, the manager pages, CSAT and the product desk. |

## 5. Decisions (Navin)
- Customers: keep the built one-time-code flow or move to Entra External ID (`09` §2). Keep the code flow for staging.
- Access: open host with `noindex`, or an IP allowlist behind a load balancer.
- Mail: a real relay with the allowlist (item 11), or a sink (e.g. Mailpit) with a web page testers open for their codes.
- The GCS adapter (item 10): yes or no.
- Which gaps in item 16 block the test.
- UAT capacity (item 4).

## 6. Suggested order
Items 23 first → 7–10 as one code pass → 18–25 → items 2–3 with the admins while the service comes up → 27–31 → testers.

## 7. The short path: a few testers before any of §2–§3 (decided 2026-10-15)
Not a deployment: the dev server on Navin's machine, against UAT, reached through an https tunnel. Everything in §2 and §3
is skipped; items 2, 3, 4 and 9 do not apply. What it takes:
1. **An https hostname.** Entra accepts http redirects only for localhost. `scripts/dev-tunnel.sh up` starts a Cloudflare quick
   tunnel (trusted hostname, no account), waits for its URL, sets `AUTH_URL` in `.env` and prints the callback to register on the
   app registration (owner can). The quick tunnel rewrites `Host` to `localhost:3000`, which is why `AUTH_URL` must name the
   public origin (Auth.js builds the Microsoft callback from it) and why `next.config.ts` lists `*.trycloudflare.com` both in
   `allowedDevOrigins` (dev assets) and `experimental.serverActions.allowedOrigins` (posts whose browser origin is the tunnel).
   The URL changes on every start, so re-register after a restart; `down` removes `AUTH_URL` so localhost sign-in works again.
   The script pins `--edge-ip-version 4 --protocol http2`: this network has no IPv6 route to Cloudflare and the default QUIC
   connection stalled 40–80 s on the first request after idle (measured 2026-10-15); over TCP/IPv4 every request took about a second.
   While `AUTH_URL` points at the tunnel, sign in through the tunnel URL, not localhost. `NEXT_PUBLIC_SERVER_URL` stays localhost.
2. **Only the Microsoft door.** `SUPPORT_DEV_AGENT` unset, `SUPPORT_DEV_SERVICE=probe` (customer side), `SUPPORT_MAIL_ALLOWLIST`
   set to the testers' addresses or `@k7computing.com` (item 11); the script refuses to start without them. `SUPPORT_DEV_SHOW_CODE=1`
   may stay: codes show only for listed addresses, and a request that carries forwarded headers never counts as local.
   Optional: *assignment required* on the enterprise app.
3. **A UAT security role per tester** (item 29): sign-in ends at "no access to the support system" without one; seven agents
   have none. Re-seed first if the testers want the week's cases (item 28).
4. **The five rules** (item 31, one paragraph is enough): UAT only, data ends at the last seed, mail reaches nobody outside the
   allowlist, never resolve or cancel a real customer's seeded case, where to report.
Limits: first loads compile, the machine stays on, one process (item 12 holds by construction), UAT writes shared with the CRM admin.
