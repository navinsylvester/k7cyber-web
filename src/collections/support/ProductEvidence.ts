import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { roleAccess } from '../../access/roles'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/* Evidence an agent attaches to a hand-off (10-product-desk.md §3.4): screenshots, logs, text. Stored outside public/ and served
   only through /support/product/evidence/[id] after a session check. Never a sample: those go to the Lab's store by script. */
export const EVIDENCE_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain', 'text/csv', 'text/log', 'application/json', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream']
export const EVIDENCE_MAX = 10 * 1024 * 1024

export const ProductEvidence: CollectionConfig = {
  slug: 'product-evidence',
  labels: { singular: 'Evidence file', plural: 'Evidence files' },
  access: { create: () => false, delete: roleAccess('admin'), read: roleAccess('admin'), update: () => false },
  admin: { group: 'Product desk', description: 'Screenshots, logs and text up to 10 MB; written by the portal.' },
  fields: [{ type: 'row', fields: [{ name: 'itemId', type: 'text', index: true }, { name: 'uploadedBy', type: 'text' }] }],
  upload: {
    staticDir: path.resolve(dirname, '../../../uploads/product'),
    mimeTypes: EVIDENCE_MIME,
    disableLocalStorage: false,
    crop: false,
    focalPoint: false,
  },
}
