import 'server-only'

import { DataverseError } from '@/lib/dataverse/errors'
import { guid, retrieve, type DataverseAuth } from '@/lib/dataverse'

import { memo } from './memo'
import { isSecuredRefusalCode, rightsFrom, writeAroundSecured as around, type AttributePrivilege, type Rights } from './field-security-model'

/* Dynamics field security, the half that asks Dataverse (the rules are in field-security-model.ts). The secured columns are
   metadata, the same for everyone, read once an hour; a user's privileges are read as that user and kept five minutes, so a
   profile granted in Dynamics shows in the portal within five minutes. */

const HOUR = 60 * 60 * 1000
const FIVE_MIN = 5 * 60 * 1000

export type SecuredEntity = 'incident' | 'k7_rfe' | 'k7_defect'

const securedOf = (auth: DataverseAuth, entity: SecuredEntity): Promise<{ id: string; column: string }[]> =>
  memo(`fls:cols:${entity}`, HOUR, async () => {
    const r = await retrieve<{ value: { LogicalName: string; MetadataId: string }[] }>(
      auth,
      `EntityDefinitions(LogicalName='${entity}')/Attributes?$select=LogicalName,MetadataId&$filter=IsSecured eq true`,
    )
    return (r.value ?? []).map((a) => ({ id: a.MetadataId, column: a.LogicalName }))
  })

export const securedColumns = async (auth: DataverseAuth, entity: SecuredEntity): Promise<string[]> => (await securedOf(auth, entity)).map((s) => s.column)

/** What the user may do with each secured column of the entity, or null when Dataverse would not say (then nothing is locked in
    the form and a refused write is retried without the secured columns). */
export const columnRights = async (auth: DataverseAuth, userId: string, entity: SecuredEntity): Promise<Rights | null> => {
  try {
    const [secured, privileges] = await Promise.all([
      securedOf(auth, entity),
      memo(`fls:priv:${guid(userId)}`, FIVE_MIN, async () => {
        const r = await retrieve<{ AttributePrivileges?: AttributePrivilege[] }>(auth, `systemusers(${guid(userId)})/Microsoft.Dynamics.CRM.RetrievePrincipalAttributePrivileges()`)
        return r.AttributePrivileges ?? []
      }),
    ])
    return rightsFrom(secured, privileges)
  } catch {
    return null
  }
}

export const isSecuredRefusal = (e: unknown): boolean => e instanceof DataverseError && isSecuredRefusalCode(e.code)

/** Writes `body` to the entity; a refusal for a secured column is retried without the entity's secured columns. */
export const writeAroundSecured = <T, B extends Record<string, unknown>>(auth: DataverseAuth, entity: SecuredEntity, body: B, write: (b: B) => Promise<T>) =>
  around(body, write, () => securedColumns(auth, entity), isSecuredRefusal)
