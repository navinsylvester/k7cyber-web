import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { CategoryPicker, CustomerAutofill } from '@/components/support/CasePickers.client'
import { Field, Flash, Options, PageHead, Req, RequiredNote } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { isGuid } from '@/lib/dataverse/odata'
import { fv } from '@/lib/dataverse/types'
import { contactsOfAccount, getAccount, getContact, searchAccounts, searchContacts, type AccountRow, type ContactRow } from '@/lib/support/customers'
import { CASE_TYPE, CONSIDERED_AS, CUSTOMER_TYPE, ORIGIN, PRIORITY, VERTICAL } from '@/lib/support/options'
import { getAgents, getCategories, getProducts, getSubcategories } from '@/lib/support/reference'
import { requireAgent } from '@/lib/support/session'

import { createCaseAction } from './actions'

export const metadata: Metadata = { title: 'New case' }

const PATH = `${WS}/cases/new`
type SP = { customer?: string; sel?: string; error?: string; title?: string; description?: string }

/* The agent's case form (01-requirements.md §4.3): find the customer first, then the facts. Defaults match the mobile app. */
export default async function NewCasePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const q = (sp.customer ?? '').trim()
  const [selKind, selId] = (sp.sel ?? '').split(':')
  const selected = (selKind === 'contact' || selKind === 'account') && isGuid(selId ?? '') ? { kind: selKind as 'contact' | 'account', id: selId! } : null
  const [contacts, accounts, selectedContact, selectedAccount, agents, products, categories, subcategories] = await Promise.all([
    q ? searchContacts(me.auth, q, 10).catch(() => [] as ContactRow[]) : Promise.resolve([] as ContactRow[]),
    q ? searchAccounts(me.auth, q, 10).catch(() => [] as AccountRow[]) : Promise.resolve([] as AccountRow[]),
    selected?.kind === 'contact' ? getContact(me.auth, selected.id).catch(() => null) : Promise.resolve(null),
    selected?.kind === 'account' ? getAccount(me.auth, selected.id).catch(() => null) : Promise.resolve(null),
    getAgents(me.auth).catch(() => []),
    getProducts(me.auth).catch(() => []),
    getCategories(me.auth).catch(() => []),
    getSubcategories(me.auth).catch(() => []),
  ])
  const accountContacts = selectedAccount ? await contactsOfAccount(me.auth, selectedAccount.accountid).catch(() => [] as ContactRow[]) : []
  const families = new Map<string, typeof products>()
  for (const p of products) families.set(p.family, [...(families.get(p.family) ?? []), p])
  const selHref = (kind: 'contact' | 'account', id: string) => `${PATH}?customer=${encodeURIComponent(q)}&sel=${kind}:${id}${sp.title ? `&title=${encodeURIComponent(sp.title)}` : ''}${sp.description ? `&description=${encodeURIComponent(sp.description)}` : ''}`
  const chosen = selectedContact ? { kind: 'contact' as const, id: selectedContact.contactid, name: selectedContact.fullname, detail: [selectedContact.emailaddress1, selectedContact.mobilephone ? String(selectedContact.mobilephone) : '', fv(selectedContact, '_parentcustomerid_value')].filter(Boolean).join(' · ') } : selectedAccount ? { kind: 'account' as const, id: selectedAccount.accountid, name: selectedAccount.name, detail: [String(selectedAccount.alletec_accountid ?? selectedAccount.accountnumber ?? ''), fv(selectedAccount, 'alletec_accounttype'), fv(selectedAccount, '_alletec_city_value')].filter(Boolean).join(' · ') } : null
  const inList = (kind: 'contact' | 'account', id: string) => (kind === 'contact' ? contacts.some((c) => c.contactid === id) : accounts.some((a) => a.accountid === id))
  // What a pick fills in (CustomerAutofill): a contact's email and vertical, an account's vertical.
  const verticalOf = (r: ContactRow | AccountRow | null) => (r && typeof r.k7_verticaltype === 'number' ? String(r.k7_verticaltype) : '')
  const fills = (r: ContactRow | AccountRow, kind: 'contact' | 'account') => ({ 'data-email': kind === 'contact' ? String((r as ContactRow).emailaddress1 ?? '') : undefined, 'data-vertical': verticalOf(r) })
  const chosenRow = selectedContact ?? selectedAccount

  return (
    <>
      <WorkspaceBar active="cases" />
      <section className="sheet ws g-paper">
        <PageHead
          above={
            <nav aria-label="Breadcrumb">
              <ol className="crumbs label" style={{ marginBottom: 0 }}>
                <li>
                  <Link href={`${WS}/cases`}>Cases</Link>
                </li>
                <li>
                  <span aria-current="page">New</span>
                </li>
              </ol>
            </nav>
          }
          title="New case"
          lede="Find the customer, then describe the problem. The case number is assigned when you save."
        />
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="form-sheet">
          <RequiredNote />
          <h2 className="block-title label">1 · Customer</h2>
          <form className="filters-inline" action={PATH} method="get" role="search" aria-label="Find the customer">
            {sp.title && <input type="hidden" name="title" value={sp.title} />}
            {sp.description && <input type="hidden" name="description" value={sp.description} />}
            {selected && <input type="hidden" name="sel" value={`${selected.kind}:${selected.id}`} />}
            <div className="field">
              <label className="label" htmlFor="customer-q">
                Name, email, mobile or account number
              </label>
              <span className="control">
                <input id="customer-q" name="customer" type="search" defaultValue={q} placeholder="Priya Raman, priya@example.com, 98400 00000" autoComplete="off" autoFocus={!q} />
              </span>
            </div>
            <div className="filters-actions">
              <button className="btn btn-line btn-sm" type="submit">
                Find
              </button>
              <Link className="link-u" href={`${WS}/customers/contacts/new?return=cases/new`}>
                Create a contact
              </Link>
            </div>
          </form>

          <form action={createCaseAction} className="form-grid" style={{ marginTop: 8 }}>
            <input type="hidden" name="customerQ" value={q} />
            <CustomerAutofill />
            {chosen && !inList(chosen.kind, chosen.id) && <input type="hidden" name="customer" value={`${chosen.kind}:${chosen.id}`} />}

            {q && contacts.length === 0 && accounts.length === 0 && !chosen && (
              <p className="hint span-2">
                Nobody matches “{q}”. Try another spelling, or <Link href={`${WS}/customers/contacts/new?return=cases/new`}>create the contact</Link>.
              </p>
            )}
            {(contacts.length > 0 || accounts.length > 0 || chosen) && (
              <fieldset className="span-2" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label" style={{ marginBottom: 10 }}>
                  Pick the customer
                  <Req />
                </legend>
                <div className="choice">
                  {chosen && !inList(chosen.kind, chosen.id) && (
                    <label>
                      <input type="radio" name="customer" value={`${chosen.kind}:${chosen.id}`} defaultChecked {...(chosenRow ? fills(chosenRow, chosen.kind) : {})} />
                      <span className="t">{chosen.name}</span>
                      <span className="d">
                        {chosen.kind === 'account' ? 'Account' : 'Contact'}
                        {chosen.detail ? ` · ${chosen.detail}` : ''}
                      </span>
                    </label>
                  )}
                  {contacts.map((c) => (
                    <label key={c.contactid}>
                      <input type="radio" name="customer" value={`contact:${c.contactid}`} defaultChecked={selected?.id === c.contactid} {...fills(c, 'contact')} />
                      <span className="t">{c.fullname}</span>
                      <span className="d">Contact · {[c.emailaddress1, c.mobilephone ? String(c.mobilephone) : '', fv(c, '_parentcustomerid_value')].filter(Boolean).join(' · ') || 'no details'}</span>
                    </label>
                  ))}
                  {accounts.map((a) => (
                    <label key={a.accountid}>
                      <input type="radio" name="customer" value={`account:${a.accountid}`} defaultChecked={selected?.id === a.accountid} {...fills(a, 'account')} />
                      <span className="t">{a.name}</span>
                      <span className="d">
                        Account · {[String(a.alletec_accountid ?? a.accountnumber ?? ''), fv(a, 'alletec_accounttype'), fv(a, '_alletec_city_value')].filter(Boolean).join(' · ') || 'no details'} ·{' '}
                        <Link href={selHref('account', a.accountid)} className="link-u" style={{ position: 'relative', zIndex: 1 }}>
                          choose a contact
                        </Link>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {selectedAccount && (
              <Field id="primaryContactId" label={`Primary contact at ${selectedAccount.name}`} select hint={accountContacts.length ? undefined : 'This account has no contacts yet.'}>
                <select id="primaryContactId" name="primaryContactId" defaultValue={selectedAccount._primarycontactid_value ? String(selectedAccount._primarycontactid_value) : ''}>
                  <option value="">None</option>
                  {accountContacts.map((c) => (
                    <option value={c.contactid} key={c.contactid}>
                      {c.fullname}
                      {c.emailaddress1 ? ` · ${c.emailaddress1}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <h2 className="block-title label span-2" style={{ marginTop: 24 }}>
              2 · The problem
            </h2>
            <Field id="title" label="Title" required span>
              <input id="title" name="title" required maxLength={200} defaultValue={sp.title ?? ''} placeholder="Unable to activate after reinstalling Windows" />
            </Field>
            <Field id="description" label="Description" span>
              <textarea id="description" name="description" rows={5} defaultValue={sp.description ?? ''} placeholder="What the customer reported, what was tried, what to check next." />
            </Field>
            <Field id="origin" label="Source of ticket" select>
              <select id="origin" name="origin" defaultValue="1">
                <Options items={ORIGIN} />
              </select>
            </Field>
            <Field id="priority" label="Priority" select>
              <select id="priority" name="priority" defaultValue="2">
                <Options items={PRIORITY} />
              </select>
            </Field>
            <Field id="productId" label="Product" select>
              <select id="productId" name="productId" defaultValue="">
                <option value="">Not known yet</option>
                {[...families.entries()].map(([fam, list]) => (
                  <optgroup label={fam} key={fam}>
                    {list.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field id="customerEmail" label="Customer email">
              <input id="customerEmail" name="customerEmail" type="email" defaultValue={selectedContact?.emailaddress1 ?? ''} />
            </Field>
            <CategoryPicker mode="select" categories={categories} subcategories={subcategories} subLabel="Sub category" />
            <Field id="vertical" label="Vertical" select>
              <select id="vertical" name="vertical" defaultValue={verticalOf(chosenRow)}>
                <Options items={VERTICAL} empty="Not set" />
              </select>
            </Field>
            <Field id="customerType" label="Customer type" select>
              <select id="customerType" name="customerType" defaultValue="">
                <Options items={CUSTOMER_TYPE} empty="Not set" />
              </select>
            </Field>
            <Field id="caseType" label="Case type" select>
              <select id="caseType" name="caseType" defaultValue="1">
                <Options items={CASE_TYPE} />
              </select>
            </Field>
            <Field id="consideredAs" label="Considered as" select>
              <select id="consideredAs" name="consideredAs" defaultValue="">
                <Options items={CONSIDERED_AS} empty="Decide later" />
              </select>
            </Field>

            <h2 className="block-title label span-2" style={{ marginTop: 24 }}>
              3 · Product details
            </h2>
            <Field id="productVersion" label="Product version">
              <input id="productVersion" name="productVersion" placeholder="16.0.1234" />
            </Field>
            <Field id="serial" label="Serial key">
              <input id="serial" name="serial" spellCheck={false} />
            </Field>
            <Field id="incidentId" label="Incident ID">
              <input id="incidentId" name="incidentId" spellCheck={false} />
            </Field>
            <Field id="module" label="Module">
              <input id="module" name="module" />
            </Field>
            <Field id="submodule" label="Sub module">
              <input id="submodule" name="submodule" />
            </Field>

            <h2 className="block-title label span-2" style={{ marginTop: 24 }}>
              4 · Owner
            </h2>
            <Field id="ownerId" label="Assign to" select>
              <select id="ownerId" name="ownerId" defaultValue={me.userId}>
                {agents.map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                    {a.id === me.userId ? ' (me)' : ''}
                  </option>
                ))}
              </select>
            </Field>

            <div className="form-actions span-2">
              <button className="btn btn-primary" type="submit">
                Create case →
              </button>
              <Link className="link-u" href={`${WS}/cases`}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </section>
    </>
  )
}
