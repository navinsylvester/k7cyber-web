'use server'

import { revalidatePath } from 'next/cache'

import { markAllRead } from '@/lib/partner/notify'
import { tryK7, tryPartner } from '@/lib/partner/session'

/** Marks the reader's bell as read: a partner user's own rows, or the rows of the roles a K7 person holds. */
export async function markAllReadAction(): Promise<void> {
  const partner = await tryPartner()
  if (partner) {
    await markAllRead({ kind: 'user', userId: partner.user.id, scope: partner.scope })
    revalidatePath('/partners/portal/notifications')
    return
  }
  const k7 = await tryK7()
  if (k7) {
    await markAllRead({ kind: 'staff', roles: k7.roles })
    revalidatePath('/partners/portal/k7/notifications')
  }
}
