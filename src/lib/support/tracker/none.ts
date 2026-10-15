import type { Tracker, TrackerCapabilities, TrackerChange, TrackerComment, TrackerIssue, TrackerRef, TrackerStatus } from './port'
import { TrackerUnsupported } from './port'

/* Link-only: keys are typed by hand on the item, nothing is called. Phase A's adapter, and the fallback when the configured tracker
   is unreachable. A `urlPattern` ("https://app.yodiz.com/…/{key}") makes the typed keys clickable. */

export class NoneTracker implements Tracker {
  readonly kind = 'none' as const
  readonly name = 'Link only'
  constructor(private readonly urlPattern = '') {}

  capabilities(): TrackerCapabilities {
    return { create: false, setStatus: false, comment: false, attach: false, readComments: false, poll: false, webhook: false, releases: false }
  }
  async projects() {
    return [] as { id: string; name: string }[]
  }
  async statuses(): Promise<TrackerStatus[]> {
    return []
  }
  async create(): Promise<TrackerRef> {
    throw new TrackerUnsupported('create issues', 'none')
  }
  async get(): Promise<TrackerIssue | null> {
    return null
  }
  async setStatus(): Promise<void> {
    throw new TrackerUnsupported('change a status', 'none')
  }
  async comment(): Promise<void> {
    /* nothing to send to */
  }
  async attach(): Promise<void> {
    throw new TrackerUnsupported('attach files', 'none')
  }
  async comments(): Promise<TrackerComment[]> {
    return []
  }
  async changesSince(): Promise<TrackerChange[]> {
    return []
  }
  async resolve(projectId: string, key: string): Promise<TrackerRef | null> {
    const k = key.trim().toUpperCase()
    if (!/^[A-Z]{1,6}-?\d{1,8}$/.test(k)) return null
    const ref: TrackerRef = { kind: 'none', projectId, id: k, key: k, url: '' }
    ref.url = this.url(ref)
    return ref
  }
  url(ref: TrackerRef): string {
    return ref.url || (this.urlPattern ? this.urlPattern.replace('{key}', encodeURIComponent(ref.key)).replace('{id}', encodeURIComponent(ref.id)) : '')
  }
}
