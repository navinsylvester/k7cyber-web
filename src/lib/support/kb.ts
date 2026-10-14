import 'server-only'

import { and, buildQuery, create, entity, isGuid, list, or, retrieve, str, update, type DataverseAuth, type Row } from '@/lib/dataverse'

import { sanitizeHtml } from './format'

/* Knowledge articles (01-requirements.md §4.5, §5.2): customers read published, non-internal articles; agents read everything and draft. */

export const KB_SELECT = ['knowledgearticleid', 'articlepublicnumber', 'title', 'description', 'keywords', 'statecode', 'statuscode', 'isinternal', 'islatestversion', 'modifiedon', 'createdon', 'knowledgearticleviews', '_ownerid_value', '_modifiedby_value'] as const
export type ArticleRow = Row & { knowledgearticleid: string; articlepublicnumber: string; title: string }

const PUBLISHED = 'statecode eq 3 and islatestversion eq true'

export const listArticles = async (auth: DataverseAuth, o: { q?: string; audience: 'customer' | 'agent'; state?: 'published' | 'draft' | 'all'; top?: number }): Promise<ArticleRow[]> => {
  const q = o.q?.trim()
  const text = q ? or(`contains(title,${str(q)})`, `contains(keywords,${str(q)})`, `contains(description,${str(q)})`) : null
  const state = o.audience === 'customer' ? and(PUBLISHED, 'isinternal eq false') : o.state === 'draft' ? 'statecode eq 0 and islatestversion eq true' : o.state === 'all' ? 'islatestversion eq true' : PUBLISHED
  const p = await list<ArticleRow>(auth, buildQuery('knowledgearticles', { select: [...KB_SELECT], filter: and(state, text), orderby: 'modifiedon desc', top: o.top ?? 50 }), o.top ?? 50)
  return p.value
}

export const getArticle = async (auth: DataverseAuth, numberOrId: string, audience: 'customer' | 'agent'): Promise<(ArticleRow & { html: string }) | null> => {
  const key = String(numberOrId)
  const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
  const filter = and(byId ? `knowledgearticleid eq ${key.toLowerCase()}` : `articlepublicnumber eq ${str(key.toUpperCase())}`, audience === 'customer' ? and(PUBLISHED, 'isinternal eq false') : 'islatestversion eq true')
  const p = await list<ArticleRow & { content?: string }>(auth, buildQuery('knowledgearticles', { select: [...KB_SELECT, 'content'], filter, orderby: 'modifiedon desc', top: 1 }), 1)
  const a = p.value[0]
  return a ? { ...a, html: sanitizeHtml(String(a.content ?? '')) } : null
}

export const createDraftArticle = async (auth: DataverseAuth, a: { title: string; description?: string; keywords?: string; content: string; internal?: boolean }): Promise<string> =>
  create(auth, 'knowledgearticles', { title: a.title.trim().slice(0, 500), description: a.description ?? '', keywords: a.keywords ?? '', content: a.content, isinternal: a.internal ?? false })

export const updateArticle = async (auth: DataverseAuth, id: string, a: Partial<{ title: string; description: string; keywords: string; content: string; internal: boolean }>): Promise<void> => {
  const b: Row = {}
  if (a.title !== undefined) b.title = a.title.trim().slice(0, 500)
  if (a.description !== undefined) b.description = a.description
  if (a.keywords !== undefined) b.keywords = a.keywords
  if (a.content !== undefined) b.content = a.content
  if (a.internal !== undefined) b.isinternal = a.internal
  await update(auth, entity('knowledgearticles', id), b)
}

export const articleById = async (auth: DataverseAuth, id: string): Promise<ArticleRow | null> => {
  if (!isGuid(id)) return null
  return retrieve<ArticleRow>(auth, `${entity('knowledgearticles', id)}?$select=${KB_SELECT.join(',')}`)
}
