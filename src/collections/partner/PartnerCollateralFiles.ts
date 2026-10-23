import type { CollectionConfig } from 'payload'
import path from 'path'

import { roleAccess } from '../../access/roles'
import { COLLATERAL_HARD_MAX_MB, COLLATERAL_MIME, nextVersion } from '../../lib/partner/collateral-model'
import { normalisePartnerSettings } from '../../lib/partner/settings-model'
import { maxUpload, MB } from '../uploadLimit'

/* The files of the collateral library (FR-MKT-02, FR-MKT-04): one row per version of an item, the newest being what partners
   download. Stored outside public/ under PARTNER_UPLOAD_DIR (default uploads/collateral, git-ignored; decision 13: local disk
   until hosting is decided, the storage adapter swapped at staging) and served only through the portal's download routes after
   the session and the visibility rule have been checked. The size cap is `partner-settings.collateral.maxMb` (default 200, the
   server's ceiling), checked here before Payload validates; the types are FR-MKT-02's. */
export const COLLATERAL_DIR = path.resolve(process.cwd(), process.env.PARTNER_UPLOAD_DIR || 'uploads/collateral')

export const PartnerCollateralFiles: CollectionConfig = {
  slug: 'partner-collateral-files',
  labels: { singular: 'Collateral file', plural: 'Collateral files' },
  access: { create: roleAccess('marketingEditor'), delete: roleAccess('admin'), read: roleAccess('marketingEditor'), update: roleAccess('marketingEditor') },
  admin: {
    group: 'Partner portal',
    defaultColumns: ['filename', 'item', 'version', 'filesize', 'createdAt'],
    description: 'One row per version of a collateral item; the newest is what partners download. PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, JPG/PNG, SVG, MP4 or ZIP, up to the size the portal settings allow (200 MB at most).',
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'item', type: 'relationship', relationTo: 'partner-collateral', required: true, index: true, admin: { width: '50%' } },
        { name: 'version', type: 'text', admin: { width: '25%', description: 'Blank: the previous version bumped (1, 2, 3 or 2.1 → 2.2).' } },
        { name: 'uploadedBy', type: 'text', admin: { width: '25%', readOnly: true } },
      ],
    },
    { name: 'note', type: 'textarea', admin: { description: 'What changed in this version; partners read it on the item.' } },
  ],
  hooks: {
    beforeValidate: [
      maxUpload(async (req) => {
        try {
          const g = await req.payload.findGlobal({ slug: 'partner-settings', depth: 0, overrideAccess: true })
          return Math.min(normalisePartnerSettings(g as unknown as Record<string, unknown>).collateral.maxMb, COLLATERAL_HARD_MAX_MB) * MB
        } catch {
          return COLLATERAL_HARD_MAX_MB * MB
        }
      }),
    ],
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation !== 'create') return data
        if (!data.uploadedBy) data.uploadedBy = req.user?.email ?? ''
        if (!String(data.version ?? '').trim() && data.item) {
          const itemId = typeof data.item === 'object' && data.item !== null ? (data.item as { id?: unknown }).id : data.item
          const prev = await req.payload.find({ collection: 'partner-collateral-files', where: { item: { equals: itemId } }, sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true })
          data.version = nextVersion((prev.docs[0] as { version?: string } | undefined)?.version)
        }
        return data
      },
    ],
  },
  upload: {
    staticDir: COLLATERAL_DIR,
    mimeTypes: COLLATERAL_MIME,
    disableLocalStorage: false,
    crop: false,
    focalPoint: false,
    filesRequiredOnCreate: true,
  },
  timestamps: true,
}
