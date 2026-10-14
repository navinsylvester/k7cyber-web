import type { GlobalConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* Support KPIs and SLA targets, configured by service managers from the portal (/support/workspace/manage/kpis) and stored here,
   not in Dataverse: phase 1 makes no schema changes to the CRM (docs/support-portal/09-portal-guide.md §4c).
   The portal reads and writes this global through the local API with access overridden; Payload admins can edit it too. */

export const PRIORITY_OPTIONS = [
  { label: 'Any priority', value: 'any' },
  { label: 'Critical', value: '696720000' },
  { label: 'High', value: '1' },
  { label: 'Medium', value: '2' },
  { label: 'Low', value: '3' },
]
export const VERTICAL_OPTIONS = [
  { label: 'Any vertical', value: 'any' },
  { label: 'Consumer', value: '100000000' },
  { label: 'Business Security', value: '100000001' },
  { label: 'Enterprise', value: '100000002' },
  { label: 'Pro32', value: '767340001' },
]
export const ORIGIN_OPTIONS = [
  { label: 'Any origin', value: 'any' },
  { label: 'Phone', value: '1' },
  { label: 'Email', value: '2' },
  { label: 'Web', value: '3' },
  { label: 'Chat', value: '696720000' },
]
export const KPI_OPTIONS = [
  { label: 'Resolution within target (%)', value: 'resolution-sla' },
  { label: 'First response within target (%)', value: 'response-sla' },
  { label: 'Median resolution time (working hours)', value: 'median-resolution' },
  { label: 'Median first response (working minutes)', value: 'median-response' },
  { label: 'First-contact resolution (%)', value: 'fcr' },
  { label: 'Resolved per engineer per working day', value: 'throughput' },
  { label: 'Active backlog (cases)', value: 'backlog' },
  { label: 'Active cases past target', value: 'breached-open' },
  { label: 'Active cases at risk', value: 'at-risk' },
  { label: 'Reopened cases (%)', value: 'reopen-rate' },
  { label: 'Oldest active case (working hours)', value: 'oldest-open' },
]
export const RULE_OPTIONS = [
  { label: 'At risk and not owned by an engineer', value: 'unowned-at-risk' },
  { label: 'At risk: remind the owner', value: 'nudge-at-risk' },
  { label: 'Past target: escalate', value: 'escalate-breach' },
  { label: 'No activity for too long', value: 'stale' },
  { label: 'Waiting on the customer for too long', value: 'waiting-followup' },
]
export const ACTION_OPTIONS = [
  { label: 'Flag on the board only', value: 'flag' },
  { label: 'Internal note on the case', value: 'note' },
  { label: 'Add to a queue', value: 'queue' },
  { label: 'Email the owner', value: 'email-owner' },
  { label: 'Email the managers', value: 'email-managers' },
]

export const SupportSettings: GlobalConfig = {
  slug: 'support-settings',
  label: 'Support KPIs and SLAs',
  access: { read: roleAccess('admin'), update: roleAccess('admin') },
  admin: { group: 'Support portal', description: 'Targets, business hours, KPI cards and prevention rules for the manager view. Edited from the portal; this is the raw form.' },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Targets',
          fields: [
            {
              name: 'targets',
              type: 'array',
              labels: { singular: 'Target', plural: 'Targets' },
              admin: { description: 'Working minutes to first response and to resolution. The most specific row that matches a case wins (vertical, then priority, then origin).' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'vertical', type: 'select', options: VERTICAL_OPTIONS, defaultValue: 'any', required: true, admin: { width: '25%' } },
                    { name: 'priority', type: 'select', options: PRIORITY_OPTIONS, defaultValue: 'any', required: true, admin: { width: '25%' } },
                    { name: 'origin', type: 'select', options: ORIGIN_OPTIONS, defaultValue: 'any', required: true, admin: { width: '20%' } },
                    { name: 'responseMinutes', type: 'number', min: 1, required: true, defaultValue: 60, admin: { width: '15%' } },
                    { name: 'resolveMinutes', type: 'number', min: 1, required: true, defaultValue: 240, admin: { width: '15%' } },
                  ],
                },
              ],
            },
            { name: 'warnAtPercent', type: 'number', min: 10, max: 99, defaultValue: 75, admin: { description: 'A case is "at risk" once this share of its target has elapsed.' } },
            { name: 'phoneCountsAsResponded', type: 'checkbox', defaultValue: true, admin: { description: 'Phone-origin cases are answered on the call: count them as responded at creation.' } },
            { name: 'pauseWhileWaiting', type: 'checkbox', defaultValue: true, admin: { description: 'Cases In Progress-Customer are paused: never at risk, excluded from response/resolution timing while waiting.' } },
            { name: 'subtractOnHold', type: 'checkbox', defaultValue: true, admin: { description: "Subtract Dataverse's on-hold minutes (onholdtime) from the elapsed time." } },
          ],
        },
        {
          label: 'Business hours',
          fields: [
            {
              name: 'hours',
              type: 'group',
              fields: [
                { name: 'mode', type: 'select', options: [{ label: 'Business hours', value: 'business' }, { label: 'Around the clock', value: 'always' }], defaultValue: 'business', required: true },
                {
                  type: 'row',
                  fields: [
                    { name: 'start', type: 'text', defaultValue: '09:00', required: true, admin: { width: '30%', description: 'HH:MM' } },
                    { name: 'end', type: 'text', defaultValue: '18:00', required: true, admin: { width: '30%', description: 'HH:MM' } },
                    { name: 'timeZone', type: 'text', defaultValue: 'Asia/Kolkata', required: true, admin: { width: '40%' } },
                  ],
                },
                {
                  name: 'days',
                  type: 'select',
                  hasMany: true,
                  defaultValue: ['1', '2', '3', '4', '5', '6'],
                  options: [
                    { label: 'Monday', value: '1' },
                    { label: 'Tuesday', value: '2' },
                    { label: 'Wednesday', value: '3' },
                    { label: 'Thursday', value: '4' },
                    { label: 'Friday', value: '5' },
                    { label: 'Saturday', value: '6' },
                    { label: 'Sunday', value: '0' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'KPI cards',
          fields: [
            {
              name: 'kpis',
              type: 'array',
              labels: { singular: 'KPI', plural: 'KPIs' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'key', type: 'select', options: KPI_OPTIONS, required: true, admin: { width: '50%' } },
                    { name: 'enabled', type: 'checkbox', defaultValue: true, admin: { width: '15%' } },
                    { name: 'target', type: 'number', admin: { width: '35%', description: 'Blank = no target, the card only reports.' } },
                  ],
                },
              ],
            },
            { name: 'defaultPeriod', type: 'select', options: [{ label: '7 days', value: '7d' }, { label: '30 days', value: '30d' }, { label: '90 days', value: '90d' }, { label: 'Month to date', value: 'mtd' }], defaultValue: '30d' },
          ],
        },
        {
          label: 'Prevention',
          fields: [
            {
              name: 'rules',
              type: 'array',
              labels: { singular: 'Rule', plural: 'Rules' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'key', type: 'select', options: RULE_OPTIONS, required: true, admin: { width: '40%' } },
                    { name: 'enabled', type: 'checkbox', defaultValue: true, admin: { width: '15%' } },
                    { name: 'thresholdMinutes', type: 'number', min: 0, admin: { width: '20%', description: 'Minutes left (at-risk rules) or minutes since last activity (stale, waiting).' } },
                    { name: 'cooldownHours', type: 'number', min: 1, defaultValue: 8, admin: { width: '25%', description: 'Do not act on the same case again for this long.' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'actions', type: 'select', hasMany: true, options: ACTION_OPTIONS, defaultValue: ['flag'], admin: { width: '50%' } },
                    { name: 'queueId', type: 'text', admin: { width: '50%', description: 'Dataverse queue id for the "Add to a queue" action.' } },
                  ],
                },
              ],
            },
            {
              name: 'sweep',
              type: 'group',
              fields: [
                { name: 'enabled', type: 'checkbox', defaultValue: true, admin: { description: 'The scheduled sweep (POST /api/support/sla/sweep with the cron secret) evaluates the rules.' } },
                { name: 'live', type: 'checkbox', defaultValue: false, admin: { description: 'Off: the sweep only records what it would do. On: it writes notes, queues items and sends mail (UAT only; production is read-only in code).' } },
                { name: 'managerEmails', type: 'text', admin: { description: 'Comma-separated recipients for "Email the managers".' } },
              ],
            },
          ],
        },
        {
          label: 'Access',
          fields: [
            {
              name: 'managerRoles',
              type: 'array',
              labels: { singular: 'Role', plural: 'Roles' },
              admin: { description: 'Dataverse security roles that open the manager view.' },
              fields: [{ name: 'name', type: 'text', required: true }],
            },
            {
              name: 'managers',
              type: 'array',
              labels: { singular: 'Manager', plural: 'Managers' },
              admin: { description: 'Agents who open the manager view regardless of role (work email).' },
              fields: [{ name: 'email', type: 'email', required: true }],
            },
          ],
        },
      ],
    },
  ],
}
