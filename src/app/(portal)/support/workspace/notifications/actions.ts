'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { markRead } from '@/lib/support/notify'
import { requireAgent } from '@/lib/support/session'

/** Marks every notification of the signed-in agent as read. */
export async function markAllReadAction(): Promise<void> {
  const me = await requireAgent()
  await markRead(me.userId)
  // The bell sits in the portal's layout, which a redirect alone does not render again.
  revalidatePath('/support', 'layout')
  redirect('/support/workspace/notifications?ok=read')
}
