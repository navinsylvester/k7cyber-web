import 'server-only'

import { bind, buildQuery, create, entity, guid, isGuid, list, or, retrieve, str, update, type DataverseAuth, type Row } from '@/lib/dataverse'

/* Contacts and accounts for the workspace (01-requirements.md §4.5) and the identity mapping for customers (§5.1).
   Duplicate detection is suppressed on create because UAT publishes name/email/phone rules the desk already lives with. */

export const CONTACT_SELECT = ['contactid', 'fullname', 'firstname', 'lastname', 'emailaddress1', 'mobilephone', 'telephone1', 'jobtitle', 'description', 'createdon', 'modifiedon', 'statecode', 'k7_verticaltype', 'msgdpr_gdprconsent', '_parentcustomerid_value', '_alletec_city_value', '_k7_state_value', '_k7_region_value', '_ownerid_value', 'adx_identity_username'] as const
export const ACCOUNT_SELECT = ['accountid', 'name', 'accountnumber', 'telephone1', 'emailaddress1', 'websiteurl', 'alletec_accountid', 'alletec_accounttype', 'alletec_lifecyclestage', 'k7_verticaltype', 'k7_description', 'createdon', 'modifiedon', 'statecode', '_primarycontactid_value', '_parentaccountid_value', '_alletec_city_value', '_k7_state_value', '_k7_region_value', '_alletec_country_value', '_ownerid_value', '_alletec_partneraccount_value'] as const

const SUPPRESS_DUPES = { 'MSCRM.SuppressDuplicateDetection': 'true' }

export type ContactRow = Row & { contactid: string; fullname: string; emailaddress1?: string | null }
export type AccountRow = Row & { accountid: string; name: string }

export const getContact = async (auth: DataverseAuth, id: string): Promise<ContactRow | null> => {
  if (!isGuid(id)) return null
  try {
    return await retrieve<ContactRow>(auth, `${entity('contacts', id)}?$select=${CONTACT_SELECT.join(',')}`)
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null
    throw e
  }
}

export const getAccount = async (auth: DataverseAuth, id: string): Promise<AccountRow | null> => {
  if (!isGuid(id)) return null
  try {
    return await retrieve<AccountRow>(auth, `${entity('accounts', id)}?$select=${ACCOUNT_SELECT.join(',')}`)
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null
    throw e
  }
}

export const searchContacts = async (auth: DataverseAuth, q: string, top = 25): Promise<ContactRow[]> => {
  const needle = q.trim()
  const filter = needle ? or(`contains(fullname,${str(needle)})`, `contains(emailaddress1,${str(needle)})`, `contains(mobilephone,${str(needle)})`) : 'statecode eq 0'
  const p = await list<ContactRow>(auth, buildQuery('contacts', { select: ['contactid', 'fullname', 'emailaddress1', 'mobilephone', 'k7_verticaltype', 'modifiedon', '_parentcustomerid_value', '_alletec_city_value'], filter, orderby: 'modifiedon desc', top }), top)
  return p.value
}

export const searchAccounts = async (auth: DataverseAuth, q: string, top = 25): Promise<AccountRow[]> => {
  const needle = q.trim()
  const filter = needle ? or(`contains(name,${str(needle)})`, `contains(accountnumber,${str(needle)})`, `contains(alletec_accountid,${str(needle)})`) : 'statecode eq 0'
  const p = await list<AccountRow>(auth, buildQuery('accounts', { select: ['accountid', 'name', 'accountnumber', 'alletec_accountid', 'alletec_accounttype', 'k7_verticaltype', 'modifiedon', '_alletec_city_value', '_primarycontactid_value'], filter, orderby: 'modifiedon desc', top }), top)
  return p.value
}

export const contactsOfAccount = async (auth: DataverseAuth, accountId: string, top = 50): Promise<ContactRow[]> => {
  const p = await list<ContactRow>(auth, buildQuery('contacts', { select: ['contactid', 'fullname', 'emailaddress1', 'mobilephone', 'jobtitle', 'modifiedon'], filter: `_parentcustomerid_value eq ${guid(accountId)}`, orderby: 'fullname', top }), top)
  return p.value
}

export const contractsOfAccount = async (auth: DataverseAuth, customerId: string, top = 25): Promise<Row[]> => {
  const p = await list<Row>(auth, buildQuery('alletec_k7contracts', { select: ['alletec_k7contractid', 'alletec_name', 'alletec_productkey', 'alletec_invoicedate', 'alletec_renewalprocessed', 'statecode', 'createdon', 'modifiedon'], filter: `_alletec_customer_value eq ${guid(customerId)}`, orderby: 'createdon desc', top }), top).catch(() => ({ value: [] as Row[] }))
  return p.value
}

export type ContactInput = { firstName: string; lastName?: string; email: string; mobile?: string; phone?: string; jobTitle?: string; accountId?: string | null; cityId?: string | null; stateId?: string | null; regionId?: string | null; vertical?: number; description?: string; portalUsername?: string }

const contactBody = (c: Partial<ContactInput>): Row => {
  const b: Row = {}
  if (c.firstName !== undefined) b.firstname = c.firstName.trim().slice(0, 50)
  if (c.lastName !== undefined) b.lastname = c.lastName.trim().slice(0, 50)
  if (c.email !== undefined) b.emailaddress1 = c.email.trim().toLowerCase()
  if (c.mobile !== undefined) b.mobilephone = c.mobile.trim()
  if (c.phone !== undefined) b.telephone1 = c.phone.trim()
  if (c.jobTitle !== undefined) b.jobtitle = c.jobTitle.trim()
  if (c.vertical !== undefined) b.k7_verticaltype = c.vertical
  if (c.description !== undefined) b.description = c.description
  if (c.portalUsername !== undefined) b.adx_identity_username = c.portalUsername
  if (c.accountId) b['parentcustomerid_account@odata.bind'] = bind('accounts', c.accountId)
  geoBind(b, c)
  return b
}

/* City, state and region: an id binds the lookup, null clears it (UAT accepts `"<nav>@odata.bind": null` on PATCH,
   checked 2026-10-24 on a contact), undefined leaves it alone. Before, an empty city was simply not sent and Dynamics kept
   the old one when the state changed (13-tester-round-1.md, TR-05). */
const geoBind = (b: Row, g: { cityId?: string | null; stateId?: string | null; regionId?: string | null }) => {
  if (g.cityId !== undefined) b['alletec_City@odata.bind'] = g.cityId ? bind('alletec_cities', g.cityId) : null
  if (g.stateId !== undefined) b['k7_State@odata.bind'] = g.stateId ? bind('k7_states', g.stateId) : null
  if (g.regionId !== undefined) b['k7_Region@odata.bind'] = g.regionId ? bind('k7_regions', g.regionId) : null
}

/** A new record has nothing to clear: the empty lookups are left out. */
const forCreate = (b: Row): Row => Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null))

export const createContact = async (auth: DataverseAuth, c: ContactInput): Promise<string> => create(auth, 'contacts', forCreate(contactBody(c)), SUPPRESS_DUPES)
export const updateContact = async (auth: DataverseAuth, id: string, c: Partial<ContactInput>): Promise<void> => update(auth, entity('contacts', id), contactBody(c))

export type AccountInput = { name: string; phone?: string; email?: string; website?: string; type?: number; vertical?: number; licenceKey?: string; cityId?: string | null; stateId?: string | null; regionId?: string | null; primaryContactId?: string | null }

const accountBody = (a: Partial<AccountInput>): Row => {
  const b: Row = {}
  if (a.name !== undefined) b.name = a.name.trim().slice(0, 160)
  if (a.phone !== undefined) b.telephone1 = a.phone.trim()
  if (a.email !== undefined) b.emailaddress1 = a.email.trim()
  if (a.website !== undefined) b.websiteurl = a.website.trim()
  if (a.type !== undefined) b.alletec_accounttype = a.type
  if (a.vertical !== undefined) b.k7_verticaltype = a.vertical
  if (a.licenceKey !== undefined) b.k7_description = a.licenceKey
  geoBind(b, a)
  if (a.primaryContactId) b['primarycontactid@odata.bind'] = bind('contacts', a.primaryContactId)
  return b
}

export const createAccount = async (auth: DataverseAuth, a: AccountInput): Promise<string> => create(auth, 'accounts', forCreate(accountBody(a)), SUPPRESS_DUPES)
export const updateAccount = async (auth: DataverseAuth, id: string, a: Partial<AccountInput>): Promise<void> => update(auth, entity('accounts', id), accountBody(a))

/* ---------- Identity: portal sign-in → contact (01-requirements.md §3.1, §5.1) ---------- */

export type Identity = { contactId: string; accountId: string | null; email: string; name: string; firstName: string; lastName: string; mobile: string; vertical: number | null }

const toIdentity = (c: ContactRow): Identity => ({
  contactId: c.contactid,
  accountId: c._parentcustomerid_value ? String(c._parentcustomerid_value) : null,
  email: String(c.emailaddress1 ?? ''),
  name: String(c.fullname ?? ''),
  firstName: String(c.firstname ?? ''),
  lastName: String(c.lastname ?? ''),
  mobile: String(c.mobilephone ?? ''),
  vertical: typeof c.k7_verticaltype === 'number' ? c.k7_verticaltype : null,
})

/** Duplicates exist per email: the newest-modified active contact wins (data-quality rule 1). */
export const findContactByEmail = async (auth: DataverseAuth, email: string): Promise<Identity | null> => {
  const e = email.trim().toLowerCase()
  if (!e) return null
  const p = await list<ContactRow>(auth, buildQuery('contacts', { select: [...CONTACT_SELECT], filter: `emailaddress1 eq ${str(e)} and statecode eq 0`, orderby: 'modifiedon desc', top: 2 }), 2)
  const c = p.value[0]
  return c ? toIdentity(c) : null
}

export const identityById = async (auth: DataverseAuth, contactId: string): Promise<Identity | null> => {
  const c = await getContact(auth, contactId)
  return c ? toIdentity(c) : null
}

export type Registration = { email: string; firstName: string; lastName?: string; mobile?: string; organisation?: string }

/** First sign-in creates the contact; an organisation name is recorded for the desk to link to an account later. */
export const registerContact = async (auth: DataverseAuth, r: Registration): Promise<Identity> => {
  const existing = await findContactByEmail(auth, r.email)
  if (existing) return existing
  const id = await createContact(auth, {
    firstName: r.firstName,
    lastName: r.lastName ?? '',
    email: r.email,
    mobile: r.mobile,
    vertical: r.organisation ? 100000001 : 100000000,
    description: `Registered on the K7 support portal on ${new Date().toISOString().slice(0, 10)}${r.organisation ? `. Organisation: ${r.organisation.trim()}` : ''}`,
    portalUsername: r.email.trim().toLowerCase(),
  })
  const created = await identityById(auth, id)
  if (!created) throw new Error('Contact created but not readable')
  return created
}
