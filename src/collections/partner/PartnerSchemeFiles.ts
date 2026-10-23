import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { roleAccess } from '../../access/roles'
import { maxUpload } from '../uploadLimit'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/* A scheme's document (FR-SCH-01: "an attachment (PDF)"), uploaded in the admin by the Scheme Admin with the scheme. Stored
   outside public/ under uploads/partner-schemes (git-ignored) and served only through the scheme's own route after the
   session check: the partner side for a scheme the organisation may see, the K7 side for the Scheme Admin. */
export const SCHEME_FILE_MIME = ['application/pdf']
export const SCHEME_FILE_MAX = 20 * 1024 * 1024

export const PartnerSchemeFiles: CollectionConfig = {
  slug: 'partner-scheme-files',
  labels: { singular: 'Scheme document', plural: 'Scheme documents' },
  access: { create: roleAccess('marketingEditor'), delete: roleAccess('admin'), read: roleAccess('marketingEditor'), update: roleAccess('marketingEditor') },
  admin: { group: 'Partner portal', description: 'The PDF a scheme carries (up to 20 MB); served only through the portal to the partners the scheme applies to.' },
  fields: [{ name: 'uploadedBy', type: 'text', admin: { readOnly: true } }],
  hooks: {
    beforeValidate: [
      maxUpload(SCHEME_FILE_MAX),
      ({ data, req, operation }) => {
        if (operation === 'create' && data && !data.uploadedBy) data.uploadedBy = req.user?.email ?? ''
        return data
      },
    ],
  },
  upload: {
    staticDir: path.resolve(dirname, '../../../uploads/partner-schemes'),
    mimeTypes: SCHEME_FILE_MIME,
    disableLocalStorage: false,
    crop: false,
    focalPoint: false,
  },
}
