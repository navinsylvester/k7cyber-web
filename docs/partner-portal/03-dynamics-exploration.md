# Dynamics 365 exploration for the partner portal (UAT, 2026-10-22)

**Scope note (2026-10-22, after the exploration):** the portal is for a new product and starts fresh,
so this file is read for the *shape* of the CRM, not its history. §6 and §7 are create-only (the
matching steps are kept for reference, switched off), §8 reads back only the portal's own opportunities,
and §9's production counts are optional background rather than a gate.

Read-only discovery of the **sales side** of K7's Dynamics on the UAT sandbox
(`k7crmuat.crm8.dynamics.com`), done with `scripts/dataverse-probe.py` (GET only). The support
portal's discovery (`docs/support-portal/03-metadata-summary.md`) covered cases, contacts, accounts,
products and knowledge; this file adds opportunities, leads, the sales process, and how partners are
represented today. Schema in UAT carries the sales customisations as installed there (solutions
*Sales Customization* 2025-07-21, *Presales enhancement* 2025-05-28, *Sales Dashboard* 2026-07-17,
*Sales Power BI Dashboards* 2026-08-17), so column and option names are current; **row counts are
UAT's own test data**, not production. Production counts are in §8 for Navin to run.

## 1. Counts in UAT (test data)
| table | rows | note |
|---|---|---|
| opportunity | 110 | created 2019-05 → 2026-08, mostly test rows ("test-Fresh-EPS - Cloud", "Cetas Chennai-…") |
| lead | 24 | |
| quote / salesorder | 92 / 54 | |
| opportunityproduct | 63 | product lines on opportunities |
| account | 15,917 | type set on 330 (see §4) |
| product | 1,984 | `productnumber` = `K7Sales###`, mirrors production (`09-portal-guide.md`) |
| competitor | 3 | Kasper Sky, Escan, Quickheal |
| territory | 28 | Indian states and cities (Tamilnadu, Mumbai, Delhi, …) |
| alletec_approvaltask | 238 | PO-verification / credit-control checklist activities on opportunities, with an SLA (not a general approval engine) |
| alletec_k7contract | 63 | customer ↔ opportunity ↔ product key, subscription start/end, renewal opportunity |

## 2. The opportunity as K7 uses it
**Process.** Business process flow `opportunitysalesprocess`: Pre Sales (Qualify) → Proposal →
Negotiation → Order (Propose) → Invoice → Closure (Close). Mirrored in the custom pick-list
`alletec_stage` (260760000 Pre Sales … 260760005 Closure) and in `stepname` (Pipeline Phase).
Many business rules lock and require fields per stage (proposal sent on, PO received on, invoice,
no. of licences/nodes/server type, end-customer name mandatory, SRN task, trial expiry…); workflows
generate the invoice number, the SRN task, PO-verification and credit-control tasks, and email on
Closure.

**Identity.** `alletec_opportunityno` = "Opportunity ID", format `OPP-YYMM-NNNNN`, set on every
row (an autonumber; the portal records it as the CRM reference). `name` (Topic) follows the sales
team's convention `<account>-<Fresh|Renewals>-<product>` (e.g. "A Dutta-Fresh-AVPremium - Endpoint").

**State and status.**
| column | values |
|---|---|
| `statecode` | 0 Open · 1 Won · 2 Lost |
| `statuscode` | Open: 1 In Progress, 2 On Hold · Won: 3 Won · Lost: 260760001 Additional Feature Requirement, 260760003 Price, 5 Budget, 260760002 K7 Brand Awareness, 696720003 K7 Brand Confidence, 696720001 Issued Fresh Key, 696720000 Merged, 696720002 Duplicate, 4 Others |
| `alletec_opportunitystatus` | 260760000 Open · 260760001 Won · 260760002 Lost · 260760003 Drop (with `alletec_dropopportunity`, `alletec_dropreasons`, `alletec_description`) |
| `alletec_status` "K7 Status" | 260760000 In Progress · 260760001 On Hold · 260760002 Won · 260760003 Lost · 260760004 Payment Denied |
| `msdyn_forecastcategory` | Pipeline · Best case · Committed · Omitted · Won · Lost |
| `opportunityratingcode` | Hot · Warm · Cold |

**Values and dates.** `estimatedvalue` (Est. Revenue), `actualvalue` (Actual Revenue, set on win),
`alletec_nvoiceamount` + `alletec_invoiceno` + `alletec_invoicedate`, `budgetamount`, `totalamount`
(sum of product lines), `closeprobability`; `estimatedclosedate`, `actualclosedate`,
`alletec_proposalsenton`, `alletec_poreceivedon`, `alletec_firstcalldate`/`lastcalldate`/`nfd`.
In UAT 62 of 110 rows have `actualvalue`, 67 an invoice amount. Currency ₹.

**Who the opportunity is with.**
| lookup | target | used in UAT | meaning |
|---|---|---|---|
| `parentaccountid` / `customerid` | account | 106 / 110 | the account the opportunity sits on (the buyer) |
| `alletec_endcustomername` | account | 63 | End Customer Name (mandatory by rule in B2B) |
| `alletec_partnername` | account | 9 | **Partner Name**: the channel partner on the deal; hidden by rule when `alletec_saleschannel` is B2C |
| `alletec_referralaccount` | account | 4 | Referral Account |
| `msa_partnerid` / `msa_partneroppid` | account / contact | 0 / 0 | the 2019 *Dynamics 365 Portals* partner schema; **unused** |
| `originatingleadid` | lead | | the lead it was qualified from |
| `ownerid` | systemuser/team | | the salesperson |

**Channel and source.** `alletec_saleschannel`: 0 B2B · 1 B2C · 2 Distributor · 3 To be Decided ·
4 MSP. `alletec_enquirysource` (17 values) includes 1 **Partner Referral** and 11 **Channel lead**,
beside Direct Sales, Campaigns, Website, Inside Sales, Support, Event, …
`alletec_salesvertical`: 0 SOHO · 1 Enterprise. `k7_industry` is free text.
`alletec_casetypelicensetype` ("Case Type/ License Type"): 0 Fresh · 1 Renewals · 2 Additional Purchase; a plugin on UAT refuses
an opportunity without it ("Opportunity : CaseType is missing", found 2026-10-23), so the portal always sends Fresh.
On create the CRM rewrites the opportunity's `name` to `<customer>-<case type>-<product category label>` (OPP-2610-00268 came back as
"PP-TEST Chrome Customer Pvt Ltd-Fresh-Others" although the portal sent the product's name), so the name pattern in the settings only
matters until the row is saved. On the end customer's account `alletec_verticalbusiness` ("Sub Vertical") is a picklist, not text:
the portal maps the partner's industry onto it by label (`accountVertical` in `deals-model.ts`) and leaves it out when nothing fits.

**What is sold.** `alletec_productcategory` ("Subcategory", 38 values: EPS - OP / EPS - CL, EAVP,
UTM, SDWAN, MDM, CP 360 variants, InfiniShield, EUS, VAPT, SOC, Consulting Services, ISAP, MSSP, …),
`alletec_productrequired` → product, `k7_opportunityproduct` → opportunityproduct; product lines
(`opportunityproducts`: `productid`, `quantity`, `priceperunit`, `extendedamount`) carry the SKU
(`product.productnumber`) and quantity. `alletec_nooflicenses`, `alletec_noofnodes`,
`alletec_noofendpoints`, `alletec_servertype`, `alletec_subscriptionyears` (1/3/5),
`alletec_platforms`. Competitor: `cit_competitorname` → competitor, `alletec_competitoradded`
(Yes/No), `alletec_competitorprice`, `alletec_competitorperiod`.

**Geography.** `alletec_zoneregion` → `k7_region`, `alletec_state` → `k7_state`,
`alletec_locationsalesterritory` → territory. (UAT's own region/state/city rows have different ids
from production's: match by name when writing, `docs/support-portal/README.md` open items.)

**Also on the row.** Trial (`alletec_trialrequired`, key, start/end, feedback), POC/demo
(`k7_pocmode` Demo/POC/Technical Discussion, done by/on, feedback), `alletec_rfe` → k7_rfe,
`alletec_quoteactivated`, PO verification and credit-control statuses (Not Required / Pending /
Approved / Rejected) driven by `alletec_approvaltask` rows, `alletec_certificateissuedate`
(a sales certificate date, unrelated to partner certification), `alletec_latestremarks`.

**Views the sales team has** (47 active): My Open / Open / Won / Lost / Closed Opportunities,
Actual Closure - Monthly, All Opportunities - Monthly (and per sales person) and Q1–Q4, North /
South / WCE Funnel and Monthly Report, Opportunities Forecast View, Closing Next Month, Opened This
Week. Apps: Sales Hub (`msdynce_saleshub`) exists beside the custom mobile app; Power BI sales
dashboards were added 2026-08.

## 3. The lead
`alletec_leadno` "Lead ID", `alletec_partnername` → account, `alletec_referralaccount`,
`alletec_saleschannel`, `alletec_enquirysource` and `alletec_enquirymedium`, `alletec_productcategory`,
`alletec_nooflicenses`, `alletec_customerwantstrial`, `alletec_pocdemorequired`, confidence MQL/SQL,
`alletec_stage`, `alletec_k7status`; standard `leadsourcecode` includes 4 Partner. BPF
`leadtoopportunitysalesprocess`; the workflow "Opportunity: Auto Populate Values From Lead" copies
the custom fields on qualification. A registered deal could enter as a lead and be qualified by
sales, or as an opportunity directly; see §7.

## 4. The partner account today
`alletec_accounttype`: 0 · 1 · 2 Distributor · 3 To be Decided · 4 MSP. **Labels differ by
environment:** UAT shows 0 = "B2B", 1 = "B2C"; the production export (`04-data-profile.md`) shows
0 = **Partner** (5,881), 1 = **Customer** (14,095), Distributor 65, MSP 6, To be Decided 251. The
values are the same; code uses values, never labels. `alletec_accountsubtype`: 0 Prospect · 1
Customer · 2 Evangelist · 3 Partner (production: 1,509). UAT: type 0 on 150, type 1 on 173,
Distributor 7, MSP 0, subtype Partner 23. The workflow "Opportunity WON Validations_Update Account
SubType" sets the subtype on a win.

Partner-profile columns that already exist on the account: `alletec_accountid` (`ACC-YYMM-NNNNN`),
`alletec_approxlyturnover` (< 1 Cr … > 100 Cr bands), `alletec_noofyearsinitbusiness` (bands),
`alletec_salesforcecount` (One … 25 Plus, NA), `alletec_itproductshandled` (H/W, S/W, AV/EPS,
Networking, …), `alletec_itproductsdetails`, `alletec_dealerforotherav`, `alletec_financialstrength`
(credit terms), `alletec_associatedwithk7on`, `alletec_lastcontactedon`, `alletec_vertical` /
`alletec_verticalbusiness`, `k7_verticaltype`, `alletec_lifecyclestage`, `k7_region` / `k7_state` /
`alletec_city` / `alletec_country` lookups, `websiteurl`, `emailaddress1`, `telephone1`,
`primarycontactid`. Hierarchy columns `alletec_partneraccount` → account and `msa_managingpartnerid`
→ account exist but are unused in UAT (0 rows). **No GSTIN or PAN column** (the approval task only
has a "GST No checked" boolean).

Contacts: **no customer-type column of K7's own** (corrected 2026-10-22 when the M2 job ran: UAT refused both
`new_customertype`, which is the incident's, and `k7_customertype`, the RFE's; the contact has only the stock
`customertypecode` with one value). The Dealer/Reseller and Partner counts quoted earlier are the incident's;
the partner relationship lives on the account's type and subtype; `msa_managingpartnerid`; `jobtitle`, `mobilephone`; the `adx_identity_*` columns of the 2019
Dynamics 365 Portals local login (password hash, lockout, username) are present and belong to the old
Event Portal, not to be reused.

## 5. What does not exist in the CRM
No table for a partner programme, partner application, deal registration, protection period,
scheme, eligibility, training, test or certificate. The *Dynamics 365 Portals* solutions installed in
2019 (adx_* tables, Portal Management app, the `msa_partner*` columns) are the marketing Event
Portal's footprint and are not used for partners. The `alletec_approvaltask` table is a per-opportunity
checklist for PO verification and credit control, with a status and SLA, not reusable as the portal's
approval trail. Everything the requirements describe therefore lives in the portal (Payload), as
`02-build-plan.md` decision 2 says.

## 6. Mapping: partner organisation → account (M2)
Create on approval (outbox job `account.create`, service identity, UAT only until go-live). Fresh
start: no matching against the 5,881 existing partner accounts; if K7 later wants it, the match would
be `name` (normalised), the primary contact's email domain, `websiteurl`, with candidates shown to the
Channel Manager at approval.
- Create: `name` = legal name, `alletec_accounttype` = 0 (VAR, Integration Partner) · 2 (Distributor) ·
  4 (MSP, if adopted), `alletec_accountsubtype` = 3, `alletec_lifecyclestage` left to sales,
  `websiteurl`, `emailaddress1`, `telephone1`, `address1_*` from the registered address,
  `k7_region` / `k7_state` / `alletec_city` / `alletec_country` **by name** (ids differ per environment),
  `alletec_approxlyturnover` from the turnover band, `alletec_noofyearsinitbusiness` from the year of
  incorporation, `alletec_salesforcecount` from company size, `alletec_associatedwithk7on` = approval
  date. Primary contact → a `contact` (`firstname`/`lastname`, `jobtitle`, `emailaddress1`,
  `mobilephone`, `parentcustomerid`; no customer-type column exists on the contact) set as `primarycontactid`.
- GSTIN, PAN, trade name, company size, partner type detail, terms version and the portal's partner ID
  stay in the portal (no columns). Ask the CRM admin only if sales wants them in the CRM.
- Back-reference: the portal stores `accountid` and `alletec_accountid`.

## 7. Mapping: deal registration → opportunity (M4)
On approval (outbox job `opportunity.create`):
- The end customer: create a customer account (`alletec_accounttype` 1, city/state by name) and a
  contact for the named person (fresh start: no matching against existing customer accounts);
  `customerid`/`parentaccountid` and `alletec_endcustomername` = that account, `parentcontactid` =
  the contact (K7's rows put the opportunity on the buyer and name the partner in `alletec_partnername`).
- `alletec_partnername` = the partner account; `alletec_saleschannel` = 2 Distributor for a
  distributor's deal (the named reseller goes into `description` and, when it matches a partner
  account, `alletec_referralaccount`), 4 for MSP, else 0 B2B; `alletec_enquirysource` = 1 Partner
  Referral (or 11 Channel lead: ask sales which they report on).
- `name` = `<customer>-Fresh-<product>` per the sales convention (a settings value); `estimatedvalue`,
  `estimatedclosedate`, `k7_industry`, `alletec_salesvertical` (Enterprise), `alletec_productcategory`
  = the new product's sub-category once the CRM admin adds one (36 Others until then),
  `alletec_nooflicenses` = quantity, `alletec_subscriptionyears`; product lines as
  `opportunityproducts` only for portal products that carry a `crmProductId` (the CRM catalogue
  predates the new product; `02-build-plan.md` decision 19), otherwise SKU and quantity in the note; competitor by
  name into `cit_competitorname` when it matches one of the competitor rows, else `alletec_competitoradded`
  = Yes (a picklist: 260760000 Yes, 260760001 No) and the name in `description`; `alletec_zoneregion`/`alletec_state` from the customer's state.
- `ownerid`: the Channel Manager who approved, unless settings name a sales owner per region (ask).
- `description` carries "Registered through the partner portal · K7D-xxxxx · protected until <date>";
  attachments become `annotations` on the opportunity. **No new columns**: the deal ID and the
  protection end live in the portal; the CRM's `alletec_opportunityno` is read back as the reference.
- Statuses after approval come from the CRM (requirements §7.2 last line): see §8.

Conflict check (FR-DEAL-04): at launch it runs over the portal's own deals (same end customer by
normalised name, email domain or contact email, open or inside protection). The CRM-side check below
is a later switch, read-only, shown to the approver only: open opportunities
(`statecode eq 0`) and won ones closed inside the protection window, matched on the end-customer
account name (normalised `contains`), the contact email (`parentcontactid` → `emailaddress1`,
`opportunity.emailaddress`), the email domain against `account.emailaddress1`/`websiteurl`; plus open
leads by `companyname` / `emailaddress1`. Each hit reports the other partner (`alletec_partnername`),
the owner and the stage; the partner sees only "a conflict was found".

## 8. Mapping: the dashboard read-back (M5)
Sync job: the portal's own opportunities by stored id (`opportunities?$filter=opportunityid eq … or …`
in batches of 25, or one `$batch` of GETs), never a CRM-wide filter by partner (fresh start: deals
registered outside the portal are not shown; FR-DASH-10 deferred). `$select` of
`opportunityid, alletec_opportunityno, name, statecode, statuscode, alletec_stage, stepname,
estimatedvalue, actualvalue, alletec_nvoiceamount, estimatedclosedate, actualclosedate,
alletec_productcategory, _customerid_value, _alletec_endcustomername_value, modifiedon` and the
product lines. Map: Open = `statecode` 0 (On hold when `statuscode` 2), Won = 1, Lost = 2 with the
`statuscode` label as reason; stage = `alletec_stage` label; actual order value = `actualvalue`, else
`alletec_nvoiceamount`. The snapshot is written onto the deal (`partner-deals.crm`). Scheme
eligibility (M7) counts deals whose snapshot has `statecode` 1 and `actualclosedate` inside the
scheme window, value = `actualvalue`, product filter on the portal product.

## 9. Production checks (optional background since the fresh-start decision; Navin runs; GET only, own account; the session's classifier refuses them)
```
cd ~/code/k7cyber-web
DV_ORG_URL=https://k7crm.crm8.dynamics.com python3 -I scripts/dataverse-probe.py count opportunity lead quote salesorder opportunityproduct alletec_k7contract
for f in "_alletec_partnername_value ne null" "_alletec_referralaccount_value ne null" "_msa_partnerid_value ne null" \
         "alletec_saleschannel eq 2" "alletec_saleschannel eq 4" "alletec_enquirysource eq 1" "alletec_enquirysource eq 11" \
         "statecode eq 1" "createdon ge 2026-01-01T00:00:00Z" "createdon ge 2026-01-01T00:00:00Z and _alletec_partnername_value ne null"; do
  printf "%-75s " "$f"; DV_ORG_URL=https://k7crm.crm8.dynamics.com python3 -I scripts/dataverse-probe.py get "opportunities?\$select=opportunityid&\$filter=$f&\$count=true&\$top=1" | grep -o '"@odata.count": [0-9]*'
done
```
What they answer: how much the sales team already uses opportunities and the partner field, which
tells us how familiar they will be with the portal's rows. Nothing in M1–M9 depends on it.
