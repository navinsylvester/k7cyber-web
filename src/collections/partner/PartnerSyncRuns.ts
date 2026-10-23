import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* One row per run of the dashboard's CRM read-back (01-requirements.md FR-DASH-05, FR-DASH-11; 02-build-plan.md decision 14):
   when it ran, what started it, how many deals it scanned, how many rows the CRM returned, how many snapshots changed, how many
   opportunities it could not find, and the lines it would print. The partner dashboard's "Last updated" is the newest completed
   row; the K7 reconciliation log lists them. Written by src/lib/partner/sync.ts; append-only. */

export const PartnerSyncRuns: CollectionConfig = {
  slug: 'partner-sync-runs',
  labels: { singular: 'CRM sync run', plural: 'CRM sync runs' },
  access: { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'id', defaultColumns: ['createdAt', 'trigger', 'scanned', 'changed', 'missing', 'ok'], group: 'Partner portal', description: 'The dashboard read-back from Dynamics, one row per run.' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'trigger', type: 'select', options: ['cron', 'manual', 'test'], required: true, admin: { width: '20%' } },
        { name: 'actor', type: 'text', admin: { width: '30%', description: 'Who pressed Sync now; blank for the scheduler.' } },
        { name: 'ok', type: 'checkbox', defaultValue: true, admin: { width: '15%', description: 'Off when the CRM could not be read at all.' } },
        { name: 'durationMs', type: 'number', admin: { width: '15%' } },
        { name: 'orgId', type: 'text', admin: { width: '20%', description: 'Set when the run was for one organisation.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'scanned', type: 'number', defaultValue: 0, admin: { width: '20%', description: 'Deals with an opportunity id.' } },
        { name: 'fetched', type: 'number', defaultValue: 0, admin: { width: '20%', description: 'Rows the CRM returned.' } },
        { name: 'changed', type: 'number', defaultValue: 0, admin: { width: '20%', description: 'Snapshots that differ from the last read.' } },
        { name: 'missing', type: 'number', defaultValue: 0, admin: { width: '20%', description: 'Opportunities the CRM no longer returns.' } },
        { name: 'errors', type: 'number', defaultValue: 0, admin: { width: '20%' } },
      ],
    },
    { name: 'lines', type: 'json', admin: { description: 'What the run would print: one line per changed, missing or failed deal, and the reason when the whole run failed.' } },
  ],
  timestamps: true,
}
