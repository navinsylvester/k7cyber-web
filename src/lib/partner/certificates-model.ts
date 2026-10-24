import type { PartnerType } from './settings-model'

/* Certificates as the code reads them (01-requirements.md §4 FR-TRN-07–10, §5 FR-CRT-01–07; 02-build-plan.md M11, decision 12):
   an individual certificate is issued when a learner passes a course's test; an organisation certificate is issued by the
   Channel Manager once the organisation meets K7's rule for its partner type (so many people certified on each track). Both
   carry an unguessable number (`K7P-C-xxxxxx`, `K7P-O-xxxxxx`), an issue date, an expiry (12 months by default) and a QR to
   the public verification page. Everything here is pure: the numbers, the score band, the expiry maths, the state a certificate
   is in today (valid, expiring soon, expired, revoked …), the rule per partner type, when a new pass earns a new certificate
   and when a reminder is due. `certificates.ts` reads and writes; `certificate-pdf.ts` draws. Tested without a tenant. */

export const CERT_KINDS = ['individual', 'org'] as const
export type CertKind = (typeof CERT_KINDS)[number]
export const CERT_KIND_LABEL: Record<CertKind, string> = { individual: 'Individual certificate', org: 'Partner certificate' }

/** `requested` and `declined` are the organisation certificate's two steps before and beside issue (FR-CRT-02); `superseded`
    is an individual certificate replaced by a recertification before it expired (FR-TRN-10). */
export const CERT_STATUSES = ['requested', 'valid', 'expired', 'revoked', 'declined', 'superseded'] as const
export type CertStatus = (typeof CERT_STATUSES)[number]

/** What a certificate is today: its status, except that a valid one inside the reminder window reads *expiring*. */
export type CertState = CertStatus | 'expiring'
export const CERT_STATE_LABEL: Record<CertState, string> = {
  requested: 'Requested',
  valid: 'Valid',
  expiring: 'Expiring soon',
  expired: 'Expired',
  revoked: 'Revoked',
  declined: 'Declined',
  superseded: 'Superseded',
}

export const CERT_PREFIX: Record<CertKind, string> = { individual: 'K7P-C-', org: 'K7P-O-' }
/** Thirty symbols without the look-alikes (0 O, 1 I L, U V): six of them read aloud without error and are not guessed in order. */
export const CERT_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
export const CERT_NUMBER = /^K7P-(C|O)-([2-9A-HJKMNP-TV-Z]{6})$/

export const SCORE_BANDS = ['Pass', 'Merit', 'Distinction'] as const
export type ScoreBand = (typeof SCORE_BANDS)[number]

export type Certificate = {
  id: string
  number: string
  kind: CertKind
  status: CertStatus
  orgId: string
  orgName: string
  orgTradeName: string
  orgPartnerId: string
  orgType: PartnerType | ''
  /** The individual certificate's holder. */
  userId: string
  userName: string
  userEmail: string
  courseId: string
  courseTitle: string
  courseVersion: number
  trackKey: string
  trackName: string
  attemptId: string
  score: number | null
  band: ScoreBand | ''
  issuedAt: string | null
  expiresAt: string | null
  /** FR-CRT-02: the request raised when the rule was first met, with the rule as it stood. */
  requestedAt: string | null
  ruleLines: RuleLine[]
  issuedBy: string
  declinedAt: string | null
  declinedReason: string
  revokedAt: string | null
  revokedReason: string
  revokedBy: string
  supersededBy: string
  renewalOf: string
  /** FR-TRN-10, FR-CRT-06: the reminder sent per threshold (days before expiry → when). */
  reminded: Record<string, string>
  fileId: string
  createdAt: string
  updatedAt: string
}

/* ---------- Settings ---------- */

export type CertRule = { type: PartnerType; track: string; people: number }

export type CertificateSettings = {
  /** FR-TRN-10: months an individual certificate stands. */
  validityMonths: number
  /** FR-CRT-05: months the organisation certificate stands. */
  orgValidityMonths: number
  /** FR-TRN-10, FR-CRT-06: the days before expiry at which the holder is reminded, largest first. */
  reminderDays: number[]
  /** FR-TRN-07's score band: Merit from this score, Distinction from that one; Pass below. */
  meritFrom: number
  distinctionFrom: number
  /** FR-CRT-01: per partner type, how many people must hold a valid certificate on each track. */
  rules: CertRule[]
  /** FR-CRT-03: the authorised signatory printed on the organisation certificate; the image comes from PARTNER_CERT_SIGNATORY. */
  signatoryName: string
  signatoryTitle: string
  issuer: string
}

const TYPES: readonly PartnerType[] = ['distributor', 'integrationPartner', 'var', 'msp']

export const DEFAULT_CERTIFICATE_SETTINGS: CertificateSettings = {
  validityMonths: 12,
  orgValidityMonths: 12,
  reminderDays: [60, 30],
  meritFrom: 85,
  distinctionFrom: 95,
  rules: TYPES.flatMap((type) => [
    { type, track: 'sales', people: 1 },
    { type, track: 'technical', people: 1 },
  ]),
  signatoryName: '',
  signatoryTitle: 'Authorised signatory',
  issuer: 'K7 Computing Private Limited',
}

type Raw = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)
const int = (v: unknown, d: number, min: number, max = 10_000): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : d
}
const d = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const relId = (v: unknown): string => s(typeof v === 'object' && v !== null ? (v as Raw).id : v)

/** The reminder days from a list or a "60, 30" text: whole days, unique, largest first, at most five. */
export const parseReminderDays = (v: unknown): number[] => {
  const raw: unknown[] = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\s,;]+/) : []
  const days = raw.map((x) => (typeof x === 'object' && x !== null ? (x as Raw).days : x)).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 365)
  return [...new Set(days)].sort((a, b) => b - a).slice(0, 5)
}

export const normaliseCertificateSettings = (r: Raw | null | undefined): CertificateSettings => {
  const D = DEFAULT_CERTIFICATE_SETTINGS
  const x = r ?? {}
  const merit = int(x.meritFrom, D.meritFrom, 1, 100)
  const distinction = Math.max(merit, int(x.distinctionFrom, D.distinctionFrom, 1, 100))
  const reminderDays = parseReminderDays(x.reminderDays)
  const rules = Array.isArray(x.rules)
    ? x.rules
        .filter((y): y is Raw => Boolean(y) && typeof y === 'object')
        .map((y) => ({ type: s(y.type) as PartnerType, track: s(y.track).trim().toLowerCase(), people: int(y.people, 0, 0, 1000) }))
        .filter((y) => TYPES.includes(y.type) && y.track)
    : null
  return {
    validityMonths: int(x.validityMonths, D.validityMonths, 1, 120),
    orgValidityMonths: int(x.orgValidityMonths, D.orgValidityMonths, 1, 120),
    reminderDays: reminderDays.length ? reminderDays : [...D.reminderDays],
    meritFrom: merit,
    distinctionFrom: distinction,
    // No rows at all (the global never saved the group, or Payload read an empty array) means the defaults; a type is
    // excluded by rows with 0 people, which the settings page always posts.
    rules: rules === null || rules.length === 0 ? D.rules.map((q) => ({ ...q })) : rules,
    signatoryName: str(x.signatoryName, D.signatoryName).trim(),
    signatoryTitle: str(x.signatoryTitle, D.signatoryTitle).trim() || D.signatoryTitle,
    issuer: str(x.issuer, D.issuer).trim() || D.issuer,
  }
}

/* ---------- Readers ---------- */

export const toCertificate = (x: Raw): Certificate => {
  const org = typeof x.org === 'object' && x.org !== null ? (x.org as Raw) : null
  const user = typeof x.user === 'object' && x.user !== null ? (x.user as Raw) : null
  const course = typeof x.course === 'object' && x.course !== null ? (x.course as Raw) : null
  const reminded = x.reminded && typeof x.reminded === 'object' && !Array.isArray(x.reminded) ? Object.fromEntries(Object.entries(x.reminded as Raw).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v as string])) : {}
  const score = typeof x.score === 'number' && Number.isFinite(x.score) ? x.score : null
  return {
    id: s(x.id),
    number: s(x.number),
    kind: x.kind === 'org' ? 'org' : 'individual',
    status: (CERT_STATUSES as readonly string[]).includes(s(x.status)) ? (s(x.status) as CertStatus) : 'valid',
    orgId: relId(x.org),
    orgName: s(x.orgName) || s(org?.name),
    orgTradeName: s(x.orgTradeName) || s(org?.tradeName),
    orgPartnerId: s(x.orgPartnerId) || s(org?.partnerId),
    orgType: TYPES.includes(s(x.orgType) as PartnerType) ? (s(x.orgType) as PartnerType) : TYPES.includes(s(org?.type) as PartnerType) ? (s(org?.type) as PartnerType) : '',
    userId: relId(x.user),
    userName: s(x.userName) || s(user?.name),
    userEmail: s(x.userEmail) || s(user?.email),
    courseId: relId(x.course),
    courseTitle: s(x.courseTitle) || s(course?.title),
    courseVersion: Math.max(0, Math.round(Number(x.courseVersion) || 0)),
    trackKey: s(x.trackKey),
    trackName: s(x.trackName),
    attemptId: relId(x.attempt),
    score,
    band: (SCORE_BANDS as readonly string[]).includes(s(x.band)) ? (s(x.band) as ScoreBand) : '',
    issuedAt: d(x.issuedAt),
    expiresAt: d(x.expiresAt),
    requestedAt: d(x.requestedAt),
    ruleLines: Array.isArray(x.ruleLines) ? x.ruleLines.filter((l): l is Raw => Boolean(l) && typeof l === 'object').map((l) => ({ track: s(l.track), trackName: s(l.trackName), need: Number(l.need) || 0, have: Number(l.have) || 0 })) : [],
    issuedBy: s(x.issuedBy),
    declinedAt: d(x.declinedAt),
    declinedReason: s(x.declinedReason),
    revokedAt: d(x.revokedAt),
    revokedReason: s(x.revokedReason),
    revokedBy: s(x.revokedBy),
    supersededBy: s(x.supersededBy),
    renewalOf: s(x.renewalOf),
    reminded,
    fileId: relId(x.file),
    createdAt: s(x.createdAt),
    updatedAt: s(x.updatedAt),
  }
}

/* ---------- Numbers ---------- */

/** `K7P-C-7KQ2MX`: six symbols from the alphabet, picked from the bytes given (random ones in the library). */
export const certificateNumber = (kind: CertKind, bytes: Uint8Array): string => {
  if (bytes.length < 6) throw new Error('six bytes needed')
  let out = ''
  for (let i = 0; i < 6; i++) out += CERT_ALPHABET[bytes[i]! % CERT_ALPHABET.length]
  return `${CERT_PREFIX[kind]}${out}`
}

/** A number as typed or scanned: upper-cased, spaces and dash variants normalised, the `K7P-` prefix optional; null unless
    it has the shape. Nothing is guessed: a 0, O, 1, I, L or U is not in the alphabet and refuses. */
export const parseCertificateNumber = (raw: string): string | null => {
  const t = raw.trim().toUpperCase().replace(/\s+/g, '').replace(/[–—]/g, '-')
  const m = /^(?:K7P-?)?([CO])-?([0-9A-Z]{6})$/.exec(t)
  if (!m) return null
  const n = `K7P-${m[1]}-${m[2]}`
  return CERT_NUMBER.test(n) ? n : null
}

export const kindOfNumber = (n: string): CertKind | null => (n.startsWith(CERT_PREFIX.org) ? 'org' : n.startsWith(CERT_PREFIX.individual) ? 'individual' : null)

/* ---------- Time ---------- */

const DAY = 24 * 3600 * 1000

/** The expiry: the same day of the month `months` on, at the end of that day (UTC), so a certificate issued on the 15th
    stands through the 15th a year later. */
export const expiryFrom = (issuedAt: string | Date, months: number): string => {
  const d0 = new Date(issuedAt)
  const e = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + Math.max(1, Math.round(months)), d0.getUTCDate(), 23, 59, 59, 0))
  // The 31st plus a month lands on the 1st or 2nd of the month after next; pull it back to the last day of the intended month.
  if (e.getUTCDate() !== d0.getUTCDate()) e.setUTCDate(0)
  return e.toISOString()
}

export const daysToExpiry = (c: Pick<Certificate, 'expiresAt'>, now = new Date()): number | null => (c.expiresAt ? Math.ceil((new Date(c.expiresAt).getTime() - now.getTime()) / DAY) : null)

/** Whether a valid certificate's date has passed. */
export const isPastExpiry = (c: Pick<Certificate, 'expiresAt'>, now = new Date()): boolean => Boolean(c.expiresAt) && new Date(c.expiresAt!).getTime() < now.getTime()

/** The state today: the status, except that a valid certificate past its date reads expired (the sweep writes it, the page
    need not wait for the sweep) and one inside the first reminder window reads expiring. */
export const certificateState = (c: Pick<Certificate, 'status' | 'expiresAt'>, reminderDays: number[], now = new Date()): CertState => {
  if (c.status !== 'valid') return c.status
  if (isPastExpiry(c, now)) return 'expired'
  const days = daysToExpiry(c, now)
  const window = reminderDays[0] ?? 0
  return days !== null && window > 0 && days <= window ? 'expiring' : 'valid'
}

/** Valid today, in the strict sense the deal gate and the collateral rule use: valid or expiring, and not past the date. */
export const isCurrent = (c: Pick<Certificate, 'status' | 'expiresAt'>, now = new Date()): boolean => c.status === 'valid' && !isPastExpiry(c, now)

/** The reminder that is due now: the largest threshold whose window has started and that has not been sent, or null. One
    reminder per threshold; a certificate issued inside a window gets that window's reminder on the next sweep. */
export const reminderDue = (c: Pick<Certificate, 'status' | 'expiresAt' | 'reminded'>, reminderDays: number[], now = new Date()): number | null => {
  if (!isCurrent(c, now)) return null
  const days = daysToExpiry(c, now)
  if (days === null) return null
  for (const t of [...reminderDays].sort((a, b) => a - b)) if (days <= t && !c.reminded[String(t)]) return t
  return null
}

/* ---------- The score band (FR-TRN-07) ---------- */

export const scoreBand = (score: number, st: Pick<CertificateSettings, 'meritFrom' | 'distinctionFrom'>): ScoreBand => (score >= st.distinctionFrom ? 'Distinction' : score >= st.meritFrom ? 'Merit' : 'Pass')

/* ---------- When a pass earns a certificate (FR-TRN-07, 10) ---------- */

/** A pass earns a certificate unless the learner already holds a current one for the course that is outside the reminder
    window (a retake for its own sake does not print a second certificate). Inside the window, or after expiry, the pass is
    the recertification: a new certificate is issued and the old one, if still current, is superseded. */
export const shouldIssueIndividual = (existing: Pick<Certificate, 'status' | 'expiresAt' | 'kind' | 'courseId'>[], courseId: string, reminderDays: number[], now = new Date()): { issue: boolean; supersede: boolean } => {
  const current = existing.filter((c) => c.kind === 'individual' && c.courseId === courseId && isCurrent(c, now))
  if (!current.length) return { issue: true, supersede: false }
  const allOutsideWindow = current.every((c) => certificateState(c, reminderDays, now) === 'valid')
  return allOutsideWindow ? { issue: false, supersede: false } : { issue: true, supersede: true }
}

/* ---------- The organisation's rule (FR-CRT-01, 02, 06) ---------- */

export type RuleLine = { track: string; trackName: string; need: number; have: number }
export type RuleReading = { configured: boolean; met: boolean; lines: RuleLine[] }

export const rulesFor = (type: PartnerType | '', st: Pick<CertificateSettings, 'rules'>): CertRule[] => st.rules.filter((r) => r.type === type && r.people > 0)

/** Where an organisation stands against its type's rule: per track, the people needed and the distinct people who hold a
    current individual certificate on a course of that track. A type with no rule row never qualifies (`configured: false`). */
export const readRule = (type: PartnerType | '', st: Pick<CertificateSettings, 'rules'>, certs: Pick<Certificate, 'kind' | 'status' | 'expiresAt' | 'trackKey' | 'userId'>[], trackNames: Record<string, string> = {}, now = new Date()): RuleReading => {
  const rules = rulesFor(type, st)
  if (!rules.length) return { configured: false, met: false, lines: [] }
  const lines = rules.map((r) => {
    const people = new Set(certs.filter((c) => c.kind === 'individual' && c.trackKey === r.track && isCurrent(c, now)).map((c) => c.userId))
    return { track: r.track, trackName: trackNames[r.track] ?? r.track.charAt(0).toUpperCase() + r.track.slice(1), need: r.people, have: people.size }
  })
  return { configured: true, met: lines.every((l) => l.have >= l.need), lines }
}

export const ruleText = (r: RuleReading): string => (!r.configured ? 'No rule is set for this partner type.' : r.lines.map((l) => `${l.have} of ${l.need} on ${l.trackName}`).join(' · '))

/* ---------- The organisation's standing (FR-CRT-05) ---------- */

/** The organisation certificate that speaks for the organisation now: a request if one waits, else the newest issued one. */
export const currentOrgCertificate = (certs: Certificate[]): Certificate | null => {
  const org = certs.filter((c) => c.kind === 'org')
  return org.find((c) => c.status === 'requested') ?? [...org].filter((c) => c.status !== 'declined').sort((a, b) => (b.issuedAt ?? b.createdAt).localeCompare(a.issuedAt ?? a.createdAt))[0] ?? null
}

/** What the `partner-orgs.certificate` group should say: the mirror the deal gate (deals-model `registerBlocked`) and the
    collateral rule (`isCertified`) already read. A request does not count as a certificate. */
export const orgMirror = (certs: Certificate[], now = new Date()): { status: 'none' | 'valid' | 'expired' | 'revoked'; until: string | null } => {
  const issued = certs.filter((c) => c.kind === 'org' && c.issuedAt && c.status !== 'declined' && c.status !== 'requested').sort((a, b) => b.issuedAt!.localeCompare(a.issuedAt!))
  const cur = issued[0]
  if (!cur) return { status: 'none', until: null }
  if (cur.status === 'revoked') return { status: 'revoked', until: cur.expiresAt }
  if (cur.status === 'expired' || isPastExpiry(cur, now)) return { status: 'expired', until: cur.expiresAt }
  return { status: 'valid', until: cur.expiresAt }
}

/* ---------- The public verification (FR-TRN-09, FR-CRT-07) ---------- */

export type VerifyView = { number: string; kind: CertKind; state: CertState; genuine: true; holder: string; organisation: string; partnerId: string; about: string; issuedAt: string | null; expiresAt: string | null; revokedAt: string | null }

/** The minimum the public page shows: who, which organisation, what for, when; no email, no score, no reason. A request or a
    declined request is not a certificate and verifies as unknown. */
export const verifyView = (c: Certificate, reminderDays: number[], now = new Date()): VerifyView | null => {
  if (c.status === 'requested' || c.status === 'declined' || !c.issuedAt) return null
  return {
    number: c.number,
    kind: c.kind,
    state: certificateState(c, reminderDays, now),
    genuine: true,
    holder: c.kind === 'individual' ? c.userName : c.orgName,
    organisation: c.kind === 'individual' ? c.orgTradeName || c.orgName : c.orgName,
    partnerId: c.orgPartnerId,
    about: c.kind === 'individual' ? `${c.courseTitle}${c.trackName ? ` · ${c.trackName} track` : ''}` : 'K7 Partner Programme',
    issuedAt: c.issuedAt,
    expiresAt: c.expiresAt,
    revokedAt: c.status === 'revoked' ? c.revokedAt : null,
  }
}

export const certificateFileName = (c: Pick<Certificate, 'number' | 'kind'>): string => `${c.number}.pdf`

export const certificateTitle = (c: Pick<Certificate, 'kind' | 'courseTitle' | 'userName' | 'orgName'>): string => (c.kind === 'individual' ? `${c.userName} · ${c.courseTitle}` : `${c.orgName} · K7 Partner Certificate`)
