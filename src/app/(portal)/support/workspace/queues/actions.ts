'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { pickFromQueue, releaseToQueue } from '@/lib/support/queues'
import { requireAgent } from '@/lib/support/session'

const back = (q: Record<string, string>) => redirect(`${WS}/queues?${new URLSearchParams(q).toString()}`)

/** Pick a queue item: the signed-in agent becomes the worker; the item stays in the queue (as the model-driven app does). */
export async function pickAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = String(form.get('id') ?? '')
  if (!isGuid(id)) back({ error: 'That queue item is not valid.' })
  let error: string | null = null
  try {
    await pickFromQueue(me.auth, id, me.userId)
  } catch (e) {
    error = userMessage(e)
  }
  if (error) back({ error })
  back({ ok: 'Picked. It is now in your list.' })
}

export async function releaseAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = String(form.get('id') ?? '')
  if (!isGuid(id)) back({ error: 'That queue item is not valid.' })
  let error: string | null = null
  try {
    await releaseToQueue(me.auth, id)
  } catch (e) {
    error = userMessage(e)
  }
  if (error) back({ error })
  back({ ok: 'Released back to the queue.' })
}
