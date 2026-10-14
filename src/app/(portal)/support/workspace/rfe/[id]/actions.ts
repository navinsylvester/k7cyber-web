'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { updateRfe } from '@/lib/support/rfe'
import { requireAgent } from '@/lib/support/session'

export async function updateRfeAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = String(form.get('id') ?? '')
  if (!isGuid(id)) redirect(`${WS}/rfe`)
  const back = (q: Record<string, string>) => redirect(`${WS}/rfe/${id}?${new URLSearchParams(q).toString()}`)
  const title = String(form.get('title') ?? '').trim()
  if (title.length < 3) back({ error: 'The title needs at least three characters.', edit: '1' })
  const type = Number(form.get('type') ?? '')
  const status = Number(form.get('status') ?? '')
  let error: string | null = null
  try {
    await updateRfe(me.auth, id, {
      title,
      type: Number.isFinite(type) && type > 0 ? type : undefined,
      status: Number.isFinite(status) && status > 0 ? status : undefined,
      yodizId: String(form.get('yodizId') ?? '').trim(),
      users: String(form.get('users') ?? '').trim(),
    })
  } catch (e) {
    error = userMessage(e)
  }
  if (error) back({ error, edit: '1' })
  back({ ok: 'RFE saved.' })
}
