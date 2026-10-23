import type { GlobalConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* The partner portal's configuration (docs/partner-portal/02-build-plan.md §5, decisions 5, 8, 10, 15): who on K7's side holds
   which role, the programme's regions and terms, the deal protection periods and the certificate gate (off until M11), the CRM
   mirror's defaults and the notification sender. Read by `src/lib/partner/settings.ts`; Payload admins edit the raw form here.
   Nothing in it is written to Dynamics. */

export const STAFF_ROLE_OPTIONS = [
  { label: 'Channel Manager', value: 'channelManager' },
  { label: 'Deal Desk Approver', value: 'dealDeskApprover' },
  { label: 'Training Admin', value: 'trainingAdmin' },
  { label: 'Marketing Admin', value: 'marketingAdmin' },
  { label: 'Scheme Admin', value: 'schemeAdmin' },
]

export const PARTNER_TYPE_OPTIONS = [
  { label: 'Distributor', value: 'distributor' },
  { label: 'Integration Partner', value: 'integrationPartner' },
  { label: 'Value Added Reseller', value: 'var' },
  { label: 'Managed Service Provider', value: 'msp' },
]

export const PartnerSettings: GlobalConfig = {
  slug: 'partner-settings',
  label: 'Partner portal settings',
  access: { read: roleAccess('admin'), update: roleAccess('admin') },
  admin: { group: 'Partner portal', description: 'K7 staff roles, the programme, deal protection, the CRM mirror and notifications. Read by the portal; this is the raw form.' },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Staff',
          fields: [
            {
              name: 'staff',
              type: 'array',
              labels: { singular: 'Person', plural: 'People' },
              admin: { description: 'K7 people who open /partners/portal/k7 after signing in with Microsoft, by work email, with the roles they hold (one person, several roles).' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'email', type: 'email', required: true, admin: { width: '40%' } },
                    { name: 'name', type: 'text', admin: { width: '20%' } },
                    { name: 'roles', type: 'select', hasMany: true, options: STAFF_ROLE_OPTIONS, required: true, admin: { width: '25%' } },
                    { name: 'manager', type: 'email', admin: { width: '15%', description: 'Told when an approval SLA is breached (M8).' } },
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'channelManagersApproveDeals', type: 'checkbox', defaultValue: true, admin: { width: '50%', description: 'Channel Managers also act as Deal Desk Approvers.' } },
                { name: 'marketingAdminsRunSchemes', type: 'checkbox', defaultValue: true, admin: { width: '50%', description: 'Marketing Admins also act as Scheme Admins.' } },
              ],
            },
            { name: 'devStaffPass', type: 'checkbox', defaultValue: true, admin: { description: 'Development sign-ins (the probe door) hold every role. Ignored in production builds.' } },
          ],
        },
        {
          label: 'Programme',
          fields: [
            {
              name: 'partnerTypes',
              type: 'select',
              hasMany: true,
              options: PARTNER_TYPE_OPTIONS,
              defaultValue: ['distributor', 'integrationPartner', 'var'],
              admin: { description: 'The types a company can apply as. MSP stays off until the author confirms it (decision 6).' },
            },
            {
              name: 'regions',
              type: 'array',
              labels: { singular: 'Region', plural: 'Regions' },
              admin: { description: 'The K7 regions a partner can say it operates in (FR-REG-02).' },
              fields: [{ type: 'row', fields: [{ name: 'code', type: 'text', required: true, admin: { width: '30%' } }, { name: 'name', type: 'text', required: true, admin: { width: '70%' } }] }],
            },
            {
              name: 'terms',
              type: 'group',
              fields: [
                { type: 'row', fields: [{ name: 'version', type: 'text', defaultValue: '2026-10', required: true, admin: { width: '30%', description: 'Stored on every application with the acceptance time (FR-REG-04).' } }, { name: 'url', type: 'text', admin: { width: '70%', description: 'Where the programme terms are published.' } }] },
              ],
            },
          ],
        },
        {
          label: 'Deals',
          fields: [
            {
              name: 'deals',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'protectionDays', type: 'number', min: 1, defaultValue: 90, required: true, admin: { width: '33%', description: 'Deal protection from approval.' } },
                    { name: 'extensionDays', type: 'number', min: 1, defaultValue: 90, required: true, admin: { width: '33%', description: 'One extension per deal (decision 15).' } },
                    { name: 'approvalSlaHours', type: 'number', min: 1, defaultValue: 48, required: true, admin: { width: '34%', description: 'Working hours for a decision on a deal, an extension or an application before the breach notice (M8; the hours are on the SLA tab).' } },
                  ],
                },
                { name: 'endingNoticeDays', type: 'number', min: 1, defaultValue: 14, admin: { description: 'Days before the protection ends at which the partner and the approvers are told (FR-NTF-01 "protection ending"; the sweep sends it once).' } },
                {
                  type: 'row',
                  fields: [
                    { name: 'requireCertificate', type: 'checkbox', defaultValue: false, admin: { width: '50%', description: 'FR-DEAL-01: a deal needs a certified organisation. Off until the LMS exists (M11, decision 8).' } },
                    { name: 'conflictCheckCrm', type: 'checkbox', defaultValue: false, admin: { width: '50%', description: 'Also look for the end customer in the CRM when checking conflicts (03-dynamics-exploration.md §7). Off: portal deals only.' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Collateral',
          fields: [
            {
              name: 'collateral',
              type: 'group',
              admin: { description: 'The collateral library (01-requirements.md §6). Items and files are edited in Partner portal → Collateral; this is the rule.' },
              fields: [{ name: 'maxMb', type: 'number', min: 1, max: 200, defaultValue: 200, admin: { description: 'FR-MKT-02: the largest file a Marketing Admin can upload, in MB. The server accepts 200 at most.' } }],
            },
          ],
        },
        {
          label: 'Schemes',
          fields: [
            {
              name: 'schemes',
              type: 'group',
              admin: { description: 'Incentive schemes (01-requirements.md §9). Schemes are edited in Partner portal → Schemes; registrations, results and payouts on the partner desk.' },
              fields: [{ name: 'disputeDays', type: 'number', min: 0, defaultValue: 14, admin: { description: 'FR-ELG-05: days after the results are published in which a partner may raise a dispute. A scheme may set its own.' } }],
            },
          ],
        },
        {
          label: 'CRM mirror',
          fields: [
            {
              name: 'crm',
              type: 'group',
              admin: { description: 'What the outbox writes to Dynamics on approval (decisions 2, 10, 19). Off: the jobs queue as pending and nothing reaches the CRM. UAT only; production is read-only in code.' },
              fields: [
                { name: 'enabled', type: 'checkbox', defaultValue: false },
                {
                  type: 'row',
                  fields: [
                    { name: 'ownerRule', type: 'select', options: [{ label: 'The approving Channel Manager', value: 'approver' }, { label: 'A fixed owner', value: 'fixed' }], defaultValue: 'approver', admin: { width: '40%' } },
                    { name: 'ownerId', type: 'text', admin: { width: '60%', description: 'systemuserid for the fixed owner.' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'enquirySource', type: 'number', defaultValue: 1, admin: { width: '33%', description: 'alletec_enquirysource (1 = Partner Referral).' } },
                    { name: 'productCategory', type: 'number', defaultValue: 36, admin: { width: '33%', description: 'alletec_productcategory until the product has its own value (36 = Others).' } },
                    { name: 'accountNamePattern', type: 'text', defaultValue: '{customer}-Fresh-{product}', admin: { width: '34%', description: 'Opportunity name; {customer} and {product} are replaced.' } },
                  ],
                },
                { name: 'syncMinutes', type: 'number', min: 5, defaultValue: 60, admin: { description: 'The dashboard read-back (FR-DASH-05): POST /api/partners/sync runs at most this often unless forced; the scheduler may call it more frequently. Default 60.' } },
              ],
            },
          ],
        },
        {
          label: 'Notifications',
          fields: [
            {
              name: 'notify',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'emailEnabled', type: 'checkbox', defaultValue: true, admin: { width: '30%', description: 'Email beside the bell. Mail still goes only through SMTP_URL and the allowlist.' } },
                    { name: 'mailFrom', type: 'text', defaultValue: 'K7 Partner Programme <partners@k7computing.com>', admin: { width: '70%' } },
                  ],
                },
                { name: 'bellRetentionDays', type: 'number', min: 7, defaultValue: 180, admin: { description: 'Read notifications older than this are removed by the daily digest pass (M8).' } },
                { name: 'signature', type: 'textarea', defaultValue: 'K7 Partner Programme\nK7 Computing Pvt Ltd', admin: { description: 'The closing lines of every email.' } },
              ],
            },
          ],
        },
        {
          label: 'SLA',
          fields: [
            {
              name: 'sla',
              type: 'group',
              admin: { description: 'The approval SLA (FR-NTF-01, M8): the working hours the decision target counts in, when a queue row is at risk, and who else is told on a breach. The target itself is Deals → approvalSlaHours.' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'mode', type: 'select', options: [{ label: 'Working hours', value: 'business' }, { label: 'Around the clock', value: 'always' }], defaultValue: 'business', admin: { width: '25%' } },
                    { name: 'start', type: 'text', defaultValue: '09:00', admin: { width: '20%', description: 'HH:MM' } },
                    { name: 'end', type: 'text', defaultValue: '18:00', admin: { width: '20%', description: 'HH:MM' } },
                    { name: 'timeZone', type: 'text', defaultValue: 'Asia/Kolkata', admin: { width: '35%' } },
                  ],
                },
                { name: 'days', type: 'select', hasMany: true, options: [{ label: 'Monday', value: '1' }, { label: 'Tuesday', value: '2' }, { label: 'Wednesday', value: '3' }, { label: 'Thursday', value: '4' }, { label: 'Friday', value: '5' }, { label: 'Saturday', value: '6' }, { label: 'Sunday', value: '0' }], defaultValue: ['1', '2', '3', '4', '5', '6'] },
                { name: 'warnShare', type: 'number', min: 0.1, max: 0.95, defaultValue: 0.75, admin: { description: 'The share of the target after which a queue row reads “at risk” (0.75 = three quarters).' } },
                { name: 'escalateTo', type: 'array', labels: { singular: 'Address', plural: 'Addresses' }, admin: { description: 'Told by email on every breach, beside the approvers and their managers.' }, fields: [{ name: 'email', type: 'email', required: true }] },
              ],
            },
          ],
        },
      ],
    },
  ],
}
