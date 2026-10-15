import type { ItemKind, Priority, TrackerKind } from '../product-model'

/* The tracker behind an interface (docs/support-portal/10-product-desk.md §8). Nothing outside this folder imports an adapter;
   items store `tracker.kind`, so a switch of tracker leaves old items resolving their URLs. The UI reads `capabilities()` and hides
   what an adapter cannot do. Yodiz arrives in phase B; `none` is the link-only adapter phase A ships with. */

export type TrackerRef = { kind: TrackerKind; projectId: string; id: string; key: string; url: string }

export type TrackerStatus = { code: string; name: string; category: 'todo' | 'in-progress' | 'done' }

export type TrackerIssue = { ref: TrackerRef; title: string; status: TrackerStatus | null; responsible: string; release: string; updatedAt: string | null }

export type TrackerComment = { id: string; by: string; text: string; at: string }

export type TrackerChange = { ref: TrackerRef; status: TrackerStatus | null; release: string; responsible: string; updatedAt: string }

/** What principal support hands over when the issue is created. No contact details; the evidence as signed links. */
export type HandOff = { number: string; kind: ItemKind; title: string; summary: string; priority: Priority; productName: string; productFamily: string; affectedVersion: string; platform: string; impact: { cases: number; accounts: number; verticals: string[] }; evidenceLinks: { name: string; url: string }[]; portalUrl: string }

export type TrackerCapabilities = { create: boolean; setStatus: boolean; comment: boolean; attach: boolean; readComments: boolean; poll: boolean; webhook: boolean; releases: boolean }

export interface Tracker {
  readonly kind: TrackerKind
  readonly name: string
  capabilities(): TrackerCapabilities
  projects(): Promise<{ id: string; name: string }[]>
  statuses(projectId: string): Promise<TrackerStatus[]>
  create(projectId: string, h: HandOff): Promise<TrackerRef>
  get(ref: TrackerRef): Promise<TrackerIssue | null>
  setStatus(ref: TrackerRef, code: string): Promise<void>
  comment(ref: TrackerRef, text: string): Promise<void>
  attach(ref: TrackerRef, file: { name: string; mime: string; bytes: Buffer }): Promise<void>
  comments(ref: TrackerRef): Promise<TrackerComment[]>
  changesSince(projectId: string, since: Date): Promise<TrackerChange[]>
  /** Resolves a key typed by hand ("BG-3301") to a reference, verifying it when the adapter can. */
  resolve(projectId: string, key: string): Promise<TrackerRef | null>
  url(ref: TrackerRef): string
}

export class TrackerUnsupported extends Error {
  constructor(what: string, kind: TrackerKind) {
    super(`The ${kind} tracker cannot ${what}.`)
  }
}
