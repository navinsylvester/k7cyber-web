import 'server-only'

import { bind, buildQuery, callDataverse, create, entity, guid, list, or, retrieve, type DataverseAuth, type Row, fv, lookup } from '@/lib/dataverse'

import { htmlToText, sanitizeHtml, truncate } from './format'

/* The case timeline: emails and notes are what the desk writes (01-requirements.md §4.3); phone calls and tasks render generically.
   Customers see every email on their case and the notes written through the portal (theirs and the agents' replies);
   internal notes never leave the workspace. */

export type Attachment = { id: string; name: string; size: number; mime: string; kind: 'note' | 'email' }

export type TimelineEntry = {
  id: string
  kind: 'email' | 'note' | 'phonecall' | 'task' | 'appointment' | 'other' | 'csat'
  when: string
  subject: string
  html: string
  text: string
  preview: string
  direction?: 'in' | 'out'
  from?: string
  to?: string
  by: { id: string; name: string }
  attachments: Attachment[]
  customerVisible: boolean
  /** The customer wrote it (portal note) rather than an agent. */
  fromCustomer: boolean
  statusLabel?: string
}

/** Notes written from the portal carry these subjects; everything else is internal to the desk. */
export const NOTE_FROM_CUSTOMER = 'Portal: reply from customer'
export const NOTE_TO_CUSTOMER = 'Reply to customer'
export const isCustomerVisibleNote = (subject: string | null | undefined): boolean => !!subject && (subject.startsWith('Portal:') || subject.startsWith(NOTE_TO_CUSTOMER))

export const getTimeline = async (auth: DataverseAuth, incidentId: string, audience: 'agent' | 'customer'): Promise<TimelineEntry[]> => {
  const id = guid(incidentId)
  const [emails, notes, others] = await Promise.all([
    list<Row>(auth, buildQuery('emails', { select: ['activityid', 'subject', 'description', 'directioncode', 'torecipients', 'sender', 'createdon', 'statuscode', 'attachmentcount', '_ownerid_value', '_createdby_value'], filter: `_regardingobjectid_value eq ${id}`, orderby: 'createdon desc' }), 100),
    list<Row>(auth, buildQuery('annotations', { select: ['annotationid', 'subject', 'notetext', 'filename', 'mimetype', 'filesize', 'isdocument', 'createdon', '_createdby_value'], filter: `_objectid_value eq ${id}`, orderby: 'createdon desc' }), 100),
    audience === 'agent'
      ? list<Row>(auth, buildQuery('activitypointers', { select: ['activityid', 'activitytypecode', 'subject', 'description', 'createdon', 'scheduledend', 'statuscode', '_ownerid_value'], filter: `_regardingobjectid_value eq ${id} and activitytypecode ne 'email'`, orderby: 'createdon desc' }), 50).catch(() => ({ value: [] as Row[] }))
      : Promise.resolve({ value: [] as Row[] }),
  ])

  // Email attachments: one query for every email that has any.
  const withAtt = emails.value.filter((e) => Number(e.attachmentcount ?? 0) > 0).map((e) => String(e.activityid))
  const attByEmail = new Map<string, Attachment[]>()
  if (withAtt.length) {
    const p = await list<Row>(auth, buildQuery('activitymimeattachments', { select: ['activitymimeattachmentid', 'filename', 'mimetype', 'filesize', '_objectid_value'], filter: or(...withAtt.map((a) => `_objectid_value eq ${guid(a)}`)) }), 200)
    for (const a of p.value) {
      const k = String(a._objectid_value)
      const arr = attByEmail.get(k) ?? []
      arr.push({ id: String(a.activitymimeattachmentid), name: String(a.filename ?? 'attachment'), size: Number(a.filesize ?? 0), mime: String(a.mimetype ?? ''), kind: 'email' })
      attByEmail.set(k, arr)
    }
  }

  const entries: TimelineEntry[] = []
  for (const e of emails.value) {
    const html = sanitizeHtml(String(e.description ?? ''))
    const text = htmlToText(String(e.description ?? ''))
    const by = lookup(e, 'ownerid') ?? lookup(e, 'createdby')
    const incoming = e.directioncode === false
    entries.push({
      id: String(e.activityid),
      kind: 'email',
      when: String(e.createdon),
      subject: String(e.subject ?? ''),
      html,
      text,
      preview: truncate(text, 160),
      direction: incoming ? 'in' : 'out',
      from: String(e.sender ?? ''),
      to: String(e.torecipients ?? ''),
      by: { id: by?.id ?? '', name: incoming ? String(e.sender ?? 'Customer') : (by?.name ?? 'Support') },
      attachments: attByEmail.get(String(e.activityid)) ?? [],
      customerVisible: true,
      fromCustomer: incoming,
      statusLabel: fv(e, 'statuscode'),
    })
  }
  for (const n of notes.value) {
    const subject = String(n.subject ?? '')
    const visible = isCustomerVisibleNote(subject)
    if (audience === 'customer' && !visible) continue
    const html = sanitizeHtml(String(n.notetext ?? ''))
    const text = htmlToText(String(n.notetext ?? ''))
    const by = lookup(n, 'createdby')
    const isDoc = n.isdocument === true && n.filename
    entries.push({
      id: String(n.annotationid),
      kind: 'note',
      when: String(n.createdon),
      subject: subject.startsWith('Portal:') ? 'Your reply' : subject.startsWith(NOTE_TO_CUSTOMER) ? 'Reply from K7 Support' : subject,
      html,
      text,
      preview: truncate(text || (isDoc ? `Attachment: ${n.filename}` : ''), 160),
      by: { id: by?.id ?? '', name: subject.startsWith('Portal:') ? 'You' : (by?.name ?? '') },
      attachments: isDoc ? [{ id: String(n.annotationid), name: String(n.filename), size: Number(n.filesize ?? 0), mime: String(n.mimetype ?? ''), kind: 'note' }] : [],
      customerVisible: visible,
      fromCustomer: subject.startsWith('Portal:'),
    })
  }
  for (const o of others.value) {
    const type = String(o.activitytypecode ?? '')
    const by = lookup(o, 'ownerid')
    const text = htmlToText(String(o.description ?? ''))
    entries.push({
      id: String(o.activityid),
      kind: type === 'phonecall' ? 'phonecall' : type === 'task' ? 'task' : type === 'appointment' ? 'appointment' : 'other',
      when: String(o.createdon),
      subject: String(o.subject ?? type),
      html: sanitizeHtml(String(o.description ?? '')),
      text,
      preview: truncate(text, 160),
      by: { id: by?.id ?? '', name: by?.name ?? '' },
      attachments: [],
      customerVisible: false,
      fromCustomer: false,
      statusLabel: fv(o, 'statuscode'),
    })
  }
  return entries.sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0))
}

export type NewNote = { subject: string; text: string; file?: { name: string; mime: string; base64: string } }

/** A note on the case; the text is stored as simple HTML paragraphs so the Customer Service Hub renders it. */
export const addNote = async (auth: DataverseAuth, incidentId: string, n: NewNote): Promise<string> => {
  const body: Row = {
    subject: n.subject.slice(0, 250),
    notetext: toNoteHtml(n.text),
    'objectid_incident@odata.bind': bind('incidents', incidentId),
  }
  if (n.file) {
    body.filename = n.file.name.slice(0, 255)
    body.mimetype = n.file.mime || 'application/octet-stream'
    body.documentbody = n.file.base64
    body.isdocument = true
  }
  return create(auth, 'annotations', body)
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const toNoteHtml = (text: string): string =>
  text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')

export const addPhoneCall = async (auth: DataverseAuth, incidentId: string, c: { subject: string; description?: string; outgoing: boolean; minutes?: number }): Promise<string> =>
  create(auth, 'phonecalls', { subject: c.subject.slice(0, 200), description: c.description ?? '', directioncode: c.outgoing, actualdurationminutes: c.minutes ?? 0, 'regardingobjectid_incident_phonecall@odata.bind': bind('incidents', incidentId) })

export const addTask = async (auth: DataverseAuth, incidentId: string, t: { subject: string; description?: string; due?: string }): Promise<string> =>
  create(auth, 'tasks', { subject: t.subject.slice(0, 200), description: t.description ?? '', ...(t.due ? { scheduledend: t.due } : {}), 'regardingobjectid_incident_task@odata.bind': bind('incidents', incidentId) })

export type FileBody = { name: string; mime: string; base64: string }

/** Attachment bodies are fetched only on download (02-dataverse-integration.md §4b). The caller checks that the note belongs to a case the user may see. */
export const getNoteAttachment = async (auth: DataverseAuth, annotationId: string): Promise<(FileBody & { objectId: string }) | null> => {
  const n = await retrieve<Row>(auth, `${entity('annotations', annotationId)}?$select=filename,mimetype,documentbody,_objectid_value`)
  if (!n.documentbody) return null
  return { name: String(n.filename ?? 'attachment'), mime: String(n.mimetype ?? 'application/octet-stream'), base64: String(n.documentbody), objectId: String(n._objectid_value ?? '') }
}

export const getEmailAttachment = async (auth: DataverseAuth, attachmentId: string): Promise<(FileBody & { activityId: string }) | null> => {
  const a = await retrieve<Row>(auth, `${entity('activitymimeattachments', attachmentId)}?$select=filename,mimetype,body,_objectid_value`)
  if (!a.body) return null
  return { name: String(a.filename ?? 'attachment'), mime: String(a.mimetype ?? 'application/octet-stream'), base64: String(a.body), activityId: String(a._objectid_value ?? '') }
}

/** Which case an email belongs to (to authorise a download). */
export const emailRegarding = async (auth: DataverseAuth, activityId: string): Promise<string | null> => {
  const e = await retrieve<Row>(auth, `${entity('emails', activityId)}?$select=_regardingobjectid_value`)
  return e._regardingobjectid_value ? String(e._regardingobjectid_value) : null
}

/* ---------- Email reply from the workspace (phase 1b) ---------- */

export type EmailReply = { to: string; subject: string; text: string; fromUserId: string }

/** Creates an outgoing email activity on the case and asks Dataverse to send it. Where no mailbox is synced (UAT today)
   the send fails and the email stays as a draft in the timeline; the caller tells the agent which happened. */
export const sendEmailReply = async (auth: DataverseAuth, incidentId: string, m: EmailReply): Promise<{ id: string; sent: boolean; reason?: string }> => {
  const to = m.to.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) throw new Error('Invalid recipient')
  const id = await create(auth, 'emails', {
    subject: m.subject.trim().slice(0, 200),
    description: toNoteHtml(m.text),
    directioncode: true,
    'regardingobjectid_incident_email@odata.bind': bind('incidents', incidentId),
    email_activity_parties: [
      { 'partyid_systemuser@odata.bind': bind('systemusers', m.fromUserId), participationtypemask: 1 },
      { addressused: to, participationtypemask: 2 },
    ],
  })
  try {
    await callDataverse(auth, 'POST', `${entity('emails', id)}/Microsoft.Dynamics.CRM.SendEmail`, { body: { IssueSend: true, TrackingToken: '' } })
    return { id, sent: true }
  } catch (e) {
    return { id, sent: false, reason: (e as Error).message }
  }
}
