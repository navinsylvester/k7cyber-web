'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { updateArticle } from '@/lib/support/kb'
import { requireAgent } from '@/lib/support/session'

export async function updateArticleAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const id = String(form.get('id') ?? '')
  if (!isGuid(id)) redirect(`${WS}/kb`)
  const back = (q: Record<string, string>) => redirect(`${WS}/kb/${id}?${new URLSearchParams(q).toString()}`)
  const title = String(form.get('title') ?? '').trim()
  if (title.length < 3) back({ error: 'The title needs at least three characters.', edit: '1' })
  let error: string | null = null
  try {
    await updateArticle(me.auth, id, {
      title,
      description: String(form.get('description') ?? '').trim(),
      keywords: String(form.get('keywords') ?? '').trim(),
      content: String(form.get('content') ?? ''),
      internal: form.get('internal') === 'on',
    })
  } catch (e) {
    error = userMessage(e)
  }
  if (error) back({ error, edit: '1' })
  back({ ok: 'Article saved.' })
}
