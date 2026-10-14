'use server'

import { redirect } from 'next/navigation'

import { WS } from '@/components/support/WorkspaceBar'
import { userMessage } from '@/lib/dataverse/errors'
import { createDraftArticle } from '@/lib/support/kb'
import { requireAgent } from '@/lib/support/session'

export async function createArticleAction(form: FormData): Promise<void> {
  const me = await requireAgent()
  const title = String(form.get('title') ?? '').trim()
  const description = String(form.get('description') ?? '').trim()
  const keywords = String(form.get('keywords') ?? '').trim()
  const content = String(form.get('content') ?? '')
  const internal = form.get('internal') === 'on'
  const back = (error: string) => redirect(`${WS}/kb/new?${new URLSearchParams({ error, title, description, keywords }).toString()}`)
  if (title.length < 3) back('The title needs at least three characters.')
  let id = ''
  let error: string | null = null
  try {
    id = await createDraftArticle(me.auth, { title, description, keywords, content, internal })
  } catch (e) {
    error = userMessage(e)
  }
  if (error || !id) back(error ?? 'Could not create the draft.')
  redirect(`${WS}/kb/${id}?ok=${encodeURIComponent('Draft created. Approve and publish it in the Customer Service Hub.')}`)
}
