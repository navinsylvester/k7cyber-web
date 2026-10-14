# Entra ID setup, step by step

You (Navin) can approve these yourself. Do everything first for **UAT** (`k7crmuat`); repeat for
production only at go-live. Every value you collect goes into `.env` (dev) or the
hosting secret store (never into git). Names below are suggestions; keep them if you
can so the docs stay accurate.

Tenant (workforce): `005ef94f-7dbd-4d0e-a29a-494e2a63d911` ("K7 Computing Private Limited").
Dataverse: UAT `https://k7crmuat.crm8.dynamics.com` (the development environment since
2026-10-12, see §C), production `https://k7crm.crm8.dynamics.com`.

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
   DATAVERSE_URL=https://k7crmuat.crm8.dynamics.com
   ```
For production create a second registration `… (Prod)` with the production redirect URI;
only `DATAVERSE_URL` and the two AUTH values change.

## B. Dataverse service app (phase 2) — "K7 Support Portal – Service (Dev)"
1. App registrations → New registration, name `K7 Support Portal – Service (Dev)`, single
   tenant, **no redirect URI**. Register; copy the client id → `DATAVERSE_CLIENT_ID`.
2. Certificates & secrets → upload a certificate (preferred) or create a secret →
   `DATAVERSE_CLIENT_SECRET`. No API permissions are needed for client-credentials
   access to Dataverse; the application user below carries the rights.
3. Open https://admin.powerplatform.microsoft.com → Environments → **K7 Computing Private Limited UAT** → Settings → Users + permissions → **Application users** → New app user
   → Add an app → pick the registration → Business unit: root → Security roles: for the
   first smoke test **System Customizer** is enough; before customer traffic replace it
   with the custom role from `07-production-safety.md` §4.
4. `.env`:
   ```
   DATAVERSE_TENANT_ID=005ef94f-7dbd-4d0e-a29a-494e2a63d911
   DATAVERSE_CLIENT_ID=<client id>
   DATAVERSE_CLIENT_SECRET=<secret>
   ```

## C. The development environment: UAT (decided 2026-10-12)
The planned Minimal-copy sandbox cannot be created while the tenant is over its Dataverse database
entitlement (47.5 GB entitled, 49.2 GB used on 2026-10-12), so the existing Sandbox-type org
**K7 Computing Private Limited UAT** (`https://k7crmuat.crm8.dynamics.com`, environment id
`eef7bfef-083f-4817-854a-e4a34abe0a74`) is the development environment. It is shared with the CRM
admin; the rules are in `07-production-safety.md` §1c. What was done on 2026-10-12, and how to
repeat it after the CRM admin changes production:
1. `python3 -I scripts/dataverse-schema-sync.py --target https://k7crmuat.crm8.dynamics.com --dry-run`,
   then without `--dry-run`: copies the support schema from production into UAT and publishes it.
2. `python3 -I scripts/dataverse-uat-automation.py --target … --pause`: turns the case/email/note/account
   workflows, the customer email flow, the autonumber plugin steps and the mail profiles off.
3. `python3 -I scripts/dataverse-seed.py --target … --since 2026-09-28` (dry run first).
4. `python3 -I scripts/dataverse-uat-automation.py --target … --resume`: everything back on except the
   customer-facing items, which stay off.
5. Your user is System Administrator in UAT already; the 65 agents are enabled there with the same
   UPNs as in production. Add testers as needed under Settings → Users + permissions.
If capacity is bought later: create the sandbox as originally planned (New → Sandbox, India, no
sample data → Copy from production → Minimal copy), then run the same three scripts against it.

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
