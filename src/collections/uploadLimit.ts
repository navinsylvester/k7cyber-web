import { APIError, type CollectionBeforeValidateHook } from 'payload'

/* Payload has one upload size limit for the whole config (`upload.limits.fileSize`, read by its multipart parser). The
   partner collateral needs 200 MB (FR-MKT-02), so the global limit is 200 MB and every other upload collection keeps its own
   smaller cap here, checked before validation on the file the request carried. `max` is bytes or a function reading them
   (the collateral's cap is a setting). The size comes from `data.filesize`, which Payload's `generateFileData` has filled in by
   the time the hook runs; `req.file.size` is only a fallback, because for a non-image file Payload rebuilds `req.file` before
   the hooks with its size left undefined (seen on a real admin upload, session 12). */
export const maxUpload =
  (max: number | ((req: Parameters<CollectionBeforeValidateHook>[0]['req']) => Promise<number>)): CollectionBeforeValidateHook =>
  async ({ req, data }) => {
    const file = req.file
    if (!file) return data
    const size = uploadSize(file, data)
    if (size === null) return data
    const limit = typeof max === 'number' ? max : await max(req)
    if (size > limit) throw new APIError(`${file.name} is ${(size / 1048576).toFixed(1)} MB; this library accepts files up to ${Math.round(limit / 1048576)} MB.`, 400)
    return data
  }

/** The bytes of the upload: what Payload recorded on the document, else the request's file, else its buffer. */
export const uploadSize = (file: { size?: unknown; data?: unknown }, data: Record<string, unknown> | undefined): number | null => {
  const recorded = data?.filesize
  if (typeof recorded === 'number' && Number.isFinite(recorded)) return recorded
  if (typeof file.size === 'number' && Number.isFinite(file.size)) return file.size
  if (file.data && typeof (file.data as { length?: unknown }).length === 'number') return (file.data as { length: number }).length
  return null
}

export const MB = 1024 * 1024
