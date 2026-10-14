'use server'

import { redirect } from 'next/navigation'

import { userMessage } from '@/lib/dataverse/errors'
import { isGuid } from '@/lib/dataverse/odata'
import { createCustomerCase } from '@/lib/support/cases'
import { caseCreatedMail, sendMail } from '@/lib/support/mail'
import { requireCustomer } from '@/lib/support/session'
import { addNote } from '@/lib/support/timeline'
import { getServerSideURL } from '@/utilities/getURL'

/* Opening a case from the portal: the contact is the customer, the origin is Web, the attribution is their email.
   A screenshot or log becomes the first note so the engineer sees it in the Customer Service Hub timeline. */

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = /^(image\/(png|jpeg|gif|webp)|application\/(pdf|zip|x-zip-compressed)|text\/(plain|csv|log)|application\/octet-stream)$/i

const str = (form: FormData, k: string, max = 2000): string =>
  String(form.get(k) ?? '')
    .trim()
    .slice(0, max)

export async function openCase(form: FormData): Promise<void> {
  const ctx = await requireCustomer('/support/cases/new')
  const title = str(form, 'title', 200)
  const description = str(form, 'description', 8000)
  const productId = str(form, 'productId', 36)
  const categoryId = str(form, 'categoryId', 36)
  const subcategoryId = str(form, 'subcategoryId', 36)
  const productVersion = str(form, 'productVersion', 100)
  const serial = str(form, 'serial', 100)
  const file = form.get('file')

  const back = (err: string) => {
    const u = new URLSearchParams({ error: err, title, description, productId, categoryId, subcategoryId, productVersion, serial })
    redirect(`/support/cases/new?${u.toString()}`)
  }

  if (title.length < 4) back('title')
  if (description.length < 20) back('description')
  if (productId && !isGuid(productId)) back('product')
  if (categoryId && !isGuid(categoryId)) back('category')
  if (subcategoryId && !isGuid(subcategoryId)) back('category')

  let attachment: { name: string; mime: string; base64: string } | null = null
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_ATTACHMENT_BYTES) back('file-size')
    const mime = file.type || 'application/octet-stream'
    if (!ALLOWED_MIME.test(mime)) back('file-type')
    attachment = { name: file.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 200) || 'attachment', mime, base64: Buffer.from(await file.arrayBuffer()).toString('base64') }
  }

  let created: { id: string; ticket: string }
  try {
    created = await createCustomerCase(ctx.auth, ctx.scope, {
      title,
      description,
      productId: productId || undefined,
      categoryId: categoryId || undefined,
      subcategoryId: subcategoryId || undefined,
      productVersion: productVersion || undefined,
      serial: serial || undefined,
    })
  } catch (e) {
    const u = new URLSearchParams({ error: 'failed', message: userMessage(e, 'customer'), title, description, productId, categoryId, subcategoryId, productVersion, serial })
    redirect(`/support/cases/new?${u.toString()}`)
  }

  if (attachment) {
    try {
      await addNote(ctx.auth, created.id, { subject: 'Portal: attachment', text: `Attached when the case was opened: ${attachment.name}`, file: attachment })
    } catch {
      // The case exists; a failed attachment must not hide it. The customer can add the file again from the case page.
      redirect(`/support/cases/${encodeURIComponent(created.ticket)}?created=1&attach=failed`)
    }
  }

  try {
    await sendMail({ to: ctx.scope.email, ...caseCreatedMail(created.ticket, title, `${getServerSideURL()}/support/cases/${encodeURIComponent(created.ticket)}`) })
  } catch {
    /* mail is best effort */
  }

  redirect(`/support/cases/${encodeURIComponent(created.ticket)}?created=1`)
}
