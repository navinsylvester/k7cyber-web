import 'server-only'

import { action, buildQuery, entity, guid, list, type DataverseAuth, type Row } from '@/lib/dataverse'

/* Queues (01-requirements.md §4.3): "items I am working on" and the public queues; most of the 582 queues are personal. */

export type QueueItemRow = Row & { queueitemid: string; title: string }

const QI_SELECT = ['queueitemid', 'title', 'enteredon', 'modifiedon', 'statecode', '_objectid_value', '_workerid_value', '_queueid_value', 'objecttypecode'] as const

export const myQueueItems = async (auth: DataverseAuth, userId: string, top = 50): Promise<QueueItemRow[]> => {
  const p = await list<QueueItemRow>(auth, buildQuery('queueitems', { select: [...QI_SELECT], filter: `_workerid_value eq ${guid(userId)} and statecode eq 0`, orderby: 'modifiedon desc', top }), top)
  return p.value
}

export const queueItems = async (auth: DataverseAuth, queueId: string, top = 50): Promise<QueueItemRow[]> => {
  const p = await list<QueueItemRow>(auth, buildQuery('queueitems', { select: [...QI_SELECT], filter: `_queueid_value eq ${guid(queueId)} and statecode eq 0`, orderby: 'enteredon desc', top }), top)
  return p.value
}

/* Pick and release are actions bound to the queue item; PickFromQueue takes `SystemUser` (an entity reference) and `RemoveQueueItem`,
   per the service $metadata (verified in UAT 2026-10-13). */
export const pickFromQueue = async (auth: DataverseAuth, queueItemId: string, userId: string): Promise<void> => {
  await action(auth, `${entity('queueitems', queueItemId)}/Microsoft.Dynamics.CRM.PickFromQueue`, { SystemUser: { systemuserid: guid(userId), '@odata.type': 'Microsoft.Dynamics.CRM.systemuser' }, RemoveQueueItem: false })
}

export const releaseToQueue = async (auth: DataverseAuth, queueItemId: string): Promise<void> => {
  await action(auth, `${entity('queueitems', queueItemId)}/Microsoft.Dynamics.CRM.ReleaseToQueue`, {})
}
