'use server'

import { redirect } from 'next/navigation'

import { userMessage } from '@/lib/dataverse/errors'
import { getContact, updateContact } from '@/lib/support/customers'
import { requireCustomer } from '@/lib/support/session'

/* The customer edits their own contact row: only the fields that changed are sent (07-production-safety.md §3). */

const PHONE = /^\+?[0-9 ()-]{6,20}$/

export async function updateProfile(form: FormData): Promise<void> {
  const ctx = await requireCustomer('/support/profile')
  const firstName = String(form.get('firstName') ?? '').trim().slice(0, 50)
  const lastName = String(form.get('lastName') ?? '').trim().slice(0, 50)
  const mobile = String(form.get('mobile') ?? '').trim().slice(0, 20)
  const phone = String(form.get('phone') ?? '').trim().slice(0, 20)
  if (firstName.length < 2) redirect('/support/profile?error=name')
  if (mobile && !PHONE.test(mobile)) redirect('/support/profile?error=mobile')
  if (phone && !PHONE.test(phone)) redirect('/support/profile?error=phone')

  const current = await getContact(ctx.auth, ctx.scope.contactId)
  if (!current) redirect('/support/sign-in')
  const patch: { firstName?: string; lastName?: string; mobile?: string; phone?: string } = {}
  if (firstName !== String(current.firstname ?? '')) patch.firstName = firstName
  if (lastName !== String(current.lastname ?? '')) patch.lastName = lastName
  if (mobile !== String(current.mobilephone ?? '')) patch.mobile = mobile
  if (phone !== String(current.telephone1 ?? '')) patch.phone = phone
  if (Object.keys(patch).length === 0) redirect('/support/profile?saved=same')
  try {
    await updateContact(ctx.auth, ctx.scope.contactId, patch)
  } catch (e) {
    redirect(`/support/profile?error=failed&message=${encodeURIComponent(userMessage(e, 'customer'))}`)
  }
  redirect('/support/profile?saved=1')
}
