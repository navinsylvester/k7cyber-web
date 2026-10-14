/* Structured errors for the Dataverse client. Never carry request or response bodies (PII discipline,
   docs/support-portal/07-production-safety.md §1b): only the OData error code, its message and the correlation id. */

export class DataverseError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly correlationId: string | undefined
  readonly retryAfter: number | undefined

  constructor(message: string, opts: { status: number; code?: string; correlationId?: string; retryAfter?: number }) {
    super(message)
    this.name = 'DataverseError'
    this.status = opts.status
    this.code = opts.code
    this.correlationId = opts.correlationId
    this.retryAfter = opts.retryAfter
  }

  get isThrottled(): boolean {
    return this.status === 429
  }
  get isConflict(): boolean {
    return this.status === 412
  }
  get isNotFound(): boolean {
    return this.status === 404
  }
  get isForbidden(): boolean {
    return this.status === 403 || this.status === 401
  }
}

/** Thrown before any network call when a write would reach the production host. */
export class ProductionWriteRefused extends Error {
  constructor(method: string, host: string) {
    super(`Refused ${method} to ${host}: production Dataverse is read-only for this portal (07-production-safety.md §1b).`)
    this.name = 'ProductionWriteRefused'
  }
}

/** Thrown when writes are attempted while DATAVERSE_WRITES_ENABLED is not "1". */
export class WritesDisabled extends Error {
  constructor(method: string) {
    super(`${method} refused: set DATAVERSE_WRITES_ENABLED=1 to allow writes against the UAT environment.`)
    this.name = 'WritesDisabled'
  }
}

/** Thrown when no token source can serve a call (missing sign-in or missing service credentials). */
export class NotAuthenticated extends Error {
  constructor(message = 'Not signed in.') {
    super(message)
    this.name = 'NotAuthenticated'
  }
}

/** A plain-language message for the UI; never leaks correlation ids or raw messages to customers. */
export const userMessage = (e: unknown, audience: 'agent' | 'customer' = 'agent'): string => {
  if (e instanceof ProductionWriteRefused) return 'This environment is read-only.'
  if (e instanceof WritesDisabled) return 'Changes are switched off in this environment.'
  if (e instanceof NotAuthenticated) return 'Your session has ended. Sign in again.'
  if (e instanceof DataverseError) {
    if (e.isThrottled) return 'The support system is busy. Try again in a moment.'
    if (e.isConflict) return 'Someone else changed this record first. Reload and try again.'
    if (e.isNotFound) return 'That record no longer exists.'
    if (e.isForbidden) return audience === 'agent' ? 'Your Dynamics role does not allow this.' : 'You do not have access to that.'
    return audience === 'agent' ? `The support system refused the request${e.code ? ` (${e.code})` : ''}.` : 'Something went wrong. Try again.'
  }
  return audience === 'agent' ? 'Unexpected error. Try again.' : 'Something went wrong. Try again.'
}
