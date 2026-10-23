import type { Access, FieldAccess } from 'payload'

import type { User } from '@/payload-types'

export type Role = 'admin' | 'labsEditor' | 'marketingEditor' | 'trainingEditor'

export const hasRole = (user: User | null | undefined, roles: Role[]): boolean => {
  const mine = (user?.roles ?? []) as Role[]
  return mine.includes('admin') || roles.some((r) => mine.includes(r))
}

/** Collection access: any of the given roles (admins always pass). */
export const roleAccess =
  (...roles: Role[]): Access =>
  ({ req: { user } }) =>
    hasRole(user, roles)

export const adminOnly: Access = ({ req: { user } }) => hasRole(user, [])
export const adminOnlyField: FieldAccess = ({ req: { user } }) => hasRole(user, [])
