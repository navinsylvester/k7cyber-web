# Dataverse metadata summary (k7crm.crm8.dynamics.com, discovered 2026-10-10)

Condensed from `05-metadata-full.md` (1,626 lines, full dump; grep it, don't read it) and
the planning folder's `spec/metadata/*.json`. Read this file for logical names and option values.

## Environment facts
- Org URL `https://k7crm.crm8.dynamics.com`, Entra tenant `005ef94f-7dbd-4d0e-a29a-494e2a63d911`
  (differs from the k7computing.com public tenant). 2,651 tables in the environment.
- Solutions present: Customer Service, Power Pages (adx_*, mspp_*), Marketing (msdyncrm_*,
  msdynmkt_*, mkt_*), Sales (msa_*, cit_*), Alletec customisations (alletec_*), K7 (k7_*, new_*).

## Row counts (RetrieveTotalRecordCount)
| table | rows | | table | rows |
|---|---|---|---|---|
| incident | 383,180 | | email | 858,355 |
| contact | 224,400 | | annotation (notes/attachments) | 624,828 |
| account | 36,982 | | alletec_k7contract (K7 Contract) | 8,379 |
| product | 1,982 | | queue | 582 |
| knowledgearticle | 93 (3 published) | | subject | 64 |
| new_issuecategory | 24 | | sla | 20 |
| new_subcategory | 536 (5 inactive) | | entitlement | 0 |
| k7_rfe / k7_defect | 139 / 76 | | k7_state / k7_region / alletec_city | 40 / 9 / 2,200 |

**Power Pages**: the only site is "Event Portal" (k7marketingportal.microsoftcrmportals.com,
created 2019-10-21, a marketing events site): adx_externalidentity 1, adx_webrole 3,
adx_portalcomment 5, adx_invitation 0. There is **no customer-facing support portal** today.

## Six-month window read live from production (2026-04-13 → 2026-10-10, seed dry run)
incident 13,932 · contact 9,170 (referenced) · account 928 (referenced) · annotation 24,231 ·
email 71,511 · phonecall 1 · task 1 · k7_rfe 139 · k7_defect 76. Reference tables:
alletec_country 20, k7_region 9, k7_state 40, alletec_city 2,200, subject 64,
new_issuecategory 24, new_subcategory 536, product 1,982, knowledgearticle 93.
Reading that window takes ~28 minutes (emails dominate).

## Apps actually used for support (model-driven, 65 licensed active users)
- **"Dynamics 365 Mobile – custom"** (`mobilecustom`, published 2025-06-20; used through the
  Dynamics 365 / Power Apps mobile app and browser). Sitemap: Service area → Dashboards,
  Activities; Customers → Accounts, Contacts, Social Profiles; Service → Cases, Queues,
  Knowledge Articles; Collateral → Products; Extensions → RFE, Defect, City, State, Region;
  plus Voice of the Customer surveys and Sync Errors. 82 tables, 21 case views, 8 dashboards
  (incl. "Active Cases Dashboard - Rafi" = `dashboard.png`, "Customer Service Manager
  Dashboard"). Mobile-offline profile tables are included.
- Case views in that app: Active Cases, All Cases, My Active Cases, My Resolved Cases, All
  Service Requests, Email Cases - Open / Overall, Channel Support Email Cases - Open, FCR
  Cases, Escalations Handled Daily, Daily Resolved Cases <2 h Consumer / <4 h Enterprise,
  Customer Connect - CRM, Customer Onboarding, Monthly Report - All Cases, SR - POC/DEMO
  weekly/monthly, SR - Technical discussion Weekly, Service request report daily/monthly/overall.
- Also installed: Customer Service Hub, Copilot Service workspace, Sales Hub, Customer
  Insights - Journeys, Omnichannel (inactive), Dynamics 365 App for Outlook.
- App id (appmoduleidunique) `e9ba2d40-0899-4e7f-9292-03c19622269b`; list components with
  `appmodulecomponents?$filter=_appmoduleidunique_value eq <id>` (componenttype 1 table,
  26 view, 60 form/dashboard, 62 sitemap).

## incident (entity set `incidents`)
| display name | logical name | type / values |
|---|---|---|
| Case Number | `ticketnumber` | autonumber CS-… |
| Case Title / Description | `title` / `description` | string / memo |
| Customer | `customerid` | polymorphic: `customerid_contact@odata.bind` or `customerid_account@odata.bind` |
| Primary Contact | `primarycontactid` | → contact |
| Source of Ticket (Origin) | `caseorigincode` | 1 Phone, 2 Email, 3 Web, 696720000 Chat, 100000000 Mobile App, 2483 Facebook, 3986 Twitter, 700610000 IoT |
| Status | `statecode` | 0 Active, 1 Resolved, 2 Canceled |
| Status Reason | `statuscode` | Active: 696720000 Open, 696720003 Reassigned, 696720001 In Progress-Support, 2 In Progress-Customer, 1 In Progress-Principle Support, 696720002 In Progress-Lab · Resolved: 5 Closed-Call, 1000 Closed-Remote · Canceled: 6 Canceled, 2000 Merged |
| Issue Category | `new_issue` | lookup → `new_issuecategory` (bind `new_Issue@odata.bind` → `/new_issuecategories(id)`) |
| Sub Category | `new_subcategory` | lookup → `new_subcategory` (bind `new_SubCategory@odata.bind`); sub-category's parent lookup is `new_subtype` |
| Product | `productid` | lookup → product |
| Product Category | `cit_productcategory` | picklist (EPS-OP 17, EPS-CL 18, EAVP 7, UTM 3, MDM 4, CP 360 13, … 36 Others) |
| Vertical Type | `new_verticaltype` | 100000000 Consumer, 100000001 Business Security, 100000002 Enterprise, 767340001 Pro32 |
| Customer Type | `new_customertype` | 100000001 Existing Customer, 100000000 Potential Customer, 696720005 New Customer, 696720002 Dealer/Reseller, 100000002 Partner, 696720007 Large Enterprise (500+), … |
| Case Considered as | `k7_caseconsideredas` | 696720000 FCR, 696720001 Non-FCR |
| Category | `new_category` | 100000000 Issue, 100000001 Query |
| Priority | `prioritycode` (std) / `k7_priority` | std: 1 High 2 Medium 3 Low 696720000 critical · k7: 696720000 High … 696720003 Critical |
| Case Type | `casetypecode` | 1 Case, 3 Service Request |
| Product version / Serial | `k7_productversion`, `k7_2ndserialnumber`, `new_virtualizedosnamenumberofvms` ("K7 Product Version") | strings |
| Customer email | `k7_customeremail` | string |
| Module / Sub-Module | `k7_module` / `k7_submodule` | strings |
| Steps to Reproduce / Resolution | `adx_stepstoreproduce` / `adx_resolution` | memo (added by Power Pages solution) |
| Portal attribution | `adx_createdbyusername`, `adx_createdbyipaddress`, `adx_modifiedbyusername` | strings Power Pages stamped; reuse for the new portal |
| Publish to Web | `adx_publishtoweb` | bool |
| RFE / Defect links | `k7_rfe` → k7_rfe, `k7_defectnew` → k7_defect; N:N `k7_incident_k7_rfe`, `k7_incident_k7_defect` | |
| Partner | `msa_partnerid` → account, `msa_partnercontactid` → contact | |
| Legacy/unused | `k7_casestatus` (second status picklist), `k7_assigndate`, `k7_srstatus`, `k7_servicerequesttype`, `k7_salespersonname`, ~20 `new_*` pre-sales survey strings | ignore in portal |
| SLA | `firstresponseslastatus`, `resolvebyslastatus` (1 In Progress, 2 Nearing Noncompliance, 3 Succeeded, 4 Noncompliant), `slaid` | 20 SLAs exist |

Issue categories (24): Activation; Activation Procedure; Connectivity; Console; Customer Support;
Email ticket; Endpoint; High Security Alerts; Installation; Malware; Mobile Security; New
Activation Flow - SMS; New Activation Procedure; Operating System; Others; Product Information;
Protection Status Disabled; Renewals & Fresh Purchase; Scanning & Config; Update; UTM -
Configuration; UTM - Installation/Activation; UTM - Others; VH Activation Flow & Queries.
Sub-categories per category: Console 56, Activation 55, Customer Support 44, Renewals 39,
Endpoint 36, Installation 36, Malware 31, Update 30, Scanning & Config 29, Connectivity 26, …
(very specific titles such as "Serial number incorrect - Purchased from third party portal").

## contact (`contacts`)
`fullname` `firstname` `lastname` `emailaddress1` `mobilephone` `telephone1` `parentcustomerid`
(→ account via `parentcustomerid_account@odata.bind`) · `alletec_city` → alletec_city,
`k7_state` → k7_state, `k7_region` → k7_region · `k7_verticaltype` (same values as incident)
· `msgdpr_gdprconsent` · Power Pages identity columns `adx_identity_*` (username, passwordhash,
logonenabled, emailaddress1confirmed, mobilephonecontirmed, lastsuccessfullogin) exist but are
unused (1 identity) · `statecode` 0 Active / 1 Inactive.

## account (`accounts`)
`name` `accountnumber` `telephone1` `primarycontactid` `parentaccountid` ·
`alletec_accountid` (ACC-…), `alletec_accounttype` (0 Partner, 1 Customer, 2 Distributor, 3 To
be Decided, 4 MSP), `alletec_accountsubtype` (1 Customer, 3 Partner), `alletec_lifecyclestage`
(0 Subscriber, 1 Lead, 2 MQL, 3 SQL, 260760004 Opportunity, 5 Customer, 6 Evangelist, 7 Others),
`alletec_city`/`k7_state`/`k7_region`/`alletec_country` lookups, `alletec_vertical`,
`k7_verticaltype`, `k7_description` = **License Key**, `alletec_partneraccount` → account,
`msa_managingpartnerid` → account, `k7_casetype` (Case/RFE/Service Request/Defect).

## product (`products`)
`name` = "Product Name - CRM", `productnumber` = Product ID (K7Sales###),
`alletec_productnamecrm` = **"Product Name - K7"** (marketing name), `alletec_k7partno`,
`alletec_noofssers` (user band, string), `alletec_noofyears`, `alletec_hsncode`,
`alletec_additionalinformation` (0 Corporate, 1 Education, 3 Educational, 2 Office, 4 Hotel),
`cit_componentaddons`, `productstructure` (1 Product, 2 Family, 3 Bundle),
`statecode` 0 Active / 1 Retired / 2 Draft / 3 Under Revision, `parentproductid`.
No vertical column on product; vertical lives on incident/account/contact.

## knowledgearticle (`knowledgearticles`)
`articlepublicnumber` `title` `description` `content` (HTML) `keywords` `isinternal`
`islatestversion` `isrootarticle` `languagelocaleid` `knowledgearticleviews` ·
`statecode` 0 Draft 1 Approved 2 Scheduled **3 Published** 4 Expired 5 Archived 6 Discarded ·
`statuscode` 7 = Published. `msdyn_creationmode` 0 Manual / 1 Copilot.

## annotation (`annotations`) — notes & attachments
`subject` `notetext` `filename` `mimetype` `filesize` `documentbody` (base64) `isdocument`
`objectid` polymorphic → bind `objectid_incident@odata.bind`. 624,828 rows → this is the
agent-side thread alongside `email` (858,355).

## k7_rfe (`k7_rfes`)
`k7_rfeno` `k7_rfetitle` `k7_rfestatus` (696720001 Open, 696720002 In-Progress - Accepted,
696720003 Closed – Rejected, 696720004 Closed, 696720000 Status for Principle Support)
`k7_rfetype` (100000002 Pre Sales, 100000000 Support RFE, 100000001 Customer RFE)
`k7_rfemode` `k7_rfereceivedfrom` `k7_customertype` `k7_verticaltype` `k7_numberofusers`
`k7_yodizid` `k7_serialno` · lookups `k7_case`/`k7_associatedcaseno` → incident, `k7_product`
→ product, `k7_account` → account, `k7_customer` (account|contact),
`alletec_associatedopportunityno` → opportunity.

## k7_defect (`k7_defects`)
`k7_defectno` `k7_defecttitle` `k7_defectstatus` (In Progress - Support / Threat Lab / Core
support / R&D, Closed – Engineering, Closed) `k7_priority` `k7_yodizid` `k7_emailaddress` ·
`k7_associatedcaseno` → incident, `k7_customer` (account|contact).

## Geography
- `k7_regions`: `k7_name`.
- `k7_states`: `k7_state` (name), `k7_region` → k7_region, `alletec_country` → alletec_country.
- `alletec_cities`: `alletec_name`, `alletec_state` → k7_state, `alletec_region` → k7_region,
  `alletec_country`, `alletec_tiertype` (260760000 Metro, 260760001 Non Metro, 260760002 Others).

## Also present and possibly useful
`alletec_k7contract` (8,379 rows, name `alletec_name`) — likely licence/contract records for
entitlement display; `subject` tree (64), `queue` (582), `sla` (20), `cit_autonumber`.
