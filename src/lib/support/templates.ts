import 'server-only'

import { action, buildQuery, guid, list, type DataverseAuth, type Row } from '@/lib/dataverse'

import { templateToComposer } from './email-html'
import { memo } from './memo'

/* Email templates on the case sheet (TR-25, 09-portal-guide.md §3): the templates Dynamics keeps for cases and the general ones,
   the same list the Hub's "Insert template" offers, read as the agent so their personal templates come too. A template is filled
   for the case by Dynamics itself (InstantiateTemplate: the customer's name, the case number, the owner…), which creates nothing;
   the composer then holds it like anything the agent typed. Templates are written in Dynamics (Settings → Templates). */

export type EmailTemplate = { id: string; title: string; group: 'case' | 'general'; personal: boolean; description: string }

/** The templates the agent may use on a case email, case ones first, by title. Kept five minutes per agent. */
export const emailTemplates = (auth: DataverseAuth, userId: string): Promise<EmailTemplate[]> =>
  memo(`tpl:${userId.toLowerCase()}`, 5 * 60_000, async () => {
    const p = await list<Row>(auth, buildQuery('templates', { select: ['templateid', 'title', 'templatetypecode', 'ispersonal', 'description'], filter: "templatetypecode eq 'incident' or templatetypecode eq 'systemuser'", orderby: 'title' }), 250)
    return p.value
      .map((t) => ({ id: String(t.templateid), title: String(t.title ?? '').trim() || 'Untitled template', group: t.templatetypecode === 'incident' ? ('case' as const) : ('general' as const), personal: t.ispersonal === true, description: String(t.description ?? '').trim() }))
      .sort((a, b) => (a.group === b.group ? a.title.localeCompare(b.title) : a.group === 'case' ? -1 : 1))
  })

export type FilledTemplate = { subject: string; html: string; left: string[] }

/** One template filled for one case by Dynamics, made fit for the composer. */
export const fillTemplate = async (auth: DataverseAuth, templateId: string, caseId: string): Promise<FilledTemplate> => {
  const r = await action<{ value?: { subject?: string | null; description?: string | null }[] }>(auth, 'InstantiateTemplate', { TemplateId: guid(templateId), ObjectType: 'incident', ObjectId: guid(caseId) })
  const e = r.value?.[0] ?? {}
  const body = templateToComposer(String(e.description ?? ''))
  return { subject: String(e.subject ?? '').replace(/\s+/g, ' ').trim().slice(0, 200), html: body.html, left: body.left }
}
