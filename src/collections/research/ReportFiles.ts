import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { roleAccess } from '../../access/roles'
import { maxUpload, MB } from '../uploadLimit'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/* The PDFs behind Threat Reports. PDF only, stored outside public/, and served through the download route so
   gated reports stay behind the lead form (FR-TR-03, FR-TR-05). */
export const ReportFiles: CollectionConfig = {
  slug: 'report-files',
  access: {
    create: roleAccess('marketingEditor'),
    delete: roleAccess('marketingEditor'),
    read: ({ req: { user } }) => Boolean(user),
    update: roleAccess('marketingEditor'),
  },
  admin: { group: 'K7 Labs', description: 'PDF only, up to 30 MB.' },
  fields: [{ name: 'title', type: 'text' }],
  hooks: { beforeValidate: [maxUpload(30 * MB)] },
  upload: {
    staticDir: path.resolve(dirname, '../../../uploads/reports'),
    mimeTypes: ['application/pdf'],
    disableLocalStorage: false,
  },
}
