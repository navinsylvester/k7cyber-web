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
  { label: 'Follow-ups answered within target (%)', value: 'followup-sla' },
  { label: 'Picked up from the bin within target (%)', value: 'pickup-sla' },
  { label: 'Lab samples closed within target (%)', value: 'lab-sla' },
  { label: 'Median resolution time (working hours)', value: 'median-resolution' },
  { label: 'Median first response (working minutes)', value: 'median-response' },
  { label: 'First-contact resolution (%)', value: 'fcr' },
  { label: 'Resolved per engineer per working day', value: 'throughput' },
  { label: 'Active backlog (cases)', value: 'backlog' },
  { label: 'Active cases past target', value: 'breached-open' },
  { label: 'Active cases at risk', value: 'at-risk' },
  { label: 'Reopened cases (%)', value: 'reopen-rate' },
  { label: 'Oldest active case (working hours)', value: 'oldest-open' },
  { label: 'Customer satisfaction (%)', value: 'csat' },
  { label: 'Average rating (of 5)', value: 'csat-average' },
  { label: 'Survey response rate (%)', value: 'csat-response-rate' },
  { label: 'Unhappy customers awaiting follow-up', value: 'csat-unhappy' },
  { label: 'Unhappy customers contacted within target (%)', value: 'csat-followup' },
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
  admin: { group: 'Support portal', description: 'SLA targets, shifts, KPI cards and notifications for the manager view. Edited from the portal; this is the raw form.' },
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
                {
                  type: 'row',
                  fields: [
                    { name: 'followUpMinutes', type: 'number', min: 1, defaultValue: 30, admin: { width: '33%', description: 'Follow-up reply (working minutes).' } },
                    { name: 'pickupMinutes', type: 'number', min: 1, defaultValue: 5, admin: { width: '33%', description: 'Pick-up from the bin.' } },
                    { name: 'labMinutes', type: 'number', min: 1, defaultValue: 180, admin: { width: '34%', description: 'Lab sample.' } },
                  ],
                },
              ],
            },
            { name: 'warnAtPercent', type: 'number', min: 10, max: 99, defaultValue: 75, admin: { description: 'A case is "at risk" once this share of its target has elapsed.' } },
            { name: 'phoneCountsAsResponded', type: 'checkbox', defaultValue: true, admin: { description: 'Phone-origin cases are answered on the call: count them as responded at creation.' } },
            { name: 'pauseWhileWaiting', type: 'checkbox', defaultValue: true, admin: { description: 'Cases In Progress-Customer are paused: never at risk, excluded from response/resolution timing while waiting.' } },
            { name: 'subtractOnHold', type: 'checkbox', defaultValue: true, admin: { description: "Subtract Dataverse's on-hold minutes (onholdtime) from the elapsed time." } },
            { name: 'automatedSubjects', type: 'textarea', admin: { description: 'One per line: outgoing emails whose subject starts with one of these are automatic and never answer the customer.' } },
          ],
        },
        {
          label: 'Shifts',
          fields: [
            {
              name: 'hours',
              type: 'group',
              fields: [
                { name: 'mode', type: 'select', options: [{ label: 'Shift hours', value: 'business' }, { label: 'Around the clock', value: 'always' }], defaultValue: 'business', required: true },
                { name: 'timeZone', type: 'text', defaultValue: 'Asia/Kolkata', required: true },
                {
                  name: 'shifts',
                  type: 'array',
                  labels: { singular: 'Shift', plural: 'Shifts' },
                  admin: { description: 'The desk works the union of its shifts; every SLA clock counts only those minutes. An overnight shift ends after midnight (end before start).' },
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'key', type: 'text', admin: { width: '20%' } },
                        { name: 'name', type: 'text', required: true, admin: { width: '30%' } },
                        { name: 'start', type: 'text', required: true, admin: { width: '25%', description: 'HH:MM' } },
                        { name: 'end', type: 'text', required: true, admin: { width: '25%', description: 'HH:MM' } },
                      ],
                    },
                    {
                      name: 'days',
                      type: 'select',
                      hasMany: true,
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
                    { name: 'members', type: 'textarea', admin: { description: 'Work emails of the engineers on this shift, one per line.' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'start', type: 'text', defaultValue: '09:00', admin: { width: '50%', description: 'Before 2026-11-27: the one business-hours window. Read only when no shift is set.' } },
                    { name: 'end', type: 'text', defaultValue: '18:00', admin: { width: '50%' } },
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
          label: 'Notifications',
          fields: [
            {
              name: 'notify',
              type: 'group',
              admin: { description: 'What the workspace tells people (09-portal-guide.md §4g). Edited from /support/workspace/manage/notifications.' },
              fields: [
                { name: 'enabled', type: 'checkbox', defaultValue: true },
                {
                  type: 'row',
                  fields: [
                    { name: 'kpiPeriod', type: 'text', defaultValue: '7d', admin: { width: '33%', description: '7d, 30d, 90d or mtd.' } },
                    { name: 'retentionDays', type: 'number', min: 1, max: 365, defaultValue: 30, admin: { width: '33%', description: 'Days a read notification is kept.' } },
                  ],
                },
                { name: 'managers', type: 'textarea', admin: { description: 'Who "Managers" means for notifications: work emails, one per line. Empty: the manager view’s list.' } },
                {
                  name: 'rules',
                  type: 'array',
                  labels: { singular: 'Notification', plural: 'Notifications' },
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'key', type: 'text', required: true, admin: { width: '40%' } },
                        { name: 'audiences', type: 'text', admin: { width: '35%', description: 'owner, shift, managers' } },
                        { name: 'delivery', type: 'text', admin: { width: '25%', description: 'immediate, digest, bell or off' } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Prevention (before 2026-11-27)',
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
                { name: 'enabled', type: 'checkbox', defaultValue: true, admin: { description: 'The scheduled sweep (POST /api/support/sla/sweep with the cron secret) runs the CSAT pass: surveys, reminders, overdue follow-ups.' } },
                { name: 'live', type: 'checkbox', defaultValue: false, admin: { description: 'Off: the CSAT pass only counts what it would send. On: it emails surveys and reminders to customers.' } },
                { name: 'managerEmails', type: 'text', admin: { description: 'Before 2026-11-27. Now Notifications → managers.' } },
              ],
            },
          ],
        },
        {
          label: 'CSAT',
          fields: [
            {
              name: 'csat',
              type: 'group',
              admin: { description: 'The satisfaction survey on resolved cases, the follow-up of low scores and the care band agents see beside a customer (09-portal-guide.md §4d).' },
              fields: [
                { name: 'enabled', type: 'checkbox', defaultValue: true, admin: { description: 'Show the survey to customers and the CSAT pages to managers.' } },
                {
                  type: 'row',
                  fields: [
                    { name: 'satisfiedFrom', type: 'number', min: 2, max: 5, defaultValue: 4, admin: { width: '33%', description: 'Scores from here up count as satisfied.' } },
                    { name: 'unhappyAtOrBelow', type: 'number', min: 1, max: 4, defaultValue: 2, admin: { width: '33%', description: 'Scores up to here open a follow-up.' } },
                    { name: 'followUpMinutes', type: 'number', min: 15, defaultValue: 240, admin: { width: '34%', description: 'Working minutes to contact an unhappy customer.' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'inviteMode', type: 'select', options: [{ label: 'Never (portal ratings only)', value: 'off' }, { label: 'Cases raised through the portal', value: 'portal' }, { label: 'Every resolved case with an email', value: 'all' }], defaultValue: 'portal', admin: { width: '50%', description: 'Which resolved cases the sweep emails a survey to.' } },
                    { name: 'inviteOnResolve', type: 'checkbox', defaultValue: true, admin: { width: '50%', description: 'Email the survey when an agent resolves a case in the workspace.' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'reminderAfterHours', type: 'number', min: 0, defaultValue: 72, admin: { width: '33%', description: 'Hours before one reminder; blank or 0 for none.' } },
                    { name: 'surveyDays', type: 'number', min: 1, max: 90, defaultValue: 14, admin: { width: '33%', description: 'Days a survey link stays valid.' } },
                    { name: 'notifyManagersOnLow', type: 'checkbox', defaultValue: true, admin: { width: '34%', description: 'Email the managers when a low score arrives.' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'careWindowDays', type: 'number', min: 7, max: 730, defaultValue: 180, admin: { width: '50%', description: 'Days of ratings that decide the care band.' } },
                    { name: 'careRecent', type: 'number', min: 1, max: 10, defaultValue: 3, admin: { width: '50%', description: 'How many of the latest ratings make the band.' } },
                  ],
                },
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
