import type { PartnerRole } from './settings-model'
import { fileVideoRef, parseVideoRef, type VideoRef } from './video'

/* Training as the code reads it (01-requirements.md §4, 02-build-plan.md M10): two tracks of courses, each course of ordered
   modules with a video and reading material (FR-TRN-01); a module is complete when the union of the watched ranges covers the
   configured share of the video (FR-TRN-03), the test unlocks when every module is complete (FR-TRN-04), the paper is drawn and
   shuffled from the bank with a seed kept on the attempt, timed (FR-TRN-05), graded all-or-nothing per question and stored
   with the answers (FR-TRN-06). Everything here is pure (the ranges, the rules, the draw, the grading, the standing, the CSV
   of FR-TRN-13) and tested without a tenant; `training.ts` reads and writes. The content comes from the Payload admin, where
   the Training Admin edits it (decision 9); a course carries an integer version the admin bumps when the material changes,
   and every progress row and attempt records the version it was made on (FR-TRN-14). */

export const CONTENT_STATUSES = ['draft', 'published', 'retired'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]
export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = { draft: 'Draft', published: 'Published', retired: 'Retired' }

export type Track = { id: string; key: string; name: string; description: string; roles: PartnerRole[]; order: number; status: ContentStatus }

export type ShowAnswers = 'default' | 'yes' | 'no'

export type Course = {
  id: string
  trackId: string
  trackName: string
  title: string
  description: string
  order: number
  status: ContentStatus
  /** FR-TRN-14: bumped by the Training Admin when the material changes; progress and attempts record it. */
  version: number
  passMark: number | null
  timeLimitMinutes: number | null
  questionsPerTest: number | null
  showAnswers: ShowAnswers
  requiredShare: number | null
  publishedAt: string | null
  updatedAt: string
}

export type TrainingFile = { id: string; name: string; mime: string; size: number }

export type Module = {
  id: string
  courseId: string
  title: string
  order: number
  description: string
  reading: string
  video: VideoRef | null
  durationSeconds: number | null
  requiredShare: number | null
  attachments: TrainingFile[]
  status: 'draft' | 'published'
}

export const QUESTION_TYPES = ['single', 'multiple', 'trueFalse'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = { single: 'Single choice', multiple: 'Multiple choice', trueFalse: 'True or false' }

export type Option = { text: string; correct: boolean }
export type Question = { id: string; courseId: string; type: QuestionType; text: string; options: Option[]; explanation: string; active: boolean; topic: string }

export type Range = [number, number]

export type Progress = {
  id: string
  userId: string
  orgId: string
  moduleId: string
  courseId: string
  courseVersion: number
  ranges: Range[]
  duration: number
  watched: number
  share: number
  lastPosition: number
  completedAt: string | null
  updatedAt: string
}

/** One question as drawn for an attempt: the options in their shuffled order under letter keys, the correct keys kept, so the
    result reads the bank as it was at the draw even when the Training Admin edits it afterwards. */
export type PaperOption = { key: string; text: string }
export type PaperQuestion = { qid: string; type: QuestionType; text: string; options: PaperOption[]; correct: string[]; explanation: string }

export const ATTEMPT_STATUSES = ['open', 'submitted', 'expired'] as const
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number]

export type Attempt = {
  id: string
  userId: string
  userName: string
  orgId: string
  courseId: string
  courseVersion: number
  status: AttemptStatus
  startedAt: string
  expiresAt: string | null
  submittedAt: string | null
  seed: string
  paper: PaperQuestion[]
  answers: Record<string, string[]>
  score: number | null
  correct: number
  total: number
  passed: boolean
  passMark: number
  showAnswers: boolean
  createdAt: string
}

/* ---------- Settings and the effective rules ---------- */

export type TrainingSettings = { watchShare: number; passMark: number; timeLimitMinutes: number; questionsPerTest: number; showAnswers: boolean }
export const DEFAULT_TRAINING_SETTINGS: TrainingSettings = { watchShare: 0.9, passMark: 70, timeLimitMinutes: 20, questionsPerTest: 10, showAnswers: true }

type Raw = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const nOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const d = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const relId = (v: unknown): string => s(typeof v === 'object' && v !== null ? (v as Raw).id : v)
const relDoc = (v: unknown): Raw | null => (typeof v === 'object' && v !== null ? (v as Raw) : null)

export const normaliseTrainingSettings = (r: Raw | null | undefined): TrainingSettings => {
  const D = DEFAULT_TRAINING_SETTINGS
  const x = r ?? {}
  const share = typeof x.watchShare === 'number' ? x.watchShare : Number(x.watchShare)
  const pass = typeof x.passMark === 'number' ? x.passMark : Number(x.passMark)
  return {
    watchShare: Number.isFinite(share) && share > 0 && share <= 1 ? share : D.watchShare,
    passMark: Number.isFinite(pass) && pass >= 1 && pass <= 100 ? Math.round(pass) : D.passMark,
    timeLimitMinutes: Number.isFinite(Number(x.timeLimitMinutes)) && Number(x.timeLimitMinutes) >= 1 ? Math.round(Number(x.timeLimitMinutes)) : D.timeLimitMinutes,
    questionsPerTest: Number.isFinite(Number(x.questionsPerTest)) && Number(x.questionsPerTest) >= 1 ? Math.round(Number(x.questionsPerTest)) : D.questionsPerTest,
    showAnswers: typeof x.showAnswers === 'boolean' ? x.showAnswers : D.showAnswers,
  }
}

/** FR-TRN-05, 06: the course's own values where set, else the programme's. */
export type CourseRules = { passMark: number; timeLimitMinutes: number; questionsPerTest: number; showAnswers: boolean; requiredShare: number }
export const courseRules = (c: Pick<Course, 'passMark' | 'timeLimitMinutes' | 'questionsPerTest' | 'showAnswers' | 'requiredShare'>, t: TrainingSettings): CourseRules => ({
  passMark: c.passMark !== null && c.passMark >= 1 && c.passMark <= 100 ? c.passMark : t.passMark,
  timeLimitMinutes: c.timeLimitMinutes !== null && c.timeLimitMinutes >= 1 ? c.timeLimitMinutes : t.timeLimitMinutes,
  questionsPerTest: c.questionsPerTest !== null && c.questionsPerTest >= 1 ? c.questionsPerTest : t.questionsPerTest,
  showAnswers: c.showAnswers === 'default' ? t.showAnswers : c.showAnswers === 'yes',
  requiredShare: c.requiredShare !== null && c.requiredShare > 0 && c.requiredShare <= 1 ? c.requiredShare : t.watchShare,
})

/** FR-TRN-03: the module's own share where set, else the course's rule. */
export const requiredShareFor = (m: Pick<Module, 'requiredShare'>, rules: Pick<CourseRules, 'requiredShare'>): number => (m.requiredShare !== null && m.requiredShare > 0 && m.requiredShare <= 1 ? m.requiredShare : rules.requiredShare)

/* ---------- Readers ---------- */

const ROLES = ['admin', 'sales', 'technical'] as const
const roles = (v: unknown): PartnerRole[] => (Array.isArray(v) ? (v.filter((r) => (ROLES as readonly string[]).includes(String(r))) as PartnerRole[]) : [])
const status = (v: unknown): ContentStatus => (v === 'published' ? 'published' : v === 'retired' ? 'retired' : 'draft')

export const toTrack = (x: Raw): Track => ({ id: s(x.id), key: s(x.key), name: s(x.name), description: s(x.description), roles: roles(x.roles), order: n(x.order), status: status(x.status) })

export const toCourse = (x: Raw): Course => {
  const track = relDoc(x.track)
  return {
    id: s(x.id),
    trackId: relId(x.track),
    trackName: s(track?.name),
    title: s(x.title),
    description: s(x.description),
    order: n(x.order),
    status: status(x.status),
    version: Math.max(1, Math.round(n(x.version) || 1)),
    passMark: nOrNull(x.passMark),
    timeLimitMinutes: nOrNull(x.timeLimitMinutes),
    questionsPerTest: nOrNull(x.questionsPerTest),
    showAnswers: x.showAnswers === 'yes' || x.showAnswers === 'no' ? x.showAnswers : 'default',
    requiredShare: nOrNull(x.requiredShare),
    publishedAt: d(x.publishedAt),
    updatedAt: s(x.updatedAt),
  }
}

export const toTrainingFile = (x: Raw): TrainingFile => ({ id: s(x.id), name: s(x.filename), mime: s(x.mimeType), size: n(x.filesize) })

export const toModule = (x: Raw): Module => {
  const videoFile = relDoc(x.videoFile)
  const typed = parseVideoRef(s(x.video))
  const attachments = Array.isArray(x.attachments) ? x.attachments.map((a) => relDoc(a)).filter((a): a is Raw => a !== null && Boolean(a.filename)).map(toTrainingFile) : []
  return {
    id: s(x.id),
    courseId: relId(x.course),
    title: s(x.title),
    order: n(x.order),
    description: s(x.description),
    reading: s(x.reading),
    video: videoFile && videoFile.filename ? fileVideoRef(toTrainingFile(videoFile)) : typed,
    durationSeconds: nOrNull(x.durationSeconds),
    requiredShare: nOrNull(x.requiredShare),
    attachments,
    status: x.status === 'published' ? 'published' : 'draft',
  }
}

export const toQuestion = (x: Raw): Question => ({
  id: s(x.id),
  courseId: relId(x.course),
  type: (QUESTION_TYPES as readonly string[]).includes(s(x.type)) ? (s(x.type) as QuestionType) : 'single',
  text: s(x.text),
  options: Array.isArray(x.options) ? x.options.map((o) => ({ text: s((o as Raw).text), correct: Boolean((o as Raw).correct) })) : [],
  explanation: s(x.explanation),
  active: x.active !== false,
  topic: s(x.topic),
})

const toRanges = (v: unknown): Range[] => (Array.isArray(v) ? v.filter((r) => Array.isArray(r) && r.length === 2 && Number.isFinite(Number(r[0])) && Number.isFinite(Number(r[1]))).map((r) => [Number((r as unknown[])[0]), Number((r as unknown[])[1])] as Range) : [])

export const toProgress = (x: Raw): Progress => ({
  id: s(x.id),
  userId: relId(x.user),
  orgId: relId(x.org),
  moduleId: relId(x.module),
  courseId: relId(x.course),
  courseVersion: Math.max(1, Math.round(n(x.courseVersion) || 1)),
  ranges: toRanges(x.ranges),
  duration: n(x.duration),
  watched: n(x.watched),
  share: n(x.share),
  lastPosition: n(x.lastPosition),
  completedAt: d(x.completedAt),
  updatedAt: s(x.updatedAt),
})

const toPaper = (v: unknown): PaperQuestion[] =>
  Array.isArray(v)
    ? v.map((q) => {
        const r = q as Raw
        return {
          qid: s(r.qid),
          type: (QUESTION_TYPES as readonly string[]).includes(s(r.type)) ? (s(r.type) as QuestionType) : 'single',
          text: s(r.text),
          options: Array.isArray(r.options) ? r.options.map((o) => ({ key: s((o as Raw).key), text: s((o as Raw).text) })) : [],
          correct: Array.isArray(r.correct) ? r.correct.map(s) : [],
          explanation: s(r.explanation),
        }
      })
    : []

const toAnswers = (v: unknown): Record<string, string[]> => {
  const out: Record<string, string[]> = {}
  if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k, val] of Object.entries(v as Raw)) out[k] = Array.isArray(val) ? val.map(s) : []
  return out
}

export const toAttempt = (x: Raw): Attempt => ({
  id: s(x.id),
  userId: relId(x.user),
  userName: s(x.userName),
  orgId: relId(x.org),
  courseId: relId(x.course),
  courseVersion: Math.max(1, Math.round(n(x.courseVersion) || 1)),
  status: x.status === 'submitted' ? 'submitted' : x.status === 'expired' ? 'expired' : 'open',
  startedAt: s(x.startedAt),
  expiresAt: d(x.expiresAt),
  submittedAt: d(x.submittedAt),
  seed: s(x.seed),
  paper: toPaper(x.paper),
  answers: toAnswers(x.answers),
  score: nOrNull(x.score),
  correct: n(x.correct),
  total: n(x.total),
  passed: Boolean(x.passed),
  passMark: n(x.passMark) || DEFAULT_TRAINING_SETTINGS.passMark,
  showAnswers: Boolean(x.showAnswers),
  createdAt: s(x.createdAt),
})

/* ---------- Who may learn what ---------- */

/** FR-TRN-01 with the roles of §2: a track names the partner roles it is for (Sales → sales, Technical → technical); a user
    learns a track when they hold one of them, or any track that names none. A Partner Admin who holds no learning role reads
    the organisation's progress but takes no course. */
export const trackOpenTo = (t: Pick<Track, 'roles' | 'status'>, userRoles: PartnerRole[]): boolean => t.status === 'published' && (t.roles.length === 0 || t.roles.some((r) => userRoles.includes(r)))

export const sortContent = <T extends { order: number; id: string }>(rows: T[]): T[] => [...rows].sort((a, b) => a.order - b.order || Number(a.id) - Number(b.id))

/* ---------- Watched ranges (FR-TRN-03) ---------- */

export const MAX_RANGES = 400
/** Two ranges closer than this join; a browser's timeupdate ticks every quarter second. */
const JOIN = 0.75

/** Reads what the player posted: pairs of finite seconds, start before end, clamped to the duration when known; anything
    malformed is dropped rather than refused, so one bad tick never loses the rest. */
export const parseRanges = (v: unknown, duration?: number | null): Range[] => {
  if (!Array.isArray(v)) return []
  const out: Range[] = []
  for (const r of v.slice(0, MAX_RANGES * 2)) {
    if (!Array.isArray(r) || r.length !== 2) continue
    let a = Number(r[0])
    let b = Number(r[1])
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    a = Math.max(0, a)
    if (duration && duration > 0) b = Math.min(b, duration)
    if (b - a < 0.25) continue
    out.push([a, b])
  }
  return out
}

/** The union of ranges, sorted, touching or overlapping ones joined. */
export const mergeRanges = (ranges: Range[]): Range[] => {
  const sorted = ranges.filter((r) => r[1] > r[0]).sort((x, y) => x[0] - y[0])
  const out: Range[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r[0] <= last[1] + JOIN) last[1] = Math.max(last[1], r[1])
    else out.push([r[0], r[1]])
  }
  return out.slice(0, MAX_RANGES)
}

export const watchedSeconds = (ranges: Range[]): number => ranges.reduce((t, r) => t + (r[1] - r[0]), 0)

/** The share watched: the union's length over the duration, never above 1. Zero without a duration. */
export const watchShare = (ranges: Range[], duration: number | null | undefined): number => (!duration || duration <= 0 ? 0 : Math.min(1, watchedSeconds(mergeRanges(ranges)) / duration))

/** FR-TRN-03: a module counts once the share reaches what is required; skipping ahead leaves gaps that do not count. The last
    few seconds of a video are often cut by the player, so a share within a second of the end counts as the whole. */
export const moduleComplete = (share: number, required: number, duration?: number | null): boolean => share >= required || (Boolean(duration) && share >= 1 - 1 / Math.max(1, duration ?? 1))

export type ProgressUpdate = { ranges: Range[]; duration: number; watched: number; share: number; lastPosition: number; complete: boolean }

/** The next state of a progress row after the player's post: the ranges merged into what was there, the duration kept
    once known (the longest seen), the position for resume, and whether it is now complete. */
export const applyWatched = (prev: Pick<Progress, 'ranges' | 'duration' | 'lastPosition'> | null, posted: { ranges: unknown; duration?: unknown; position?: unknown }, required: number): ProgressUpdate => {
  const dur = Math.max(prev?.duration ?? 0, Number(posted.duration) > 0 && Number.isFinite(Number(posted.duration)) ? Number(posted.duration) : 0)
  const incoming = parseRanges(posted.ranges, dur || null)
  const ranges = mergeRanges([...(prev?.ranges ?? []), ...incoming])
  const watched = Math.round(watchedSeconds(ranges) * 10) / 10
  const share = dur > 0 ? Math.min(1, watched / dur) : 0
  const pos = Number(posted.position)
  const lastPosition = Number.isFinite(pos) && pos >= 0 ? Math.min(pos, dur || pos) : (prev?.lastPosition ?? 0)
  return { ranges, duration: dur, watched, share: Math.round(share * 1000) / 1000, lastPosition: Math.round(lastPosition * 10) / 10, complete: moduleComplete(share, required, dur) }
}

/* ---------- The test (FR-TRN-04 … 06) ---------- */

/** Whether a question can be asked: at least two options with text, at least one correct, a single or true/false one with
    exactly one correct, a true/false one with exactly two options. */
export const questionValid = (q: Pick<Question, 'type' | 'text' | 'options'>): string | null => {
  if (!q.text.trim()) return 'No question text'
  const opts = q.options.filter((o) => o.text.trim())
  if (opts.length < 2) return 'Fewer than two options'
  const correct = opts.filter((o) => o.correct).length
  if (correct === 0) return 'No correct option'
  if (q.type !== 'multiple' && correct !== 1) return 'A single-choice or true/false question needs exactly one correct option'
  if (q.type === 'trueFalse' && opts.length !== 2) return 'A true/false question has exactly two options'
  if (q.type === 'multiple' && correct === opts.length) return 'A multiple-choice question needs at least one wrong option'
  return null
}

export const askable = (bank: Question[]): Question[] => bank.filter((q) => q.active && questionValid(q) === null)

/** FR-TRN-04: the test unlocks when every published module of the course is complete; a course without a module stays locked. */
export type Unlock = { ok: true } | { ok: false; reason: string; remaining: number }
export const testUnlocked = (modules: Pick<Module, 'id' | 'status'>[], completed: Set<string>, bankSize: number): Unlock => {
  const live = modules.filter((m) => m.status === 'published')
  if (!live.length) return { ok: false, reason: 'This course has no module yet.', remaining: 0 }
  const remaining = live.filter((m) => !completed.has(m.id)).length
  if (remaining) return { ok: false, reason: `${remaining} module${remaining === 1 ? '' : 's'} still to complete.`, remaining }
  if (bankSize === 0) return { ok: false, reason: 'The test for this course is not ready yet; K7 has been told.', remaining: 0 }
  return { ok: true }
}

/* A small seeded generator (mulberry32 over an FNV-1a hash of the seed) so a paper can be re-drawn from its seed. */
const hash = (str: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
export const rng = (seed: string): (() => number) => {
  let a = hash(seed) || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const shuffle = <T>(arr: T[], next: () => number): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}
const KEYS = 'abcdefghij'

/** FR-TRN-04: `count` questions drawn from the askable bank in a seeded shuffle, their options shuffled too (a true/false
    question keeps True before False), under letter keys with the correct keys recorded. Fewer than `count` in the bank: all of
    them. The same seed on the same bank draws the same paper. */
export const drawPaper = (bank: Question[], count: number, seed: string): PaperQuestion[] => {
  const next = rng(seed)
  const pool = shuffle(askable(bank), next).slice(0, Math.max(1, count))
  return pool.map((q) => {
    const opts = q.options.filter((o) => o.text.trim())
    const ordered = q.type === 'trueFalse' ? opts : shuffle(opts, next)
    const options = ordered.map((o, i) => ({ key: KEYS[i] ?? String(i), text: o.text.trim() }))
    const correct = ordered.map((o, i) => (o.correct ? (KEYS[i] ?? String(i)) : '')).filter(Boolean)
    return { qid: q.id, type: q.type, text: q.text.trim(), options, correct, explanation: q.explanation.trim() }
  })
}

/** The answers as posted (`q_<qid>` fields, one or many), kept only where the key is one of the question's options. */
export const answersFrom = (paper: PaperQuestion[], get: (name: string) => string[]): Record<string, string[]> => {
  const out: Record<string, string[]> = {}
  for (const q of paper) {
    const keys = new Set(q.options.map((o) => o.key))
    const chosen = [...new Set(get(`q_${q.qid}`).filter((k) => keys.has(k)))].sort()
    out[q.qid] = q.type === 'multiple' ? chosen : chosen.slice(0, 1)
  }
  return out
}

export const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i])

export type Grade = { correct: number; total: number; score: number; passed: boolean; perQuestion: Record<string, boolean> }

/** FR-TRN-06: one mark per question, all-or-nothing (a multiple-choice question is right only when exactly the correct set is
    chosen), the score as a whole percentage, passed at or above the pass mark. */
export const gradePaper = (paper: PaperQuestion[], answers: Record<string, string[]>, passMark: number): Grade => {
  const perQuestion: Record<string, boolean> = {}
  let correct = 0
  for (const q of paper) {
    const ok = sameSet(answers[q.qid] ?? [], q.correct)
    perQuestion[q.qid] = ok
    if (ok) correct++
  }
  const total = paper.length
  const score = total ? Math.round((correct / total) * 100) : 0
  return { correct, total, score, passed: total > 0 && score >= passMark, perQuestion }
}

export const expiresAt = (startedAt: Date, timeLimitMinutes: number): string => new Date(startedAt.getTime() + timeLimitMinutes * 60_000).toISOString()

/** A submission a little after the limit still counts (the clock on the page and the server differ by the request); later
    than the grace the attempt is recorded as expired, graded on what was answered. */
export const GRACE_SECONDS = 45
export const isLate = (a: Pick<Attempt, 'expiresAt'>, now: Date): boolean => Boolean(a.expiresAt) && now.getTime() > new Date(a.expiresAt!).getTime() + GRACE_SECONDS * 1000
export const secondsLeft = (a: Pick<Attempt, 'expiresAt'>, now: Date): number | null => (a.expiresAt ? Math.max(0, Math.round((new Date(a.expiresAt).getTime() - now.getTime()) / 1000)) : null)

/* ---------- Standing ---------- */

/** `recertify` (M11, FR-TRN-10): passed, but the certificate is expiring, expired or revoked and the test is open again. */
export type TestState = 'locked' | 'ready' | 'passed' | 'failed' | 'recertify'
export const TEST_STATE_LABEL: Record<TestState, string> = { locked: 'Locked', ready: 'Ready to take', passed: 'Passed', failed: 'Not passed yet', recertify: 'Recertify' }

/** What the standing needs to know of the learner's current certificate for the course (certificates-model.ts). */
export type CertStanding = { state: 'requested' | 'valid' | 'expiring' | 'expired' | 'revoked' | 'declined' | 'superseded'; number: string; expiresAt: string | null; id: string }

export type CourseStanding = {
  modulesTotal: number
  modulesDone: number
  /** The average share watched across the published modules, for the bar. */
  watchedShare: number
  unlock: Unlock
  test: TestState
  attempts: number
  best: Attempt | null
  /** The newest passing attempt, which is what a certificate (M11) and the version note read. */
  pass: Attempt | null
  /** True when the pass was on an earlier version of the course (FR-TRN-14). */
  passOutdated: boolean
  lastActivity: string | null
  /** The learner's current certificate for the course, when one exists (M11). */
  certificate: CertStanding | null
}

const finished = (a: Attempt): boolean => a.status !== 'open'

export const bestAttempt = (attempts: Attempt[]): Attempt | null => {
  const done = attempts.filter(finished)
  if (!done.length) return null
  return [...done].sort((a, b) => Number(b.passed) - Number(a.passed) || (b.score ?? 0) - (a.score ?? 0) || b.startedAt.localeCompare(a.startedAt))[0] ?? null
}

export const latestPass = (attempts: Attempt[]): Attempt | null => [...attempts].filter((a) => finished(a) && a.passed).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null

export const courseStanding = (course: Pick<Course, 'version'>, modules: Module[], progress: Progress[], attempts: Attempt[], rules: CourseRules, bankSize: number, certificate: CertStanding | null = null): CourseStanding => {
  const live = sortContent(modules.filter((m) => m.status === 'published'))
  const byModule = new Map(progress.map((p) => [p.moduleId, p]))
  const completed = new Set<string>()
  let shareSum = 0
  for (const m of live) {
    const p = byModule.get(m.id)
    const share = p?.share ?? 0
    shareSum += Math.min(1, share)
    if (p?.completedAt || moduleComplete(share, requiredShareFor(m, rules), p?.duration)) completed.add(m.id)
  }
  const unlock = testUnlocked(live, completed, bankSize)
  const best = bestAttempt(attempts)
  const pass = latestPass(attempts)
  const lapsed = certificate !== null && (certificate.state === 'expiring' || certificate.state === 'expired' || certificate.state === 'revoked')
  const test: TestState = pass ? (lapsed && unlock.ok ? 'recertify' : 'passed') : !unlock.ok ? 'locked' : best ? 'failed' : 'ready'
  const stamps = [...progress.map((p) => p.updatedAt), ...attempts.map((a) => a.submittedAt ?? a.startedAt)].filter(Boolean).sort()
  return {
    modulesTotal: live.length,
    modulesDone: completed.size,
    watchedShare: live.length ? shareSum / live.length : 0,
    unlock,
    test,
    attempts: attempts.filter(finished).length,
    best,
    pass,
    passOutdated: Boolean(pass && pass.courseVersion < course.version),
    lastActivity: stamps[stamps.length - 1] ?? null,
    certificate,
  }
}

/** One course as the learner's list reads it, and the tracks that hold them. */
export type CourseRow = { course: Course; rules: CourseRules; standing: CourseStanding; modules: Module[]; progress: Progress[] }
export type TrackGroup = { track: Track; courses: CourseRow[] }

export const standingLabel = (st: CourseStanding): string => (st.test === 'recertify' ? `Certificate ${st.certificate?.state === 'expiring' ? 'expiring' : st.certificate?.state ?? 'lapsed'} · recertify` : st.test === 'passed' ? `Passed · ${st.pass?.score ?? 0}%` : st.test === 'failed' ? `Not passed · best ${st.best?.score ?? 0}%` : st.modulesDone === 0 && st.watchedShare === 0 ? 'Not started' : st.test === 'ready' ? 'Modules done · test ready' : `${st.modulesDone} of ${st.modulesTotal} modules`)

/* ---------- The bank as a CSV (FR-TRN-13) ---------- */

export const CSV_COLUMNS = ['type', 'question', 'option1', 'option2', 'option3', 'option4', 'option5', 'option6', 'correct', 'explanation', 'topic'] as const

export const CSV_TEMPLATE = [
  CSV_COLUMNS.join(','),
  'single,"Which K7 product protects endpoints?","Endpoint Security","Mail Gateway","Web Filter","",,,1,"Endpoint Security is the endpoint product.",Products',
  'multiple,"Which two are deal registration rules? (choose all that apply)","Register before quoting","One extension per deal","Any partner may register any deal","",,,"1,2","Protection follows the registration; one extension is allowed.",Deals',
  'trueFalse,"A deal must be registered before the quote is sent.",True,False,,,,,1,"Registration comes first.",Deals',
].join('\n')

/** RFC 4180 fields: quoted fields may hold commas, newlines and doubled quotes; CRLF or LF rows; a BOM is dropped. */
export const parseCsv = (text: string): string[][] => {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export type QuestionInput = { type: QuestionType; text: string; options: Option[]; explanation: string; topic: string }
export type CsvImport = { questions: QuestionInput[]; errors: { line: number; message: string }[] }

const TYPE_ALIAS: Record<string, QuestionType> = { single: 'single', 'single-choice': 'single', singlechoice: 'single', sc: 'single', multiple: 'multiple', 'multiple-choice': 'multiple', multiplechoice: 'multiple', multi: 'multiple', mc: 'multiple', truefalse: 'trueFalse', 'true/false': 'trueFalse', 'true-false': 'trueFalse', tf: 'trueFalse', boolean: 'trueFalse' }

/** The bank from the template's columns: a header row, then one question per row with up to six options and the correct
    ones as numbers (`1`, `1,3`) or letters (`a`, `a,c`); a true/false row may leave the options blank (True · False) and say
    `true` or `false`. Each bad row is an error with its line; the good rows are kept. */
export const questionsFromCsv = (text: string): CsvImport => {
  const rows = parseCsv(text)
  const out: CsvImport = { questions: [], errors: [] }
  if (!rows.length) return { questions: [], errors: [{ line: 0, message: 'The file is empty.' }] }
  const header = rows[0]!.map((h) => h.trim().toLowerCase())
  const col = (name: string): number => header.indexOf(name)
  const need = ['type', 'question', 'correct']
  const missing = need.filter((h) => col(h) < 0)
  if (missing.length) return { questions: [], errors: [{ line: 1, message: `The header is missing ${missing.join(', ')}; the template's columns are ${CSV_COLUMNS.join(', ')}.` }] }
  const optionCols = header.map((h, i) => (/^option\d+$/.test(h) ? i : -1)).filter((i) => i >= 0)
  for (let r = 1; r < rows.length; r++) {
    const line = r + 1
    const row = rows[r]!
    const cell = (i: number): string => (i >= 0 ? (row[i] ?? '').trim() : '')
    const rawType = cell(col('type')).toLowerCase().replace(/\s+/g, '')
    const type = TYPE_ALIAS[rawType]
    if (!type) {
      out.errors.push({ line, message: `Unknown type "${cell(col('type'))}" (single, multiple or trueFalse).` })
      continue
    }
    const textCell = cell(col('question'))
    let texts = optionCols.map((i) => cell(i)).filter(Boolean)
    if (type === 'trueFalse' && texts.length === 0) texts = ['True', 'False']
    const correctCell = cell(col('correct')).toLowerCase()
    let correctIdx: number[] = []
    if (type === 'trueFalse' && (correctCell === 'true' || correctCell === 'false')) correctIdx = [correctCell === 'true' ? 0 : 1]
    else
      correctIdx = correctCell
        .split(/[,;\s/]+/)
        .filter(Boolean)
        .map((t) => (/^\d+$/.test(t) ? Number(t) - 1 : /^[a-j]$/.test(t) ? KEYS.indexOf(t) : -1))
    if (correctIdx.some((i) => i < 0 || i >= texts.length)) {
      out.errors.push({ line, message: `"correct" must name options by number (1, 1,3) or letter (a, a,c) within the ${texts.length} given.` })
      continue
    }
    const options = texts.map((t, i) => ({ text: t, correct: correctIdx.includes(i) }))
    const q: QuestionInput = { type, text: textCell, options, explanation: cell(col('explanation')), topic: cell(col('topic')) }
    const bad = questionValid(q)
    if (bad) {
      out.errors.push({ line, message: bad })
      continue
    }
    out.questions.push(q)
  }
  return out
}

/* ---------- Words ---------- */

export const pct = (share: number): string => `${Math.round(share * 100)}%`
export const mmss = (seconds: number): string => {
  const s0 = Math.max(0, Math.round(seconds))
  const m = Math.floor(s0 / 60)
  const sec = s0 % 60
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m}:${String(sec).padStart(2, '0')}`
}
export const minutesText = (seconds: number | null): string => (seconds === null || seconds <= 0 ? '—' : seconds < 60 ? `${Math.round(seconds)} s` : `${Math.max(1, Math.round(seconds / 60))} min`)
