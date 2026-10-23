# Partner portal — planning handoff

Status 2026-10-23: **M1–M9 are built and clicked** (`04-portal-guide.md`; `05-staging-and-go-live.md` is the runbook for staging, operations, backup and the go-live gate); the learning side (M10–M11) is next and last. Earlier that day: requirements captured and the CRM explored. The source document
(Vijaichristopher, 2026-10-06) was copied into this folder and converted; the gaps it leaves are listed;
the sales side of Dynamics was explored on UAT and the field mappings written; the build is planned in
milestones so that work can continue across many sessions. **The learning side (training, certificates)
is the last phase** (decided 2026-10-22). **The portal is for a new product and starts fresh**: no
existing customer, partner account or deal is imported or matched; the CRM mirrors what the portal
creates. What remains of M0 (`02-build-plan.md` §7) does not block M1.

## Read in this order
| file | what it is | read when |
|---|---|---|
| `02-build-plan.md` | **the plan**: how to work across sessions (§0), status (§1), decisions (§3), where it lives (§4), data model (§5), milestones with tick-boxes (§6), M0 checklist (§7), traceability (§9), session log (§10) | always, first |
| `01-requirements.md` | the requirements, verbatim from the source, with an appendix of what the document leaves open | any "what did the document say" question |
| `03-dynamics-exploration.md` | **the CRM as it is** (UAT, 2026-10-22): the opportunity's columns, states and process, the partner lookups in use, the account's partner columns, what does not exist, the field mappings for onboarding, deals, the dashboard and schemes, the production checks | any field, mapping or sync question |
| `04-portal-guide.md` | **what is built** (from M1 on, kept current like `docs/support-portal/09-portal-guide.md`): routes, the doors, the library, the data, the rules the code enforces | before touching code |
| `05-staging-and-go-live.md` | **how it runs** (M9): what a host must provide, the environment per stage, the scheduler, the Operations page and the health route, the go-live gate with the per-feature CRM switches, backup and restore | before a deploy, a cron change or the gate |
| `source/K7 Partner Portal Requirements Document.docx` | the original | never; `01-requirements.md` is the copy to read |

## What it reuses
The support portal's foundations (`docs/support-portal/`): the Microsoft door for K7 staff, the
one-time-code door generalised for partner users, the Dataverse client with its production guard,
the mirror-through-outbox pattern of the product desk, `SMTP_URL` mail with the allowlist,
`CRON_SECRET` scheduled jobs, and the Case File design language (section 10 · Partners in the
design system).

## Relation to other work
- The **public Partners page** (`content/source/k7-enterprise-website-content.md`, "Partners") is a
  marketing page with reseller and MSP lists and a "Let's Talk" enquiry form; it links to the
  portal's public registration. Not the same thing as the portal.
- **Support portal phase 3** (`docs/support-portal/01-requirements.md` §1: partners and dealers get
  support self-service after customers) is a separate scope. Once both exist, a partner user should
  reach support cases from the partner portal; not planned here.

Origin: `~/office_docs/website/requirements/K7 Partner Portal Requirements Document.docx`. This
folder is the live copy; do not edit the origin.
