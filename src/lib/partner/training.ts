import 'server-only'
import configPromise from '@payload-config'
import { randomBytes } from 'crypto'
import { getPayload, type Where } from 'payload'

import { TRAINING_DIR } from '@/collections/partner/PartnerTraining'

import { audit, type Actor } from './audit'
import { serveStoredFile } from './files'
import { notify } from './notify'
import { trainingVars } from './notify-model'
import { orgRel, orgWhere, type OrgScope } from './scope'
import type { K7Context, PartnerContext } from './session'
import { getPartnerSettings } from './settings'
import {
  answersFrom,
  applyWatched,
  askable,
  courseRules,
  courseStanding,
  drawPaper,
  expiresAt,
  gradePaper,
  isLate,
  questionsFromCsv,
  questionValid,
  requiredShareFor,
  sortContent,
  toAttempt,
  toCourse,
  toModule,
  toProgress,
  toQuestion,
  toTrack,
  toTrainingFile,
  trackOpenTo,
  type Attempt,
  type ContentStatus,
  type Course,
  type CourseRow,
  type CourseRules,
  type CourseStanding,
  type CsvImport,
  type Module,
  type Progress,
  type Question,
  type Track,
  type TrackGroup,
  type TrainingFile,
} from './training-model'
import { orgUsers, type PartnerUser } from './users'
import { videoSource, type VideoSource } from './video'

/* Training (01-requirements.md §4, M10). The Training Admin writes the content in the Payload admin; this file reads it for
   the two audiences and writes the rows the portal owns: the watched ranges per user and module (FR-TRN-02, 03) and the test
   attempts with their papers and answers (FR-TRN-04 … 06). The partner side reads through `me`: a track is theirs when it is
   published and names one of their roles, a course when it is published under such a track, a module when it is published
   under such a course; progress and attempts are read through the scope and the user. The Partner Admin reads the
   organisation's progress through the scope (FR-TRN-11). The K7 side reads everything for the ledger and imports banks
   (FR-TRN-13). Nothing here touches Dynamics. */

export const PARTNER_TRAINING = '/partners/portal/training'
export const K7_TRAINING = '/partners/portal/k7/training'

const db = () => getPayload({ config: configPromise })
type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const rel = (id: string): number | string => (/^\d+$/.test(id) ? Number(id) : id)
const now = () => new Date().toISOString()
const who = (a: Actor): string => a.name || a.email || a.kind
const BIG = 5000

/* ---------- Reading the content ---------- */

export const listTracks = async (status: ContentStatus | 'all' = 'all'): Promise<Track[]> => {
  const payload = await db()
  const where: Where = status === 'all' ? {} : { status: { equals: status } }
  const r = await payload.find({ collection: 'partner-tracks', where, limit: 200, depth: 0, sort: 'order', overrideAccess: true })
  return sortContent((r.docs as unknown as Doc[]).map(toTrack))
}

export const listCourses = async (o: { trackIds?: string[]; status?: ContentStatus | 'all' } = {}): Promise<Course[]> => {
  const payload = await db()
  const and: Where[] = []
  if (o.status && o.status !== 'all') and.push({ status: { equals: o.status } })
  if (o.trackIds) {
    if (!o.trackIds.length) return []
    and.push({ track: { in: o.trackIds.map(rel) } })
  }
  const r = await payload.find({ collection: 'partner-courses', where: and.length ? { and } : {}, limit: 1000, depth: 1, sort: 'order', overrideAccess: true })
  return sortContent((r.docs as unknown as Doc[]).map(toCourse))
}

export const listModules = async (courseIds: string[], publishedOnly = true): Promise<Module[]> => {
  if (!courseIds.length) return []
  const payload = await db()
  const and: Where[] = [{ course: { in: courseIds.map(rel) } }]
  if (publishedOnly) and.push({ status: { equals: 'published' } })
  const r = await payload.find({ collection: 'partner-modules', where: { and }, limit: BIG, depth: 1, sort: 'order', overrideAccess: true })
  return sortContent((r.docs as unknown as Doc[]).map(toModule))
}

export const listQuestions = async (courseIds: string[]): Promise<Question[]> => {
  if (!courseIds.length) return []
  const payload = await db()
  const r = await payload.find({ collection: 'partner-questions', where: { course: { in: courseIds.map(rel) } }, limit: BIG, depth: 0, sort: 'createdAt', overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toQuestion)
}

/** The askable bank size per course. */
const bankSizes = async (courseIds: string[]): Promise<Map<string, number>> => {
  const out = new Map<string, number>()
  for (const q of askable(await listQuestions(courseIds))) out.set(q.courseId, (out.get(q.courseId) ?? 0) + 1)
  return out
}

export const loadCourse = async (id: string): Promise<Course | null> => {
  if (!/^\d+$/.test(id)) return null
  try {
    const payload = await db()
    return toCourse((await payload.findByID({ collection: 'partner-courses', id: Number(id), depth: 1, overrideAccess: true })) as unknown as Doc)
  } catch {
    return null
  }
}

export const loadTrack = async (id: string): Promise<Track | null> => {
  if (!/^\d+$/.test(id)) return null
  try {
    const payload = await db()
    return toTrack((await payload.findByID({ collection: 'partner-tracks', id: Number(id), depth: 0, overrideAccess: true })) as unknown as Doc)
  } catch {
    return null
  }
}

export const rulesFor = async (c: Course): Promise<CourseRules> => courseRules(c, (await getPartnerSettings()).training)

/* ---------- The learner's records ---------- */

const progressOf = async (scope: OrgScope, extra: Where): Promise<Progress[]> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-progress', where: orgWhere(scope, extra), limit: BIG, depth: 0, overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toProgress)
}

const attemptsOf = async (scope: OrgScope, extra: Where): Promise<Attempt[]> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-attempts', where: orgWhere(scope, extra), limit: BIG, depth: 0, sort: '-startedAt', overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toAttempt)
}


const myTracks = async (me: PartnerContext): Promise<Track[]> => (await listTracks('published')).filter((t) => trackOpenTo(t, me.roles))

/** FR-TRN-01, 11: the tracks open to the user with their published courses and where the user stands on each. */
export const trainingFor = async (me: PartnerContext, forUser: PartnerUser = me.user): Promise<TrackGroup[]> => {
  const tracks = (await listTracks('published')).filter((t) => trackOpenTo(t, forUser.roles))
  if (!tracks.length) return []
  const courses = await listCourses({ trackIds: tracks.map((t) => t.id), status: 'published' })
  const ids = courses.map((c) => c.id)
  const [modules, progress, attempts, banks, settings] = await Promise.all([listModules(ids), ids.length ? progressOf(me.scope, { and: [{ user: { equals: forUser.id } }, { course: { in: ids.map(rel) } }] }) : [], ids.length ? attemptsOf(me.scope, { and: [{ user: { equals: forUser.id } }, { course: { in: ids.map(rel) } }] }) : [], bankSizes(ids), getPartnerSettings()])
  return tracks
    .map((track) => ({
      track,
      courses: courses
        .filter((c) => c.trackId === track.id)
        .map((course) => {
          const rules = courseRules(course, settings.training)
          const mods = modules.filter((m) => m.courseId === course.id)
          const mine = progress.filter((p) => p.courseId === course.id)
          return { course, rules, modules: mods, progress: mine, standing: courseStanding(course, mods, mine, attempts.filter((a) => a.courseId === course.id), rules, banks.get(course.id) ?? 0) }
        }),
    }))
    .filter((g) => g.courses.length)
}

export type TrainingCount = { courses: number; passed: number; inProgress: number; ready: number }

/** For the partner's home. */
export const trainingCountFor = async (me: PartnerContext): Promise<TrainingCount> => {
  const rows = (await trainingFor(me)).flatMap((g) => g.courses)
  return {
    courses: rows.length,
    passed: rows.filter((r) => r.standing.test === 'passed').length,
    inProgress: rows.filter((r) => r.standing.test !== 'passed' && (r.standing.modulesDone > 0 || r.standing.watchedShare > 0)).length,
    ready: rows.filter((r) => r.standing.test === 'ready' || r.standing.test === 'failed').length,
  }
}

export type CourseView = { track: Track; course: Course; rules: CourseRules; modules: Module[]; progress: Map<string, Progress>; attempts: Attempt[]; standing: CourseStanding; bank: number }

/** One course for the learner: null unless published under a track open to them. Expired open attempts are closed on the way. */
export const loadCourseFor = async (me: PartnerContext, courseId: string): Promise<CourseView | null> => {
  const course = await loadCourse(courseId)
  if (!course || course.status !== 'published') return null
  const track = (await myTracks(me)).find((t) => t.id === course.trackId)
  if (!track) return null
  const [modules, progress, rawAttempts, banks, rules] = await Promise.all([listModules([course.id]), progressOf(me.scope, { and: [{ user: { equals: me.user.id } }, { course: { equals: course.id } }] }), attemptsOf(me.scope, { and: [{ user: { equals: me.user.id } }, { course: { equals: course.id } }] }), bankSizes([course.id]), rulesFor(course)])
  const attempts: Attempt[] = []
  for (const a of rawAttempts) attempts.push(a.status === 'open' && isLate(a, new Date()) ? await finalise(me, a, a.answers, new Date(), course, track) : a)
  const bank = banks.get(course.id) ?? 0
  return { track, course, rules, modules, progress: new Map(progress.map((p) => [p.moduleId, p])), attempts, standing: courseStanding(course, modules, progress, attempts, rules, bank), bank }
}

export type ModuleView = CourseView & { module: Module; mine: Progress | null; required: number; source: VideoSource | null; prev: Module | null; next: Module | null; index: number }

export const trainingFileUrl = (fileId: string): string => `${PARTNER_TRAINING}/file/${fileId}`

export const loadModuleFor = async (me: PartnerContext, courseId: string, moduleId: string): Promise<ModuleView | null> => {
  const view = await loadCourseFor(me, courseId)
  if (!view) return null
  const index = view.modules.findIndex((m) => m.id === moduleId)
  if (index < 0) return null
  const mod = view.modules[index]!
  return { ...view, module: mod, mine: view.progress.get(mod.id) ?? null, required: requiredShareFor(mod, view.rules), source: mod.video ? videoSource(mod.video, trainingFileUrl) : null, prev: view.modules[index - 1] ?? null, next: view.modules[index + 1] ?? null, index }
}

/** A training file (a module's video or document) the user may read: referenced by a published module of a course open to
    them. Null otherwise, so the route answers 404 without a hint. */
export const trainingFileFor = async (me: PartnerContext, fileId: string): Promise<TrainingFile | null> => {
  if (!/^\d+$/.test(fileId)) return null
  const tracks = await myTracks(me)
  const courses = await listCourses({ trackIds: tracks.map((t) => t.id), status: 'published' })
  const modules = await listModules(courses.map((c) => c.id))
  for (const m of modules) {
    if (m.video?.provider === 'file' && m.video.fileId === fileId) return { id: m.video.fileId, name: m.video.name, mime: m.video.mime, size: 0 }
    const a = m.attachments.find((f) => f.id === fileId)
    if (a) return a
  }
  return null
}

export const serveTrainingFile = (file: { name: string; mime: string }, req: Request, o: { inline?: boolean } = {}): Response => serveStoredFile(TRAINING_DIR, file, req, o)

/* ---------- Progress (FR-TRN-02, 03) ---------- */

export type ProgressResult = { ok: true; share: number; complete: boolean; watched: number; duration: number } | { ok: false; error: string }

/** The player's post: the watched ranges merged into the row, the duration learnt, the position kept; completion once, with
    an audit line on the organisation. The module must be one the user may watch. */
export const recordProgress = async (me: PartnerContext, courseId: string, moduleId: string, posted: { ranges: unknown; duration?: unknown; position?: unknown }): Promise<ProgressResult> => {
  const view = await loadModuleFor(me, courseId, moduleId)
  if (!view) return { ok: false, error: 'Not a module you can take.' }
  const prev = view.mine
  const next = applyWatched(prev, posted, view.required)
  const payload = await db()
  const firstCompletion = next.complete && !prev?.completedAt
  const data = { ranges: next.ranges, duration: next.duration, watched: next.watched, share: next.share, lastPosition: next.lastPosition, courseVersion: view.course.version, ...(firstCompletion ? { completedAt: now() } : {}) }
  if (prev) await payload.update({ collection: 'partner-progress', id: Number(prev.id), overrideAccess: true, depth: 0, data: data as never })
  else await payload.create({ collection: 'partner-progress', overrideAccess: true, depth: 0, data: { ...data, user: Number(me.user.id), org: orgRel(me.scope) as number, module: Number(view.module.id), course: Number(view.course.id) } as never })
  // The module's duration is learnt from the first player that reports it, so the admin need not type it.
  if (view.module.durationSeconds === null && next.duration > 0) await payload.update({ collection: 'partner-modules', id: Number(view.module.id), overrideAccess: true, depth: 0, data: { durationSeconds: Math.round(next.duration) } }).catch(() => null)
  if (firstCompletion) {
    await audit({ actor: me.actor, object: 'partner-modules', objectId: view.module.id, objectLabel: `${view.course.title} · ${view.module.title}`, action: 'training.module.completed', to: `${Math.round(next.share * 100)}%`, orgId: me.scope.orgId })
    // Every module done on a course whose bank cannot make a paper: the Training Admin is told once per learner.
    if (view.bank === 0) {
      const done = new Set([...[...view.progress.keys()].filter((k) => view.progress.get(k)?.completedAt), view.module.id])
      if (view.modules.every((m) => done.has(m.id))) await notify({ event: 'training.bank.empty', vars: trainingVars(view.course, me.user, null, me.org), subject: `No test for ${view.course.title}`, body: `${me.user.name || me.user.email} (${me.org.tradeName || me.org.name}) has completed every module, and the course's question bank has no askable question. Add questions in the admin or import a CSV on the desk.`, href: `${K7_TRAINING}/${view.course.id}`, to: { kind: 'staff', role: 'trainingAdmin' } })
    }
  }
  return { ok: true, share: next.share, complete: next.complete, watched: next.watched, duration: next.duration }
}

/* ---------- The test (FR-TRN-04 … 06) ---------- */

export type AttemptMove = { ok: true; attempt: Attempt } | { ok: false; error: string }

/** Starts an attempt: the test must be unlocked; an open attempt still inside its time is resumed, one past it is closed first.
    The paper is drawn from the bank with a fresh seed and kept on the row. */
export const startAttempt = async (me: PartnerContext, view: CourseView): Promise<AttemptMove> => {
  const open = view.attempts.find((a) => a.status === 'open')
  if (open) return { ok: true, attempt: open }
  if (!view.standing.unlock.ok) return { ok: false, error: view.standing.unlock.reason }
  const bank = await listQuestions([view.course.id])
  const seed = `${me.user.id}:${view.course.id}:${Date.now()}:${randomBytes(6).toString('hex')}`
  const paper = drawPaper(bank, view.rules.questionsPerTest, seed)
  if (!paper.length) return { ok: false, error: 'The test for this course is not ready yet.' }
  const startedAt = new Date()
  const payload = await db()
  const doc = (await payload.create({
    collection: 'partner-attempts',
    overrideAccess: true,
    depth: 0,
    data: { user: Number(me.user.id), userName: me.user.name || me.user.email, org: orgRel(me.scope) as number, course: Number(view.course.id), courseVersion: view.course.version, status: 'open', startedAt: startedAt.toISOString(), expiresAt: expiresAt(startedAt, view.rules.timeLimitMinutes), seed, paper, answers: {}, total: paper.length, correct: 0, passMark: view.rules.passMark, showAnswers: view.rules.showAnswers, passed: false } as never,
  })) as unknown as Doc
  const attempt = toAttempt(doc)
  await audit({ actor: me.actor, object: 'partner-attempts', objectId: attempt.id, objectLabel: view.course.title, action: 'training.test.started', to: `${paper.length} questions · ${view.rules.timeLimitMinutes} min`, orgId: me.scope.orgId })
  return { ok: true, attempt }
}

/** One attempt of the user's, through the scope; an open attempt past its time is closed on the way. */
export const loadAttemptFor = async (me: PartnerContext, courseId: string, attemptId: string): Promise<{ view: CourseView; attempt: Attempt } | null> => {
  if (!/^\d+$/.test(attemptId)) return null
  const view = await loadCourseFor(me, courseId)
  if (!view) return null
  const attempt = view.attempts.find((a) => a.id === attemptId && a.userId === me.user.id) ?? null
  return attempt ? { view, attempt } : null
}

const finalise = async (me: PartnerContext, a: Attempt, answers: Record<string, string[]>, at: Date, course: Course, track: Track): Promise<Attempt> => {
  const late = isLate(a, at)
  const grade = gradePaper(a.paper, answers, a.passMark)
  const payload = await db()
  const doc = (await payload.update({ collection: 'partner-attempts', id: Number(a.id), overrideAccess: true, depth: 0, data: { status: late ? 'expired' : 'submitted', submittedAt: at.toISOString(), answers, score: grade.score, correct: grade.correct, total: grade.total, passed: grade.passed } as never })) as unknown as Doc
  const done = toAttempt(doc)
  await audit({ actor: me.actor, object: 'partner-attempts', objectId: done.id, objectLabel: course.title, action: late ? 'training.test.expired' : 'training.test.submitted', to: `${grade.score}% · ${grade.passed ? 'passed' : 'not passed'}`, orgId: me.scope.orgId, comment: `${grade.correct} of ${grade.total} · version ${a.courseVersion}` })
  if (grade.passed) {
    const vars = trainingVars({ title: course.title, trackName: track.name }, me.user, grade.score, me.org)
    const subject = `${course.title} passed · ${grade.score}%`
    const body = `${me.user.name || me.user.email} passed the ${track.name} course “${course.title}” with ${grade.score}% (${grade.correct} of ${grade.total}, pass mark ${a.passMark}%).`
    const href = `${PARTNER_TRAINING}/${course.id}/test/${done.id}/result`
    await notify({ event: 'training.course.passed', vars, subject, body, href, to: me.roles.includes('admin') ? { kind: 'org', orgId: me.scope.orgId, roles: ['admin'] } : [{ kind: 'user', user: me.user }, { kind: 'org', orgId: me.scope.orgId, roles: ['admin'] }] })
  }
  return done
}

/** The submission: the answers read against the paper, graded, stored; after the limit plus the grace the attempt is recorded
    as expired, graded on what was answered. Only the attempt's own user, only once. */
export const submitAttempt = async (me: PartnerContext, found: { view: CourseView; attempt: Attempt }, get: (name: string) => string[]): Promise<AttemptMove> => {
  const { view, attempt } = found
  if (attempt.status !== 'open') return { ok: false, error: 'This attempt is already submitted.' }
  const answers = answersFrom(attempt.paper, get)
  return { ok: true, attempt: await finalise(me, attempt, answers, new Date(), view.course, view.track) }
}

/* ---------- The organisation (FR-TRN-11) ---------- */

export type OrgTrainingRow = { user: PartnerUser; groups: TrackGroup[] }

/** Every active user of the organisation with the tracks open to them and their standing on each course. */
export const orgTrainingFor = async (me: PartnerContext): Promise<OrgTrainingRow[]> => {
  const users = (await orgUsers(me.scope.orgId)).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
  const out: OrgTrainingRow[] = []
  for (const user of users) out.push({ user, groups: await trainingFor(me, user) })
  return out
}

/* ---------- The K7 side ---------- */

export type TrainingCounts = { tracks: number; published: number; draft: number; questions: number; learners30: number; passes30: number; banksEmpty: number }

const since = (days: number): string => new Date(Date.now() - days * 86400000).toISOString()

export const trainingCounts = async (): Promise<TrainingCounts> => {
  const payload = await db()
  const [tracks, courses, questions, progress, attempts] = await Promise.all([
    listTracks('all'),
    listCourses({ status: 'all' }),
    payload.count({ collection: 'partner-questions', where: { active: { equals: true } }, overrideAccess: true }),
    payload.find({ collection: 'partner-progress', where: { updatedAt: { greater_than: since(30) } }, limit: BIG, depth: 0, overrideAccess: true }),
    payload.count({ collection: 'partner-attempts', where: { and: [{ passed: { equals: true } }, { submittedAt: { greater_than: since(30) } }] }, overrideAccess: true }),
  ])
  const published = courses.filter((c) => c.status === 'published')
  const banks = await bankSizes(published.map((c) => c.id))
  return {
    tracks: tracks.filter((t) => t.status === 'published').length,
    published: published.length,
    draft: courses.filter((c) => c.status === 'draft').length,
    questions: questions.totalDocs,
    learners30: new Set((progress.docs as unknown as Doc[]).map((d) => s(typeof d.user === 'object' && d.user ? (d.user as Doc).id : d.user))).size,
    passes30: attempts.totalDocs,
    banksEmpty: published.filter((c) => !(banks.get(c.id) ?? 0)).length,
  }
}

export type K7CourseRow = { course: Course; track: Track | null; modules: number; modulesDraft: number; bank: number; bankTotal: number; learners: number; completed: number; passed: number; attempts: number; passRate: number | null }

/** Every course in every state with its content and its learners' numbers. */
export const k7CourseLedger = async (): Promise<K7CourseRow[]> => {
  const payload = await db()
  const [tracks, courses] = await Promise.all([listTracks('all'), listCourses({ status: 'all' })])
  const ids = courses.map((c) => c.id)
  const [modules, questions, progress, attempts] = await Promise.all([listModules(ids, false), listQuestions(ids), payload.find({ collection: 'partner-progress', limit: BIG, depth: 0, overrideAccess: true }), payload.find({ collection: 'partner-attempts', where: { status: { not_equals: 'open' } }, limit: BIG, depth: 0, overrideAccess: true })])
  const prog = (progress.docs as unknown as Doc[]).map(toProgress)
  const att = (attempts.docs as unknown as Doc[]).map(toAttempt)
  const ask = askable(questions)
  return courses.map((course) => {
    const mods = modules.filter((m) => m.courseId === course.id)
    const live = mods.filter((m) => m.status === 'published')
    const p = prog.filter((x) => x.courseId === course.id)
    const a = att.filter((x) => x.courseId === course.id)
    const learners = new Set([...p.map((x) => x.userId), ...a.map((x) => x.userId)])
    const completed = [...learners].filter((u) => live.length && live.every((m) => p.some((x) => x.userId === u && x.moduleId === m.id && x.completedAt))).length
    const passed = new Set(a.filter((x) => x.passed).map((x) => x.userId)).size
    const takers = new Set(a.map((x) => x.userId)).size
    return { course, track: tracks.find((t) => t.id === course.trackId) ?? null, modules: live.length, modulesDraft: mods.length - live.length, bank: ask.filter((q) => q.courseId === course.id).length, bankTotal: questions.filter((q) => q.courseId === course.id).length, learners: learners.size, completed, passed, attempts: a.length, passRate: takers ? Math.round((passed / takers) * 100) : null }
  })
}

export type Learner = { userId: string; name: string; email: string; orgId: string; orgName: string; partnerId: string; modulesDone: number; modulesTotal: number; attempts: number; best: Attempt | null; pass: Attempt | null; lastActivity: string | null }
export type K7CourseView = { course: Course; track: Track | null; rules: CourseRules; modules: Module[]; bank: Question[]; askable: number; invalid: { q: Question; why: string }[]; learners: Learner[]; recent: Attempt[] }

export const k7CourseView = async (courseId: string): Promise<K7CourseView | null> => {
  const course = await loadCourse(courseId)
  if (!course) return null
  const payload = await db()
  const [track, modules, bank, rules, progress, attempts] = await Promise.all([loadTrack(course.trackId), listModules([course.id], false), listQuestions([course.id]), rulesFor(course), payload.find({ collection: 'partner-progress', where: { course: { equals: course.id } }, limit: BIG, depth: 1, overrideAccess: true }), payload.find({ collection: 'partner-attempts', where: { course: { equals: course.id } }, limit: BIG, depth: 1, sort: '-startedAt', overrideAccess: true })])
  const live = modules.filter((m) => m.status === 'published')
  const people = new Map<string, Learner>()
  const seen = (doc: Doc): Learner => {
    const u = (typeof doc.user === 'object' && doc.user ? doc.user : {}) as Doc
    const o = (typeof doc.org === 'object' && doc.org ? doc.org : {}) as Doc
    const id = s(u.id ?? doc.user)
    let l = people.get(id)
    if (!l) {
      l = { userId: id, name: s(u.name), email: s(u.email), orgId: s(o.id ?? doc.org), orgName: s(o.tradeName) || s(o.name), partnerId: s(o.partnerId), modulesDone: 0, modulesTotal: live.length, attempts: 0, best: null, pass: null, lastActivity: null }
      people.set(id, l)
    }
    return l
  }
  for (const d of progress.docs as unknown as Doc[]) {
    const p = toProgress(d)
    const l = seen(d)
    if (p.completedAt && live.some((m) => m.id === p.moduleId)) l.modulesDone++
    if (!l.lastActivity || p.updatedAt > l.lastActivity) l.lastActivity = p.updatedAt
  }
  const att = (attempts.docs as unknown as Doc[]).map((d) => ({ d, a: toAttempt(d) }))
  for (const { d, a } of att) {
    const l = seen(d)
    if (a.status === 'open') continue
    l.attempts++
    if (!l.best || Number(a.passed) - Number(l.best.passed) > 0 || (a.passed === l.best.passed && (a.score ?? 0) > (l.best.score ?? 0))) l.best = a
    if (a.passed && (!l.pass || a.startedAt > l.pass.startedAt)) l.pass = a
    const at = a.submittedAt ?? a.startedAt
    if (!l.lastActivity || at > l.lastActivity) l.lastActivity = at
  }
  const invalid = bank.map((q) => ({ q, why: q.active ? (questionValid(q) ?? '') : 'Inactive' })).filter((x) => x.why)
  return { course, track, rules, modules, bank, askable: askable(bank).length, invalid, learners: [...people.values()].sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? '')), recent: att.map((x) => x.a).filter((a) => a.status !== 'open').slice(0, 20) }
}

export type ImportResult = { ok: true; imported: number; errors: CsvImport['errors'] } | { ok: false; error: string; errors: CsvImport['errors'] }

/** FR-TRN-13: the bank from a CSV in the template's columns, appended to the course; bad rows are reported by line and the
    good ones kept. */
export const importQuestions = async (course: Course, csv: string, me: K7Context): Promise<ImportResult> => {
  if (csv.length > 2_000_000) return { ok: false, error: 'The file is larger than 2 MB.', errors: [] }
  const parsed = questionsFromCsv(csv)
  if (!parsed.questions.length) return { ok: false, error: parsed.errors[0]?.message ?? 'No question in the file.', errors: parsed.errors }
  const payload = await db()
  const at = now()
  for (const q of parsed.questions) await payload.create({ collection: 'partner-questions', overrideAccess: true, depth: 0, data: { course: Number(course.id), type: q.type, text: q.text, options: q.options, explanation: q.explanation, topic: q.topic, active: true, importedAt: at } as never })
  await audit({ actor: me.actor, object: 'partner-courses', objectId: course.id, objectLabel: course.title, action: 'training.bank.imported', to: `${parsed.questions.length} questions`, comment: parsed.errors.length ? `${parsed.errors.length} row${parsed.errors.length === 1 ? '' : 's'} refused` : `by ${who(me.actor)}` })
  return { ok: true, imported: parsed.questions.length, errors: parsed.errors }
}

export { toTrainingFile }
export type { CourseRow, TrackGroup }
