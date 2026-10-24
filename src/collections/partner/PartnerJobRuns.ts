import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* One row per run of a scheduled partner-portal job (M9, docs/partner-portal/05-staging-and-go-live.md §3): which job, what
   started it, whether it finished, how long it took and one line of summary. The Operations page reads the newest row per job
   to say whether the scheduler is firing and the readiness route reads nothing from here. Written by src/lib/partner/ops.ts;
   append-only; housekeeping removes rows older than ninety days. */

export const PARTNER_JOB_KEYS = ['outbox', 'sync', 'dealsSweep', 'digest', 'slaSweep', 'schemesRun', 'certificatesSweep', 'housekeeping'] as const

export const PartnerJobRuns: CollectionConfig = {
  slug: 'partner-job-runs',
  labels: { singular: 'Scheduled job run', plural: 'Scheduled job runs' },
  access: { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { useAsTitle: 'summary', defaultColumns: ['createdAt', 'job', 'trigger', 'ok', 'durationMs', 'summary'], group: 'Partner portal', description: 'Every run of a scheduled job (the outbox drain, the CRM read-back, the sweeps, the digest, housekeeping), newest first.' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'job', type: 'select', options: [...PARTNER_JOB_KEYS], required: true, index: true, admin: { width: '25%' } },
        { name: 'trigger', type: 'select', options: ['cron', 'manual'], required: true, defaultValue: 'cron', admin: { width: '20%' } },
        { name: 'ok', type: 'checkbox', defaultValue: true, admin: { width: '15%', description: 'Off when the run threw.' } },
        { name: 'durationMs', type: 'number', admin: { width: '20%' } },
        { name: 'actor', type: 'text', admin: { width: '20%', description: 'Who pressed Run; blank for the scheduler.' } },
      ],
    },
    { name: 'summary', type: 'text', admin: { description: 'One line: what the run did, or the error.' } },
    { name: 'detail', type: 'json', admin: { description: 'The result the job returned, trimmed.' } },
  ],
  timestamps: true,
}
