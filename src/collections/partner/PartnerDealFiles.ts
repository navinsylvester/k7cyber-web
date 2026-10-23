import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { roleAccess } from '../../access/roles'
import { maxUpload } from '../uploadLimit'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/* What a partner attaches to a deal registration (FR-DEAL-02: a quote, an RFP, a purchase intent) and what either side adds to
   its thread later (FR-DEAL-09). Stored outside public/ under uploads/partner-deals (git-ignored) and served only through the
   deal's own route after a session check: the partner side through its scope, the K7 side through the approver role. The
   opportunity job copies files up to the annotation limit into Dynamics as notes. Written by src/lib/partner/deals.ts only. */
export const DEAL_FILE_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream']
export const DEAL_FILE_MAX = 10 * 1024 * 1024

export const PartnerDealFiles: CollectionConfig = {
  slug: 'partner-deal-files',
  labels: { singular: 'Deal file', plural: 'Deal files' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { group: 'Partner portal', description: 'Quotes, RFPs and purchase intents up to 10 MB, written by the portal; served only through the deal.' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'dealId', type: 'text', index: true, admin: { width: '34%', description: 'The partner-deals row.' } },
        { name: 'orgId', type: 'text', index: true, admin: { width: '33%' } },
        { name: 'uploadedBy', type: 'text', admin: { width: '33%' } },
      ],
    },
  ],
  hooks: { beforeValidate: [maxUpload(DEAL_FILE_MAX)] },
  upload: {
    staticDir: path.resolve(dirname, '../../../uploads/partner-deals'),
    mimeTypes: DEAL_FILE_MIME,
    disableLocalStorage: false,
    crop: false,
    focalPoint: false,
  },
}
