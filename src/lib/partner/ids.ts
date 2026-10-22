import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

/* The portal's own identifiers (02-build-plan.md §5, P1): K7P-00001 for organisations, K7A-00001 for applications, K7D-00001
   for deals (M4). One counter row per kind in `partner-counters`, advanced with a compare-and-swap update (`where value = seen`),
   so two approvals at the same moment never share a number; the unique index on the target column is the last line. */

export type IdKind = 'partner' | 'application' | 'deal'
const PREFIX: Record<IdKind, string> = { partner: 'K7P-', application: 'K7A-', deal: 'K7D-' }

export const formatId = (kind: IdKind, n: number): string => `${PREFIX[kind]}${String(n).padStart(5, '0')}`

const db = () => getPayload({ config: configPromise })

export const nextId = async (kind: IdKind): Promise<string> => {
  const payload = await db()
  for (let attempt = 0; attempt < 8; attempt++) {
    const found = await payload.find({ collection: 'partner-counters', where: { kind: { equals: kind } }, limit: 1, depth: 0, overrideAccess: true })
    const row = found.docs[0]
    if (!row) {
      try {
        await payload.create({ collection: 'partner-counters', data: { kind, value: 0 }, overrideAccess: true })
      } catch {
        /* someone else made it first; read again */
      }
      continue
    }
    const seen = typeof row.value === 'number' ? row.value : 0
    const next = seen + 1
    const r = await payload.update({ collection: 'partner-counters', where: { and: [{ kind: { equals: kind } }, { value: { equals: seen } }] }, data: { value: next }, overrideAccess: true })
    if (r.docs.length === 1) return formatId(kind, next)
  }
  throw new Error(`Could not allocate a ${kind} number`)
}
