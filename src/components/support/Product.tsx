import Link from 'next/link'
import React from 'react'

import { bytes, dmyHm, relative } from '@/lib/support/format'
import { EVENT_LABEL, KIND_LABEL, SIDE_LABEL, STATE_LABEL, WITH_LABEL, withOf, type ItemCase, type ItemEvent, type ItemRow, type ItemState, type ProductSettings, type Side } from '@/lib/support/product-model'
import { fmtLeft, type SlaReading } from '@/lib/support/sla'

import { Avatar } from './Parts'

/* Section 10 · Product desk parts (S25–S29, docs/support-portal/10-product-desk.md §11). The item reads like a case: `PD-` dim, the
   digits full weight. Kind and bridge state share one tag; the tracker status sits beside it in mono. Sides read by weight: support
   outlined, principal support outlined with a dot, engineering and the Lab solid. No second hue. */

export const PRODUCT = '/support/product'
export const itemHref = (number: string) => `${PRODUCT}/items/${number}`

/** The item number: PD-0042 with the prefix dim. */
export const Pid: React.FC<{ number: string; href?: string; display?: boolean }> = ({ number, href, display }) => {
  const [pre, id] = number.split('-')
  const inner = (
    <>
      <span className="pre">{pre}-</span>
      {id}
    </>
  )
  const cls = display ? 'tid tid-display' : 'tid'
  return href ? (
    <Link className={cls} href={href}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  )
}

/** S25 Item tag: kind and bridge state as one Tag; signal only where someone has to act now. */
export const ItemTag: React.FC<{ item: Pick<ItemRow, 'kind' | 'state' | 'team' | 'tracker'>; audience?: 'support' | 'principal'; triage?: SlaReading | null; kind?: boolean }> = ({ item, audience = 'support', triage, kind = true }) => {
  const signal = (audience === 'support' && item.state === 'needs-info') || (audience === 'principal' && item.state === 'raised' && triage?.state === 'breached')
  const cls = `tag item-tag${signal ? ' tag-signal' : item.state === 'released' ? ' tag-solid' : item.state === 'declined' || item.state === 'closed' ? ' tag-closed' : ''}`
  return (
    <>
      <span className={cls}>
        {kind ? `${KIND_LABEL[item.kind]} · ` : ''}
        {STATE_LABEL[item.state]}
      </span>
      {item.tracker.key && (
        <span className="label muted tracker-ref">
          {item.tracker.url ? (
            <a href={item.tracker.url} target="_blank" rel="noreferrer">
              {item.tracker.key}
            </a>
          ) : (
            item.tracker.key
          )}
          {item.tracker.status ? ` · ${item.tracker.status}` : ''}
        </span>
      )}
    </>
  )
}

export const WithTag: React.FC<{ state: ItemState; team: ItemRow['team'] }> = ({ state, team }) => {
  const w = withOf(state, team)
  return w === 'none' ? null : <span className="label muted">{WITH_LABEL[w]}</span>
}

export const PriorityTag: React.FC<{ priority: ItemRow['priority'] }> = ({ priority }) => <span className={`tag tag-quiet prio${priority === 'P1' ? ' tag-signal' : ''}`}>{priority}</span>

/** S26 Product band: one line under a case head while an item is active. The one action that fits comes from the caller. */
export const ProductBand: React.FC<{ item: ItemRow; link: ItemCase; settings: ProductSettings; last?: string; action?: React.ReactNode }> = ({ item, link, settings, last, action }) => {
  const team = settings.teams.find((t) => t.key === item.team)?.name ?? item.team
  const ask = item.state === 'needs-info'
  return (
    <div className={`product-band${ask ? ' is-ask' : ''}`} role="note">
      <Pid number={item.number} href={itemHref(item.number)} />
      <ItemTag item={item} />
      <span className="label muted">
        {team}
        {item.productOwner ? ` · ${item.productOwner.split('@')[0]}` : ''} · {item.priority}
        {item.releasedVersion ? ` · ${item.releasedVersion}` : item.fixedVersion ? ` · fixed in ${item.fixedVersion}` : ''}
        {item.caseCount > 1 ? ` · ${item.caseCount} cases` : ''}
      </span>
      <WithTag state={item.state} team={item.team} />
      {link.caseChoice === 'workaround-resolved' && <span className="label muted">workaround given</span>}
      {last && <span className="band-last">{last}</span>}
      {action && <span className="band-act">{action}</span>}
    </div>
  )
}

/** S28 Impact strip: the demand behind an item in five counters. */
export const ImpactStrip: React.FC<{ item: ItemRow; cases: ItemCase[]; verticalLabel: (v: number | null) => string }> = ({ item, cases, verticalLabel }) => {
  const accounts = new Set(cases.filter((c) => c.accountName).map((c) => c.accountName))
  const verticals = new Set(cases.map((c) => verticalLabel(c.vertical)).filter(Boolean))
  const first = cases.reduce<string | null>((a, c) => (a === null || c.linkedAt < a ? c.linkedAt : a), null)
  const last = cases.reduce<string | null>((a, c) => (a === null || c.linkedAt > a ? c.linkedAt : a), null)
  const grew = Boolean(item.triagedAt && last && last > item.triagedAt)
  const cell = (k: string, v: React.ReactNode, hot = false) => (
    <div className={`impact-cell${hot ? ' is-hot' : ''}`} key={k}>
      <span className="label">{k}</span>
      <span className="n">{v}</span>
    </div>
  )
  return (
    <div className="impact" aria-label="Impact">
      {cell('Cases', cases.length, grew)}
      {cell('B2B accounts', accounts.size)}
      {cell('Verticals', verticals.size ? [...verticals].join(', ') : '—')}
      {cell('First raised', first ? relative(first) : '—')}
      {cell('Last raised', last ? relative(last) : '—')}
    </div>
  )
}

/** S29 Triage clock / cadence: the product side's meter in the SLA meter's shape. */
export const Clock: React.FC<{ r: SlaReading; label: string; compact?: boolean }> = ({ r, label, compact }) => {
  if (r.state === 'none') return null
  const width = Math.min(100, Math.round(r.ratio * 100))
  return (
    <span className={`slam is-${r.state}${compact ? ' is-compact' : ''}`} title={`${label}: ${fmtLeft(r)}`}>
      {!compact && <span className="label">{label}</span>}
      <span className="slam-bar">
        <i style={{ width: `${width}%` }} />
      </span>
      <span className="slam-left">{fmtLeft(r)}</span>
    </span>
  )
}

const sideClass = (side: Side) => (side === 'support' ? 'is-support' : side === 'principal' ? 'is-principal' : side === 'system' ? 'is-system' : 'is-product')

/** S27 Hand-off thread: one stream for both sides, newest first. State and tracker entries carry dashed tags; system entries dotted. */
export const Thread: React.FC<{ events: ItemEvent[]; itemNumber: string }> = ({ events, itemNumber }) => {
  if (!events.length) return null
  return (
    <div className="tl thread">
      {events.map((e) => {
        const change = e.kind === 'state' || e.kind === 'tracker-status' || e.kind === 'route' || e.kind === 'priority' || e.kind === 'link' || e.kind === 'unlink' || e.kind === 'told'
        const system = e.side === 'system'
        const name = system ? 'Portal' : e.by.name || e.by.email || SIDE_LABEL[e.side]
        return (
          <div className={`tl-row thread-row ${sideClass(e.side)}${change ? ' is-change' : ''}${system ? ' is-system' : ''}`} key={e.id}>
            <time className="tl-when" dateTime={e.at} title={relative(e.at)}>
              {dmyHm(e.at)}
            </time>
            <div>
              <div className="tl-meta">
                {!system && <Avatar name={name} />}
                <span className={`tag${change || system ? ' tag-dashed' : e.kind === 'ask' ? ' tag-signal' : ''}`}>
                  {EVENT_LABEL[e.kind]}
                  {e.from && e.to ? ` · ${STATE_LABEL[e.from]} → ${STATE_LABEL[e.to]}` : e.to ? ` · ${STATE_LABEL[e.to]}` : ''}
                </span>
                <span className="tl-by">
                  {name}
                  {!system && e.side !== 'support' ? ` · ${SIDE_LABEL[e.side]}` : ''}
                </span>
                {e.caseTicket && <span className="label muted">{e.caseTicket}</span>}
              </div>
              {e.text && <div className={`tl-body${system ? ' muted' : ''}`}>{e.text}</div>}
              {e.evidence.length > 0 && (
                <div className="msg-att" style={{ marginTop: 10 }}>
                  {e.evidence.map((a) => (
                    <a className="tag" href={a.url} key={a.id} title={`${a.mime} · ${itemNumber}`}>
                      {a.name}
                      {a.size ? ` · ${bytes(a.size)}` : ''}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** A row of the inbox or the agent's list: number, title, tags, the facts, the clock, one action. */
export const ItemRowLine: React.FC<{ item: ItemRow; settings: ProductSettings; audience: 'support' | 'principal'; clock?: SlaReading | null; clockLabel?: string; facts?: React.ReactNode; action?: React.ReactNode }> = ({ item, settings, audience, clock, clockLabel = 'Triage', facts, action }) => {
  const team = settings.teams.find((t) => t.key === item.team)?.name ?? item.team
  return (
    <div className={`board-row item-row${item.state === 'needs-info' && audience === 'support' ? ' is-ask' : ''}`}>
      <div>
        <div className="t">
          <Pid number={item.number} href={itemHref(item.number)} /> <Link href={itemHref(item.number)}>{item.title}</Link>
        </div>
        <div className="s">
          <ItemTag item={item} audience={audience} triage={clock} />
          <PriorityTag priority={item.priority} />
          <span>{team}</span>
          {item.productFamily && <span>{item.productFamily}</span>}
          <span>{item.caseCount === 1 ? '1 case' : `${item.caseCount} cases`}</span>
          <WithTag state={item.state} team={item.team} />
          {facts}
        </div>
      </div>
      <div className="item-row-clock">
        {clock && clock.state !== 'none' && <Clock r={clock} label={clockLabel} compact />}
        <span className="label muted" title={dmyHm(item.lastActivityAt)}>
          {relative(item.lastActivityAt)}
        </span>
      </div>
      {action && <div className="acts-inline">{action}</div>}
    </div>
  )
}

/** The product desk's sub-navigation under the workspace bar. */
export const ProductNav: React.FC<{ active: 'inbox' | 'items' | 'settings'; lead?: boolean; counts?: { raised: number; needsInfo: number } }> = ({ active, lead, counts }) => {
  const tabs: { key: typeof active; label: string; href: string }[] = [
    { key: 'inbox', label: `Inbox${counts ? ` · ${counts.raised + counts.needsInfo}` : ''}`, href: PRODUCT },
    { key: 'items', label: 'All items', href: `${PRODUCT}/items` },
  ]
  if (lead) tabs.push({ key: 'settings', label: 'Settings', href: `${PRODUCT}/settings` })
  return (
    <nav className="rtabs manage-nav" aria-label="Product desk">
      {tabs.map((t) => (
        <Link className="rtab label on-paper" href={t.href} key={t.key} {...(t.key === active ? { 'aria-current': 'page' as const } : {})}>
          <span className="pixel" aria-hidden="true" />
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
