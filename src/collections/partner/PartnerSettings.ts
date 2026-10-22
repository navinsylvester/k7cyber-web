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
                    { name: 'name', type: 'text', admin: { width: '25%' } },
                    { name: 'roles', type: 'select', hasMany: true, options: STAFF_ROLE_OPTIONS, required: true, admin: { width: '35%' } },
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
                    { name: 'approvalSlaHours', type: 'number', min: 1, defaultValue: 48, required: true, admin: { width: '34%', description: 'Working hours for a decision before the breach notice (M8).' } },
                  ],
                },
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
                { name: 'bellRetentionDays', type: 'number', min: 7, defaultValue: 180, admin: { description: 'Read notifications older than this are swept (M8).' } },
              ],
            },
          ],
        },
      ],
    },
  ],
}
