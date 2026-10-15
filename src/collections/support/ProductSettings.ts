import type { GlobalConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* The product desk's configuration (10-product-desk.md §5): the two teams, who is principal support, the priorities with their
   clocks, the tracker, the status map, the CRM mirror switches, the clock rules and notifications. Edited from
   /support/product/settings by leads; this is the raw form. Nothing here is written to Dynamics. */
export const ProductSettings: GlobalConfig = {
  slug: 'product-settings',
  label: 'Product desk settings',
  access: { read: roleAccess('admin'), update: roleAccess('admin') },
  admin: { group: 'Product desk', description: 'Teams, principal support, priorities and clocks, the tracker and the CRM mirror. Edited from the portal; this is the raw form.' },
  fields: [
    { name: 'enabled', type: 'checkbox', defaultValue: true, admin: { description: 'Show the escalate panel to agents and the product desk to principal support.' } },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Teams and people',
          fields: [
            {
              name: 'teams',
              type: 'array',
              admin: { description: 'Engineering and the Lab. The tracker project is the Yodiz project id (phase B).' },
              fields: [
                { type: 'row', fields: [{ name: 'key', type: 'select', options: ['engineering', 'lab'], required: true }, { name: 'name', type: 'text', required: true }, { name: 'inboxEmail', type: 'text' }, { name: 'trackerProject', type: 'text' }] },
                { name: 'leads', type: 'array', fields: [{ name: 'email', type: 'text', required: true }] },
              ],
            },
            {
              name: 'principals',
              type: 'group',
              admin: { description: 'Who triages: agents holding one of these Dynamics roles or listed by email. Managers pass when the box is ticked.' },
              fields: [
                { name: 'roles', type: 'array', fields: [{ name: 'name', type: 'text', required: true }] },
                { name: 'emails', type: 'array', fields: [{ name: 'email', type: 'text', required: true }] },
                { name: 'managersAreprincipals', type: 'checkbox', defaultValue: true },
              ],
            },
          ],
        },
        {
          label: 'Priorities and clocks',
          fields: [
            {
              name: 'priorities',
              type: 'array',
              admin: { description: 'Triage target in working hours (accept or decline), update cadence in working days while tracked.' },
              fields: [{ type: 'row', fields: [{ name: 'key', type: 'select', options: ['P1', 'P2', 'P3', 'P4'], required: true }, { name: 'label', type: 'text' }, { name: 'triageHours', type: 'number', min: 1 }, { name: 'updateEveryDays', type: 'number', min: 1 }] }],
            },
            {
              name: 'clock',
              type: 'group',
              fields: [
                { type: 'row', fields: [{ name: 'pauseWhileWithProduct', type: 'checkbox', defaultValue: true, admin: { description: "Time with product does not count against the engineer's resolution SLA." } }, { name: 'autoCloseDays', type: 'number', min: 1, defaultValue: 14 }, { name: 'warnAtPercent', type: 'number', min: 10, max: 100, defaultValue: 75 }] },
              ],
            },
          ],
        },
        {
          label: 'Tracker and mirror',
          fields: [
            {
              name: 'tracker',
              type: 'group',
              fields: [
                { type: 'row', fields: [{ name: 'kind', type: 'select', options: ['none', 'yodiz'], defaultValue: 'none' }, { name: 'pollMinutes', type: 'number', min: 5, defaultValue: 30 }, { name: 'pollInBusinessHoursOnly', type: 'checkbox', defaultValue: true }, { name: 'dailyBudget', type: 'number', min: 10, defaultValue: 300 }] },
              ],
            },
            {
              name: 'statusMap',
              type: 'array',
              admin: { description: 'Tracker status → bridge state, per project (phase B).' },
              fields: [{ type: 'row', fields: [{ name: 'tracker', type: 'select', options: ['none', 'yodiz'] }, { name: 'projectId', type: 'text' }, { name: 'statusCode', type: 'text', required: true }, { name: 'statusName', type: 'text' }, { name: 'state', type: 'select', options: ['raised', 'tracked', 'needs-info', 'fixed', 'released', 'declined', 'closed'], required: true }] }],
            },
            {
              name: 'mirror',
              type: 'group',
              admin: { description: 'What the desk writes back to Dynamics. Off: everything is recorded in the outbox as pending and nothing reaches the CRM.' },
              fields: [
                { type: 'row', fields: [{ name: 'enabled', type: 'checkbox', defaultValue: false }, { name: 'createCrmRows', type: 'checkbox', defaultValue: false, admin: { description: 'Create k7_rfe / k7_defect rows at raise (phase B).' } }, { name: 'notesOnLinkedCases', type: 'checkbox', defaultValue: true }, { name: 'statusBack', type: 'checkbox', defaultValue: true }] },
              ],
            },
            {
              name: 'notify',
              type: 'group',
              fields: [{ type: 'row', fields: [{ name: 'principalsOnRaise', type: 'checkbox', defaultValue: true }, { name: 'inboxOnAccept', type: 'checkbox', defaultValue: true }, { name: 'ownerOnChange', type: 'checkbox', defaultValue: true }] }],
            },
          ],
        },
      ],
    },
  ],
}
