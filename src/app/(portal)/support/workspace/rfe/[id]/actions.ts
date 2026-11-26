'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { notSaved } from '@/lib/support/field-security-model'
import { updateRfe } from '@/lib/support/rfe'
import { requireAgent } from '@/lib/support/session'

export async function updateRfeAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = String(form.get('id') ?? '')
  if (!isGuid(id)) redirect(`${WS}/product?view=rfes`)
  const back = (q: Record<string, string>) => redirect(`${WS}/rfe/${id}?${new URLSearchParams(q).toString()}`)
  const title = String(form.get('title') ?? '').trim()
  if (title.length < 3) back({ error: 'The title needs at least three characters.', edit: '1' })
  const type = Number(form.get('type') ?? '')
  const status = Number(form.get('status') ?? '')
  let error: string | null = null
  let skipped: string[] = []
  try {
    skipped = await updateRfe(me.auth, id, {
      title,
      type: Number.isFinite(type) && type > 0 ? type : undefined,
      status: Number.isFinite(status) && status > 0 ? status : undefined,
      // Sent only when the form has it: the field is disabled, so absent, for anyone field security keeps from it (only System
      // Administrators may write the YODIZ id; field-security-model.ts).
      yodizId: form.has('yodizId') ? String(form.get('yodizId') ?? '').trim() : undefined,
      users: String(form.get('users') ?? '').trim(),
    })
  } catch (e) {
    error = userMessage(e)
  }
  if (error) back({ error, edit: '1' })
  back({ ok: ['RFE saved.', notSaved(skipped)].filter(Boolean).join(' ') })
}
