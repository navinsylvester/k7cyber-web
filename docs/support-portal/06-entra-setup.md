# Entra ID setup, step by step

You (Navin) can approve these yourself. Do everything first for the **Portal Dev sandbox**; repeat for
production only at go-live. Every value you collect goes into `.env` (dev) or the
hosting secret store (never into git). Names below are suggestions; keep them if you
can so the docs stay accurate.

Tenant (workforce): `005ef94f-7dbd-4d0e-a29a-494e2a63d911` ("K7 Computing Private Limited").
Dataverse: Portal Dev sandbox `https://<name>.crm8.dynamics.com` (created in §C), production
`https://k7crm.crm8.dynamics.com`. The old UAT (`k7crmuat`) is not used.

## A. Agent sign-in app (phase 1) — "K7 Support Portal – Agents (Dev)"
1. Open https://entra.microsoft.com → Identity → Applications → **App registrations** → New registration.
2. Name `K7 Support Portal – Agents (Dev)`. Supported account types: **Accounts in this
   organizational directory only**. Redirect URI: platform **Web**, value
   `http://localhost:3000/api/auth/callback/microsoft-entra-id`. Register.
3. Overview page: copy **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_ID_ID`, and
   **Directory (tenant) ID** (= the tenant above).
4. Authentication → Add URI for the deployed site later
   (`https://<site>/api/auth/callback/microsoft-entra-id`). Leave implicit grant off.
5. Certificates & secrets → New client secret, 12 months → copy the **Value** once →
   `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
6. API permissions → Add a permission → **Dynamics CRM** → Delegated → `user_impersonation`
   → Add. Also add Microsoft Graph delegated `openid`, `profile`, `email`, `offline_access`
   if they are not listed. Then **Grant admin consent for K7 Computing** → Yes.
7. (Optional, recommended) Enterprise applications → the same app → Properties →
   **Assignment required = Yes**, then Users and groups → add the support team group.
   Without this, any employee can sign in to the portal (Dataverse would still refuse
   them if they have no licence/role, but the door is nicer shut).
8. Result in `.env`:
   ```
   AUTH_MICROSOFT_ENTRA_ID_ID=<client id>
   AUTH_MICROSOFT_ENTRA_ID_SECRET=<secret value>
   AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/005ef94f-7dbd-4d0e-a29a-494e2a63d911/v2.0
   DATAVERSE_URL=https://<sandbox>.crm8.dynamics.com
   ```
For production create a second registration `… (Prod)` with the production redirect URI;
only `DATAVERSE_URL` and the two AUTH values change.

## B. Dataverse service app (phase 2) — "K7 Support Portal – Service (Dev)"
1. App registrations → New registration, name `K7 Support Portal – Service (Dev)`, single
   tenant, **no redirect URI**. Register; copy the client id → `DATAVERSE_CLIENT_ID`.
2. Certificates & secrets → upload a certificate (preferred) or create a secret →
   `DATAVERSE_CLIENT_SECRET`. No API permissions are needed for client-credentials
   access to Dataverse; the application user below carries the rights.
3. Open https://admin.powerplatform.microsoft.com → Environments → **the Portal Dev sandbox** → Settings → Users + permissions → **Application users** → New app user
   → Add an app → pick the registration → Business unit: root → Security roles: for the
   first smoke test **System Customizer** is enough; before customer traffic replace it
   with the custom role from `07-production-safety.md` §4.
4. `.env`:
   ```
   DATAVERSE_TENANT_ID=005ef94f-7dbd-4d0e-a29a-494e2a63d911
   DATAVERSE_CLIENT_ID=<client id>
   DATAVERSE_CLIENT_SECRET=<secret>
   ```

## C. The Portal Dev sandbox (needed now, before any coding)
Needs a **Power Platform administrator** (or Dynamics 365 administrator). If the New
button below is missing for you, ask the tenant admin to do this part.
1. https://admin.powerplatform.microsoft.com → **Manage → Environments** → **New**.
   Name `K7 CRM – Portal Dev`, region **India**, type **Sandbox**, "Add a Dataverse data
   store" **Yes**, security group: the support team group (optional), sample apps/data
   **No**. Create; wait until it shows Ready. Note its URL (`https://<name>.crm8.dynamics.com`).
2. Open the **production** environment (K7 Computing Private Limited) → **Copy** → Target
   environment: `K7 CRM – Portal Dev` → **Minimal copy (customizations and schema only)**
   → Copy. Confirm the overwrite warning (the target is the new, empty sandbox).
3. When the copy finishes the sandbox is in **Administration mode** with background
   operations off. Keep it that way until: Settings → Email → Mailboxes: no mailbox is
   approved/tested for server-side sync; Settings → Customizations → Plug-in trace / steps
   that send SMS or email are reviewed; Flows (make.powerautomate.com, this environment)
   that notify customers are turned off. Then Settings → Administration mode → off.
4. Settings → Users + permissions → Users → confirm your user is **System Administrator**
   here; add the support leads who will test as System Customizer or their normal roles.
5. Seed it (`07-production-safety.md` §1), then set `DATAVERSE_URL` and `DV_ORG_URL` in
   `.env` to the sandbox URL.

## D. Customer identity (phase 2) — Entra External ID tenant
1. https://entra.microsoft.com → Identity → Overview → **Manage tenants** → Create →
   **External** tenant (customer identity and access management). Name
   `K7 Customers`, domain `k7customers` (becomes `k7customers.onmicrosoft.com`),
   location India / Asia Pacific. Creation takes a few minutes.
2. Switch to the new tenant → External Identities → **User flows** → New: name
   `SupportPortalSignUpSignIn`, identity provider **Email with one-time passcode**,
   user attributes: Display name, Email (add Mobile later if you want OTP by SMS).
3. In the external tenant → App registrations → New: `K7 Support Portal – Customers`,
   account type **Accounts in this organizational directory only** (that is, this
   external tenant), redirect URI Web
   `http://localhost:3000/api/auth/callback/customer` and the production one later.
   Secret as above. API permissions: `openid`, `offline_access`, `profile`, `email`
   (Microsoft Graph delegated) → grant admin consent.
4. User flows → the flow → Applications → add this app.
5. `.env`:
   ```
   AUTH_CUSTOMER_ISSUER=https://k7customers.ciamlogin.com/<external tenant id>/v2.0
   AUTH_CUSTOMER_ID=<client id>
   AUTH_CUSTOMER_SECRET=<secret>
   ```
Branding (logo, colours, text) is under Company branding in the external tenant; the
hosted sign-in page cannot use the K7 design system, so keep it minimal and let the
site own everything after the redirect.

## E. Checklist before phase 1 goes to production
- Production registrations created, consent granted, assignment required = Yes.
- Secrets in the hosting secret store, rotated yearly; the Dev secrets deleted.
- Conditional access reviewed: MFA for the support team applies to the portal
  automatically because it is the same Entra sign-in.
