# Support portal (Dynamics 365 / Dataverse) — planning handoff

Testers 2026-10-24: the first round of junior agents reported back; the verified findings and the fix list, worked across sessions, are `13-tester-round-1.md`. Staging 2026-10-15: the work list for a GCP staging deployment is `11-staging-readiness.md`. Design 2026-10-14: the **product desk** for developers and Labs is designed in `10-product-desk.md` (phase A built the same day, `09-portal-guide.md` §4f). Status 2026-10-13: **first build in the repo** (see `09-portal-guide.md`): agent workspace and customer self-service on UAT, with registration by one-time code. Planning status 2026-10-12: planning complete. **Development environment: UAT**
(`https://k7crmuat.crm8.dynamics.com`, `07-production-safety.md` §1 and §1c): the tenant is over
its Dataverse database entitlement, so no sandbox can be created or copied, and the existing UAT
sandbox was prepared instead — support schema synced from production, customer-facing automation
paused, production cases created on/after 2026-09-28 seeded (1,210 cases, zero errors, verified
against production the same day), automation resumed with the customer-facing items off. Production
stays read-only for the client (§1b). The support portal (agent workspace
first, customer self-service second) is built in this repo on top of K7's existing
Dynamics 365 Customer Service data, accessed through the Dataverse Web API. Production
Dataverse must not be touched during development (`07-production-safety.md`).

## Read in this order
| file | what it is | read when |
|---|---|---|
| `01-requirements.md` | audiences, phases, agent workspace (parity with the "Dynamics 365 Mobile – custom" app), customer self-service, decisions | always |
| `03-metadata-summary.md` | confirmed table/column logical names, option values, lookups, counts, app inventory | any field or API question |
| `07-production-safety.md` | UAT vs production rules, no-schema-change rule, rollout gates | before any Dataverse call |
| `09-portal-guide.md` | **what is built**: routes, the three sign-in doors, enforced rules, how to run, what is not done | starting work, always |
| `10-product-desk.md` | **the product desk** (designed 2026-10-14, not built): support → principal support → engineering and Lab in Yodiz; the item as a bridge record in Payload, Yodiz behind a swappable adapter, the CRM as a mirror through an outbox, samples by script, the clocks | before any work for engineering, Lab or Yodiz |
| `13-tester-round-1.md` | **the fix list from the first tester round** (2026-10-24): each claim verified or explained, TR-01…TR-15 with cause, files and a done-when check, decisions D-1…D-4, the reply to testers, a session log | working on tester feedback, always before the next round |
| `12-tester-brief.md` | the phase 1 message to the first testers (2026-10-15): link, the five rules, a 30-minute read-only script with one note; phase 2 scope listed | sending or re-sending the tester brief |
| `11-staging-readiness.md` | **staging on GCP** (written 2026-10-15): the work list before support staff can test against UAT side by side with production: admin blockers, code changes, GCP build-out, UAT and tester readiness, decisions | planning the staging deployment |
| `08-implementation-plan.md` | routes, libraries, auth, UI, milestones, env vars, first-session checklist (the intent) | planning questions |
| `02-dataverse-integration.md` | auth flows, read/write request examples, limits, licensing | coding the client |
| `06-entra-setup.md` | click-by-click app registrations, UAT access, External ID tenant | setting up sign-in |
| `04-data-profile.md` | statistical profile of the data (volumes, fill rates, value sets) | data-quality questions |
| `05-metadata-full.md` | 1,600-line metadata dump | grep only, never read whole |

## Key facts
- Tenant `005ef94f-7dbd-4d0e-a29a-494e2a63d911`; production `https://k7crm.crm8.dynamics.com`
  (47 GB database, 116 GB files). Tenant database entitlement 47.5 GB, used 49.2 GB (2026-10-12).
  Development target: the existing **UAT** sandbox `https://k7crmuat.crm8.dynamics.com`
  (environment `eef7bfef-083f-4817-854a-e4a34abe0a74`, 1.9 GB database, shared with the CRM admin
  Kathiresan M for solution staging and reporting), support schema synced from production and
  seeded with cases created on/after 2026-09-28. A fresh Minimal-copy sandbox remains the better
  option once capacity allows; the same scripts prepare it.
- 65 licensed agents work in the model-driven app "Dynamics 365 Mobile – custom" today;
  there is no customer-facing support portal (the only Power Pages site is a 2019
  marketing Event Portal).
- 383k cases, 224k contacts, 37k accounts, 625k notes, 858k emails, 24 issue categories
  with 536 sub-categories, 21 case views, 46 case charts, 8 dashboards.
- Decisions: both audiences in one product, agents first; responsive web, no offline;
  phase-1 views My Active / My Resolved / Active / Email Cases - Open / FCR; dashboards
  Rafi + Customer Service Manager; customer identity = Entra External ID; partners later.

## Tooling
`scripts/dataverse-probe.py` (python 3, no dependencies) reads `.env` (`DV_ORG_URL`,
`DV_TENANT_ID`, `DV_AUTH=device` or `DV_CLIENT_ID`/`DV_CLIENT_SECRET`):
```
python3 -I scripts/dataverse-probe.py get WhoAmI
python3 -I scripts/dataverse-probe.py get 'incidents?$select=ticketnumber&$top=3'
python3 -I scripts/dataverse-probe.py count incident contact
python3 -I scripts/dataverse-probe.py discover      # rewrites spec/METADATA.md + spec/metadata/ (move into docs/support-portal/05-metadata-full.md)
```
`scripts/dataverse-schema-sync.py` copies the support schema from production into the target
(dry run first; backs up what it overwrites; publishes only what it touched).
`scripts/dataverse-uat-automation.py --pause|--resume` turns the target's case automation off
around a seed and keeps the customer-facing items off.
`scripts/dataverse-seed.py --since YYYY-MM-DD` seeds the target from production (see
`07-production-safety.md` §1). All of them refuse the production host as a target and share the
git-ignored, personal token cache `scripts/.token_cache.json`. The dev network drops IPv6 to
Microsoft and has DNS blips: the scripts prefer IPv4 and retry network errors for minutes.

## Open items
- Capacity: tenant over its Dataverse database entitlement (47.5 GB entitled, 49.2 GB used);
  create/copy/restore blocked. Microsoft's storage validation (rolling out 2026-11-09 to
  2026-12-04) puts sandboxes without pay-as-you-go into administration mode 30 days after the
  overage starts and disables them later — UAT included. Buy capacity, link UAT to pay-as-you-go,
  or request the free 45-day extension before then. Decide with the licence owner.
- UAT keeps its own 2,091 cities and 18 countries next to production's 2,202 and 20 (same names,
  different ids; the production set was created by the seed on 2026-10-12). Decide which set to
  keep: deleting UAT's own set clears the city of its old accounts; deleting production's set
  needs the seeded accounts re-pointed by name.
- UAT differences left on purpose: `07-production-safety.md` §1c. Seven agents have no security role in
  UAT; the seed gave their 63 cases, 208 emails, 76 notes, 21 contacts and 19 accounts to Navin as owner.
  Assign the roles (Settings → Users + permissions) and re-assign those rows if the demo needs them.
- Products: UAT mirrors production's 1,982 products (ids, parents, numbers); 7 rows UAT already had keep
  their own active/retired state.
- Approved page designs for the portal templates in `designs/` (none yet).
- Customer-facing sub-category list, reopen window, status wording; licence data on profile.
- Microsoft's written confirmation on external-user licensing before phase 2.

Origin: planning folder `~/office_docs/website/support_portal_dynamics` (raw exports,
profiler, raw metadata JSON). This folder is the live copy; do not edit the origin.
