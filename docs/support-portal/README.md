# Support portal (Dynamics 365 / Dataverse) — planning handoff

Status 2026-10-11: planning complete, no code yet. **Interim mode: read-only development
against production** (`07-production-safety.md` §1b) because the tenant is over Dataverse
database capacity and no sandbox can be created or copied; writes wait for a writable
sandbox/UAT (`scripts/dataverse-seed.py` is ready for it). The support portal (agent workspace
first, customer self-service second) is built in this repo on top of K7's existing
Dynamics 365 Customer Service data, accessed through the Dataverse Web API. Production
Dataverse must not be touched during development (`07-production-safety.md`).

## Read in this order
| file | what it is | read when |
|---|---|---|
| `01-requirements.md` | audiences, phases, agent workspace (parity with the "Dynamics 365 Mobile – custom" app), customer self-service, decisions | always |
| `03-metadata-summary.md` | confirmed table/column logical names, option values, lookups, counts, app inventory | any field or API question |
| `07-production-safety.md` | UAT vs production rules, no-schema-change rule, rollout gates | before any Dataverse call |
| `08-implementation-plan.md` | routes, libraries, auth, UI, milestones, env vars, first-session checklist | starting work |
| `02-dataverse-integration.md` | auth flows, read/write request examples, limits, licensing | coding the client |
| `06-entra-setup.md` | click-by-click app registrations, UAT access, External ID tenant | setting up sign-in |
| `04-data-profile.md` | statistical profile of the data (volumes, fill rates, value sets) | data-quality questions |
| `05-metadata-full.md` | 1,600-line metadata dump | grep only, never read whole |

## Key facts
- Tenant `005ef94f-7dbd-4d0e-a29a-494e2a63d911`; production `https://k7crm.crm8.dynamics.com`
  (47.6 GB database, 118 GB files). Development target: a new **Portal Dev sandbox** made by
  a Minimal copy of production and seeded with the last 3–6 months (`scripts/dataverse-seed.py`).
  The existing UAT (`k7crmuat`) is not used.
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
`scripts/dataverse-seed.py` seeds the sandbox from production (see `07-production-safety.md` §1).
Both share the git-ignored, personal token cache `scripts/.token_cache.json`.

## Open items
- Capacity: tenant over Dataverse database entitlement (46.7 GB used); sandbox creation/copy
  blocked. Options: buy capacity add-on, reclaim space (system jobs, workflow/plugin logs),
  or use existing UAT as-is with a solution import. Decide with the licence owner.
- Until then: read-only against production; M2 writes blocked.
- Approved page designs for the portal templates in `designs/` (none yet).
- Customer-facing sub-category list, reopen window, status wording; licence data on profile.
- Microsoft's written confirmation on external-user licensing before phase 2.

Origin: planning folder `~/office_docs/website/support_portal_dynamics` (raw exports,
profiler, raw metadata JSON). This folder is the live copy; do not edit the origin.
