# Talking to Dataverse from an external web app (read + write)

Target: a custom support portal (any stack) that uses Dynamics 365 Customer Service
as a headless helpdesk through the **Dataverse Web API (OData v4)**. All logical
names below were confirmed by live discovery on 2026-10-10 (see
`03-metadata-summary.md`; `tools/dataverse_probe.py discover` regenerates it).
Org: `https://k7crm.crm8.dynamics.com` (production, **do not develop against it**) and
UAT `https://k7crmuat.crm8.dynamics.com` (development/test target since 2026-10-12); tenant
`005ef94f-7dbd-4d0e-a29a-494e2a63d911`. See `07-production-safety.md`.

## 1. Architecture (two credential modes, one backend)

```
Agent browser / PWA ──(Entra ID sign-in, token for your API)──┐
Customer browser / app ──(email link / OTP session)───────────┤
                                                              ▼
                               Portal backend (BFF)
         agent request: on-behalf-of exchange → Dataverse token AS THE USER
         customer request: client-credentials token of ONE application user
                           + mandatory contact/account filter on every query
                                                              ▼
                 Dataverse Web API  https://k7crm.api.crm8.dynamics.com/api/data/v9.2/
```

Rules that follow from this:
- Never call Dataverse from the browser with the application user's credentials. (A
  pure SPA calling Dataverse with the agent's own token is technically supported via
  CORS, but keeping both audiences behind one backend is simpler to secure and audit.)
- **Agents** are Dataverse `systemuser`s. Their calls run under their own security
  roles, business unit and queues; audit shows them; no extra filtering is needed.
- **Customers** are `contact`s, not Dataverse users. Map login → `contactid` once at
  sign-in; every query the backend issues for them carries a filter on that contact /
  parent account. Treat a missing filter as a security bug.
- The backend decides the mode from the authenticated identity type, never from a
  client-supplied flag.
- Impersonation (`CallerObjectId` / `MSCRMCallerID` headers) only works for licensed
  system users, so it cannot attribute writes to a contact. Attribute portal writes
  by setting `adx_createdbyusername` / `adx_modifiedbyusername` (string columns the
  Power Pages solution already added to incident, account and contact) and
  `primarycontactid` on the case.

## 2. One-time setup in Microsoft Entra ID and Power Platform

### 2a. Agent path (delegated; the Next.js server is the confidential client)
Because the site is server-rendered, the web app itself exchanges the authorization
code and asks for a **Dataverse** access token directly. No separate API registration
and no on-behalf-of exchange are needed.
1. Entra ID (workforce tenant `005ef94f-…`) → App registration "K7 Support Portal –
   Agents": Web platform, redirect URI `https://<site>/api/auth/callback/microsoft-entra-id`
   (plus the localhost one for dev), client secret or certificate.
2. API permissions (delegated): `openid`, `profile`, `email`, `offline_access`, and
   **Dynamics CRM → user_impersonation**. Grant admin consent.
3. Sign-in request scope: `openid profile email offline_access
   https://k7crm.crm8.dynamics.com/user_impersonation` (UAT: `https://k7crmuat.crm8.dynamics.com/user_impersonation`).
   The token response carries an ID token, a Dataverse access token (~60–90 min) and a
   refresh token; store them server-side in the session and refresh silently.
4. The user must already be an enabled, licensed Dataverse user (65 today); no
   application user or security role changes are needed for phase 1.
Step-by-step clicks are in `06-entra-setup.md`.

### 2b. Customer path (application user + Entra External ID)
Customers sign in to the website through an **Entra External ID** tenant (OIDC, email
one-time passcode). That identity never reaches Dataverse; the backend maps it to a
contact and performs Dataverse calls with the application user below.
1. Entra ID (workforce tenant) → App registration "K7 Support Portal – Service":
   single-tenant, no redirect URI, add a **certificate** (preferred) or client secret.
   Note tenant id and client id.
2. Power Platform admin center → Environments → *your env* → Settings → Users +
   permissions → **Application users** → New app user → pick the registration.
3. Create a security role **"Portal API"** with least privilege, organisation scope
   where the portal must see other people's rows (the backend filters them):
   - incident: Create, Read, Write, Append, Append To
   - contact: Create, Read, Write; account: Read
   - annotation (notes/attachments): Create, Read; email: Read (if threads are shown)
   - knowledgearticle, product, new_issuecategory, new_subcategory, k7_rfe,
     k7_state, alletec_city, k7_region, alletec_k7contract: Read
4. Token request (India region shown; use your org's real host):
   ```
   POST https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token
   grant_type=client_credentials&client_id=…&client_secret=…
   &scope=https://<org>.crm8.dynamics.com/.default
   ```
   Cache the token until ~5 minutes before `expires_in`.
5. Standard headers on every call:
   ```
   Authorization: Bearer <token>
   OData-MaxVersion: 4.0
   OData-Version: 4.0
   Accept: application/json
   Content-Type: application/json; charset=utf-8
   Prefer: odata.include-annotations="*"      ← returns labels for choices/lookups
   ```

## 3. Discovery: turn display names into logical names (run first)
| Need | Request |
|---|---|
| All custom + portal tables | `GET EntityDefinitions?$select=LogicalName,EntitySetName,DisplayName&$filter=startswith(LogicalName,'k7_') or startswith(LogicalName,'alletec_') or startswith(LogicalName,'adx_')` |
| Columns of a table | `GET EntityDefinitions(LogicalName='incident')/Attributes?$select=LogicalName,DisplayName,AttributeType,IsCustomAttribute` |
| Choice columns + values | `GET EntityDefinitions(LogicalName='incident')/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet,GlobalOptionSet` |
| Status Reason → State mapping | `GET EntityDefinitions(LogicalName='incident')/Attributes/Microsoft.Dynamics.CRM.StatusAttributeMetadata?$select=LogicalName&$expand=OptionSet` (each option carries `State`) |
| Lookups and navigation names | `GET EntityDefinitions(LogicalName='incident')/ManyToOneRelationships?$select=ReferencingAttribute,ReferencedEntity,ReferencingEntityNavigationPropertyName` |
| True row counts | `GET RetrieveTotalRecordCount(EntityNames=['incident','contact','account'])` |

Already done: results are in `03-metadata-summary.md` (condensed) and
`spec/metadata/*.json` (raw). Re-run only after schema changes. Note: the metadata
endpoint rejects `startswith` filters; fetch the list and filter client-side.

## 4. Read patterns (one per portal feature)

### 4a. Agent workspace
**Reuse the app's saved views instead of re-coding them** (21 case views exist):
```
GET savedqueries?$select=savedqueryid,name,returnedtypecode,fetchxml,layoutxml&$filter=returnedtypecode eq 'incident' and statecode eq 0
GET incidents?savedQuery=<savedqueryid>            ← executes the view as the signed-in user
Prefer: odata.maxpagesize=50, odata.include-annotations="*"
```
`layoutxml` gives the column list for the grid. The same works for `userQuery=` (personal views).

**Timeline of a case** (emails, calls, tasks, appointments, SMS, then notes):
```
GET activitypointers?$select=activityid,activitytypecode,subject,description,createdon,actualend,statecode,_ownerid_value,_from_value
    &$filter=_regardingobjectid_value eq <incidentid>&$orderby=createdon desc
GET emails(<activityid>)?$select=subject,description,directioncode,torecipients,sender&$expand=email_activity_mime_attachment($select=filename,filesize,mimetype)
GET annotations?$filter=_objectid_value eq <incidentid>&$select=subject,notetext,filename,mimetype,filesize,createdon,_createdby_value
```
**Queues**: `GET queueitems?$select=title,_objectid_value,_workerid_value,enteredon&$filter=_queueid_value eq <queueid> and statecode eq 0`;
"items I'm working on": `$filter=_workerid_value eq <userid>`.
**Charts**: `GET savedqueryvisualizations?$select=name,datadescription,presentationdescription&$filter=primaryentitytypecode eq 'incident'`
(46 exist; `datadescription` holds the FetchXML aggregate to run, `presentationdescription` the chart type).
**Aggregates** run as FetchXML: `GET incidents?fetchXml=<url-encoded fetch with aggregate="true">` (50,000-row aggregate limit).
**Who am I**: `GET WhoAmI` → `UserId`, `BusinessUnitId`.

### 4b. Customer self-service

**Resolve the signed-in user** (handle duplicates: `$top=2`, pick newest if 2):
```
GET contacts?$select=contactid,fullname,emailaddress1,mobilephone,_parentcustomerid_value
    &$filter=emailaddress1 eq 'user@example.com' and statecode eq 0&$orderby=modifiedon desc&$top=2
```

**My cases** (contact-owned plus account-owned for business users):
```
GET incidents?$select=incidentid,ticketnumber,title,statecode,statuscode,caseorigincode,createdon,modifiedon,_productid_value
    &$filter=(_customerid_value eq <contactid> or _customerid_value eq <accountid>) and statecode eq 0
    &$orderby=modifiedon desc
Prefer: odata.maxpagesize=25, odata.include-annotations="*"
```
Labels arrive as `statuscode@OData.Community.Display.V1.FormattedValue`,
lookup names as `_productid_value@…FormattedValue`. Follow `@odata.nextLink`
verbatim for the next page; `$skip` is not supported on Dataverse tables.

**Case detail**
```
GET incidents(<id>)?$select=ticketnumber,title,description,statuscode,createdon,modifiedon
    &$expand=customerid_contact($select=fullname),productid($select=name)
```

**Conversation thread** — depends on what agents use today (check counts first):
```
GET annotations?$select=annotationid,subject,notetext,filename,mimetype,filesize,createdon,_createdby_value
    &$filter=_objectid_value eq <incidentid>&$orderby=createdon asc
GET annotations(<id>)?$select=documentbody            ← base64, fetch only on download
GET emails?$select=subject,description,createdon,directioncode&$filter=_regardingobjectid_value eq <incidentid>
(adx_portalcomments exists but holds 5 rows in total: not used; build the thread on annotations + emails)
```

**Knowledge base**
```
GET knowledgearticles?$select=knowledgearticleid,articlepublicnumber,title,description,keywords,content,modifiedon
    &$filter=statecode eq 3 and isinternal eq false and islatestversion eq true
    &$orderby=modifiedon desc
```
(`statecode` 3 = Published; the export's list Draft/Approved/Scheduled/Published/
Expired/Archived/Discarded is values 0–6.) Search: enable Dataverse search on the
environment, then `POST https://<org>.crm8.dynamics.com/api/search/v1.0/query`
with `{"search":"activation","entities":"[\"knowledgearticle\"]","top":10}`;
fallback is `contains(title,'activation')` or the `FullTextSearchKnowledgeArticle`
function.

**Products for the create-case picker** (cache for hours):
```
GET products?$select=productid,name,productnumber,alletec_productnamecrm,alletec_noofssers,alletec_noofyears,alletec_additionalinformation
    &$filter=statecode eq 0 and productstructure eq 1&$orderby=alletec_productnamecrm,name
(`alletec_productnamecrm` is the "Product Name - K7" marketing name; group the picker by it.)
```
(`statecode` 0 Active / 1 Retired / 2 Draft / 3 Under Revision; `productstructure`
1 Product, 2 Family, 3 Bundle.)

**Geography pickers** (cache for a day):
```
GET k7_regions?$select=k7_regionid,k7_name&$filter=statecode eq 0
GET k7_states?$select=k7_stateid,k7_state,_k7_region_value&$filter=statecode eq 0&$orderby=k7_state
GET alletec_cities?$select=alletec_cityid,alletec_name,alletec_tiertype&$filter=_alletec_state_value eq <stateid> and statecode eq 0&$orderby=alletec_name
```
**Issue category pickers** (cache for a day; 24 categories, 536 sub-categories):
```
GET new_issuecategories?$select=new_issuecategoryid,new_issuecategory&$filter=statecode eq 0&$orderby=new_issuecategory
GET new_subcategories?$select=new_subcategoryid,new_categoryname&$filter=_new_subtype_value eq <categoryid> and statecode eq 0&$orderby=new_categoryname
```

**Counts and sync**: `$count=true` is capped at 5,000; use
`RetrieveTotalRecordCount` for totals. For a local cache/search index, enable change
tracking on the table and request `Prefer: odata.track-changes` → store
`@odata.deltaLink`, poll it for creates/updates/deletes.

## 5. Write patterns

**Create a case** (lookups are set with `@odata.bind`; ask for the record back):
```
POST incidents
Prefer: return=representation
{
  "title": "Activation fails after reinstall",
  "description": "…",
  "caseorigincode": 3,                                   ← 3 = Web, 100000000 = Mobile App
  "customerid_contact@odata.bind": "/contacts(<contactid>)",
  "primarycontactid@odata.bind": "/contacts(<contactid>)",
  "productid@odata.bind": "/products(<productid>)",
  "new_Issue@odata.bind": "/new_issuecategories(<categoryid>)",
  "new_SubCategory@odata.bind": "/new_subcategories(<subcategoryid>)",
  "new_verticaltype": 100000000,                         ← Consumer; 100000002 Enterprise, 767340001 Pro32
  "k7_productversion": "…", "k7_2ndserialnumber": "…",  ← optional, from the form
  "adx_createdbyusername": "<portal user email>"         ← attribution
}
```
Response 201 contains `ticketnumber` (autonumber) and `incidentid`. For a business
user use `customerid_account@odata.bind` and `primarycontactid@odata.bind`.

**Add a comment / attachment** as a note on the case:
```
POST annotations
{ "subject": "Portal reply", "notetext": "…",
  "objectid_incident@odata.bind": "/incidents(<id>)",
  "filename": "screenshot.png", "mimetype": "image/png", "documentbody": "<base64>" }
```
Default attachment limit is 5 MB (admin-configurable up to 128 MB). Agents already work
from notes (624k rows) and emails (858k rows), so a note is what they will see.

**Update fields**: `PATCH incidents(<id>)` with header `If-Match: *` (prevents an
accidental create) and only the changed properties. Never PATCH `statecode` to
resolve a case; call the action:
```
POST CloseIncident
{ "IncidentResolution": { "subject": "Resolved by customer",
    "incidentid@odata.bind": "/incidents(<id>)" }, "Status": -1 }
```
Closing with `Status` 5 = Closed-Call or 1000 = Closed-Remote (both Resolved state).
Reopen: `PATCH incidents(<id>) { "statecode": 0, "statuscode": 696720000 }` (Open).

**Register / update a contact**: `POST contacts` then store the id. Upsert by email
(`PATCH contacts(emailaddress1='x')`) needs an **alternate key** on `emailaddress1`,
which the duplicates in the data will block until they are merged.

**Atomic multi-step** (case + first note): use `POST $batch` with one changeset;
reference the new case inside the changeset as `$1`.

**Agent-only actions** (run with the agent's delegated token):
```
PATCH incidents(<id>)  { "ownerid@odata.bind": "/systemusers(<userid>)" }        ← assign (or /teams(<id>))
POST  queues(<queueid>)/Microsoft.Dynamics.CRM.AddToQueue  { "Target": {"incidentid": "<id>", "@odata.type": "Microsoft.Dynamics.CRM.incident"} }   ← bound to the queue (verified 2026-10-13)
POST  queueitems(<queueitemid>)/Microsoft.Dynamics.CRM.PickFromQueue   { "SystemUser": {"systemuserid": "<userid>", "@odata.type": "Microsoft.Dynamics.CRM.systemuser"}, "RemoveQueueItem": false }   ← bound to the queue item; parameter names from $metadata (verified)
POST  queueitems(<queueitemid>)/Microsoft.Dynamics.CRM.ReleaseToQueue  {}   ← bound (verified)
POST  phonecalls       { "subject": "...", "description": "...", "directioncode": true, "regardingobjectid_incident@odata.bind": "/incidents(<id>)" }
POST  tasks            { "subject": "...", "regardingobjectid_incident@odata.bind": "/incidents(<id>)", "scheduledend": "2026-10-12T10:00:00Z" }
POST  k7_rfes          { "k7_rfetitle": "...", "k7_Case@odata.bind": "/incidents(<id>)", "k7_rfestatus": 696720001 }
```
Cancel: `PATCH incidents(<id>) { "statecode": 2, "statuscode": 6 }`. Merge: `POST Merge` (optional).

**Concurrency**: send the record's `@odata.etag` in `If-Match` on PATCH to get 412
instead of silently overwriting agent edits.

## 6. Events to the portal (status changes, agent replies)
Options, cheapest first:
1. Poll with change tracking (section 4) every 1–5 minutes.
2. Power Automate: "When a row is added, modified or deleted" on incident/annotation
   → HTTP POST to your backend (simple, needs a flow licence per owner).
3. Webhook: register a Service Endpoint (type Webhook) and an
   `sdkmessageprocessingstep` on incident Update / annotation Create with the Plugin
   Registration Tool; Dataverse POSTs the context JSON to your HTTPS endpoint.
Email notifications to customers can stay in Dynamics workflows either way.

## 7. Limits and resilience
- Service protection: 6,000 requests per 5-minute sliding window per user per web
  server, plus execution-time and concurrency caps; exceeding returns **429** with a
  `Retry-After` header. Honour it, add jittered backoff, never retry writes blindly.
- Entitlement: application users draw from the tenant's pooled Power Platform
  request capacity; check Admin center → Capacity after a load test.
- Page lists (25–50 rows), `$select` always, never `$expand` in lists, cache
  reference data (products, geography, option labels) for hours.
- Use `$batch` to cut round-trips; use `odata.include-annotations` instead of
  separate label lookups.

## 8. Security checklist
Certificate auth, secret in a vault, least-privilege role, backend row-level
filtering, allow-list of writable fields, HTML-sanitise KB content and note text,
rate-limit per portal user, correlation ids in logs, no PII in logs, data residency
(crm8 = India).

## 9. Licensing
- **Agents (phase 1)**: covered. They are licensed Dataverse users and the portal calls
  Dataverse as them; a custom front end for licensed users is a normal multiplexing case
  where the required licences already exist.
- **Customers (phase 2)**: unresolved, get it in writing. Public material is older than
  the current Power Pages model: Microsoft's licensing brief says multiplexing never
  reduces licences required, while the Dynamics 365 guides have historically allowed
  external customers to access data through portals without a per-user licence. Ask
  your Microsoft licensing partner specifically about *external customers using a
  custom (non-Power-Pages) portal that calls Dataverse through an application user*.
Sources: [Multiplexing brief (Oct 2023)](https://www.licensingschool.co.uk/wp-content/uploads/2024/03/Multiplexing-BriefENG-Oct-2023.docx),
[Dynamics 365 Licensing Guide (2019, external users clause)](https://www.licensingschool.co.uk/wp-content/uploads/2019/06/Dynamics365LicensingGuide-June-2019.pdf),
[Portal licensing community thread](https://powerusers.microsoft.com/t5/Power-Apps-Portals/Portal-Licensing/m-p/1190687),
[Dataverse API limits](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/api-limits),
[API limits overview](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/api-limits-overview).

## 10. What is being replaced
The only Power Pages site is a 2019 marketing "Event Portal" (1 identity, 5 comments);
there is no customer support portal to migrate. Support staff (65 licensed users) work
in the model-driven app "Dynamics 365 Mobile – custom" and Customer Service Hub.

Decision (2026-10-10): one product for both audiences, agents first. Phase 1 uses the
delegated path (§2a, §4a) and needs no new security role; phase 2 adds the
application user (§2b) and the customer filters. Keep the mobile app and Customer
Service Hub available until phase 1 reaches parity with the sitemap in
`01-requirements.md` §4.2.
