import { describe, expect, it } from 'vitest'

import { normalisePartnerSettings } from '@/lib/partner/settings-model'
import { answersFrom, applyWatched, askable, bestAttempt, courseRules, courseStanding, CSV_TEMPLATE, drawPaper, expiresAt, gradePaper, isLate, latestPass, mergeRanges, moduleComplete, parseCsv, parseRanges, questionsFromCsv, questionValid, requiredShareFor, secondsLeft, standingLabel, testUnlocked, toModule, trackOpenTo, watchShare, type Attempt, type Course, type Module, type Progress, type Question } from '@/lib/partner/training-model'
import { parseVideoRef, videoSource } from '@/lib/partner/video'

/* Training without a tenant (docs/partner-portal/04-portal-guide.md M10): the watched ranges and the completion rule
   (FR-TRN-03), the unlock rule (FR-TRN-04), the draw and the shuffle from the bank with a seed, the grading (FR-TRN-06), the
   time limit (FR-TRN-05), who a track is for (FR-TRN-01), the standing with the version note (FR-TRN-14), the CSV import
   (FR-TRN-13), the video reference and the settings. */

const course = (over: Partial<Course> = {}): Course => ({ id: '1', trackId: '1', trackName: 'Sales', title: 'Selling', description: '', order: 10, status: 'published', version: 2, passMark: null, timeLimitMinutes: null, questionsPerTest: null, showAnswers: 'default', requiredShare: null, publishedAt: null, updatedAt: '', ...over })
const mod = (id: string, over: Partial<Module> = {}): Module => ({ id, courseId: '1', title: `M${id}`, order: Number(id), description: '', reading: '', video: { provider: 'url', src: 'https://x/v.mp4' }, durationSeconds: 100, requiredShare: null, attachments: [], status: 'published', ...over })
const prog = (moduleId: string, share: number, over: Partial<Progress> = {}): Progress => ({ id: moduleId, userId: 'u', orgId: 'o', moduleId, courseId: '1', courseVersion: 1, ranges: [], duration: 100, watched: share * 100, share, lastPosition: 0, completedAt: null, updatedAt: '2026-10-23T10:00:00.000Z', ...over })
const q = (id: string, type: Question['type'], options: [string, boolean][], over: Partial<Question> = {}): Question => ({ id, courseId: '1', type, text: `Q${id}?`, options: options.map(([text, correct]) => ({ text, correct })), explanation: '', active: true, topic: '', ...over })
const attempt = (over: Partial<Attempt> = {}): Attempt => ({ id: 'a', userId: 'u', userName: 'U', orgId: 'o', courseId: '1', courseVersion: 1, status: 'submitted', startedAt: '2026-10-23T09:00:00.000Z', expiresAt: null, submittedAt: '2026-10-23T09:10:00.000Z', seed: 's', paper: [], answers: {}, score: 50, correct: 5, total: 10, passed: false, passMark: 70, showAnswers: true, createdAt: '', ...over })
const T = normalisePartnerSettings({}).training

describe('watched ranges (FR-TRN-03)', () => {
  it('merges touching and overlapping ranges and drops malformed ones', () => {
    expect(mergeRanges([[10, 20], [0, 5], [19, 30], [30.5, 40]])).toEqual([[0, 5], [10, 40]])
    expect(parseRanges([[0, 10], ['a', 2], [5], [20, 10], [30, 30.1], [90, 500]], 100)).toEqual([[0, 10], [90, 100]])
    expect(parseRanges('nope')).toEqual([])
  })
  it('counts the union, never above the whole, and skipping ahead leaves a gap', () => {
    expect(watchShare([[0, 50], [25, 75]], 100)).toBe(0.75)
    expect(watchShare([[0, 200]], 100)).toBe(1)
    expect(watchShare([[0, 10]], null)).toBe(0)
    // Watched the first 40 s, skipped to 90 and watched to the end: 50 of 100.
    expect(watchShare([[0, 40], [90, 100]], 100)).toBe(0.5)
  })
  it('completes at the required share, and within a second of the end', () => {
    expect(moduleComplete(0.9, 0.9)).toBe(true)
    expect(moduleComplete(0.89, 0.9)).toBe(false)
    expect(moduleComplete(0.997, 1, 300)).toBe(true)
    expect(moduleComplete(0.99, 1, 300)).toBe(false)
    expect(moduleComplete(0.5, 0.9, 100)).toBe(false)
  })
  it('applies a post onto the row: the ranges merged, the duration learnt, the position kept, completion decided', () => {
    const first = applyWatched(null, { ranges: [[0, 30]], duration: 100, position: 30 }, 0.9)
    expect(first).toMatchObject({ ranges: [[0, 30]], duration: 100, watched: 30, share: 0.3, lastPosition: 30, complete: false })
    const second = applyWatched({ ranges: first.ranges, duration: first.duration, lastPosition: 30 }, { ranges: [[29, 95]], position: 95 }, 0.9)
    expect(second.share).toBe(0.95)
    expect(second.complete).toBe(true)
    // A bogus duration smaller than what is known does not shrink it; a position past the end is clamped.
    const third = applyWatched({ ranges: second.ranges, duration: 100, lastPosition: 95 }, { ranges: [], duration: 10, position: 500 }, 0.9)
    expect(third.duration).toBe(100)
    expect(third.lastPosition).toBe(100)
  })
})

describe('rules, tracks and the unlock (FR-TRN-01, 04, 05)', () => {
  it('takes the course’s values where set, else the programme’s; a module may set its own share', () => {
    expect(courseRules(course(), T)).toEqual({ passMark: 70, timeLimitMinutes: 20, questionsPerTest: 10, showAnswers: true, requiredShare: 0.9 })
    const r = courseRules(course({ passMark: 80, timeLimitMinutes: 5, questionsPerTest: 3, showAnswers: 'no', requiredShare: 0.5 }), T)
    expect(r).toEqual({ passMark: 80, timeLimitMinutes: 5, questionsPerTest: 3, showAnswers: false, requiredShare: 0.5 })
    expect(requiredShareFor(mod('1', { requiredShare: 0.75 }), r)).toBe(0.75)
    expect(requiredShareFor(mod('1'), r)).toBe(0.5)
    expect(courseRules(course({ passMark: 500 }), T).passMark).toBe(70)
  })
  it('a track opens to the roles it names, or to everyone when it names none; never while unpublished', () => {
    expect(trackOpenTo({ roles: ['sales'], status: 'published' }, ['sales', 'admin'])).toBe(true)
    expect(trackOpenTo({ roles: ['sales'], status: 'published' }, ['technical'])).toBe(false)
    expect(trackOpenTo({ roles: [], status: 'published' }, ['admin'])).toBe(true)
    expect(trackOpenTo({ roles: [], status: 'draft' }, ['sales'])).toBe(false)
  })
  it('unlocks the test only when every published module is complete and the bank can ask something', () => {
    const mods = [mod('1'), mod('2'), mod('3', { status: 'draft' })]
    expect(testUnlocked(mods, new Set(['1']), 5)).toMatchObject({ ok: false, remaining: 1 })
    expect(testUnlocked(mods, new Set(['1', '2']), 5)).toEqual({ ok: true })
    expect(testUnlocked(mods, new Set(['1', '2']), 0).ok).toBe(false)
    expect(testUnlocked([], new Set(), 5)).toMatchObject({ ok: false, reason: expect.stringMatching(/no module/) })
  })
  it('times the attempt and allows the grace', () => {
    const start = new Date('2026-10-23T09:00:00.000Z')
    const exp = expiresAt(start, 20)
    expect(exp).toBe('2026-10-23T09:20:00.000Z')
    expect(secondsLeft({ expiresAt: exp }, new Date('2026-10-23T09:19:30.000Z'))).toBe(30)
    expect(secondsLeft({ expiresAt: exp }, new Date('2026-10-23T09:25:00.000Z'))).toBe(0)
    expect(isLate({ expiresAt: exp }, new Date('2026-10-23T09:20:30.000Z'))).toBe(false)
    expect(isLate({ expiresAt: exp }, new Date('2026-10-23T09:21:00.000Z'))).toBe(true)
    expect(isLate({ expiresAt: null }, new Date())).toBe(false)
  })
})

describe('the bank, the draw and the grading (FR-TRN-04, 06)', () => {
  const bank = [
    q('1', 'single', [['A', true], ['B', false], ['C', false]]),
    q('2', 'single', [['A', false], ['B', true]]),
    q('3', 'multiple', [['A', true], ['B', true], ['C', false]]),
    q('4', 'trueFalse', [['True', true], ['False', false]]),
    q('5', 'single', [['A', true], ['B', false]], { active: false }),
    q('6', 'single', [['A', true], ['B', true]]),
    q('7', 'multiple', [['A', true], ['B', true]]),
    q('8', 'trueFalse', [['True', true], ['False', false], ['Maybe', false]]),
    q('9', 'single', [['Only', true]]),
  ]
  it('tells a question that cannot be asked why', () => {
    expect(questionValid(bank[0]!)).toBeNull()
    expect(questionValid(bank[5]!)).toMatch(/exactly one correct/)
    expect(questionValid(bank[6]!)).toMatch(/at least one wrong/)
    expect(questionValid(bank[7]!)).toMatch(/exactly two options/)
    expect(questionValid(bank[8]!)).toMatch(/Fewer than two/)
    expect(askable(bank).map((x) => x.id)).toEqual(['1', '2', '3', '4'])
  })
  it('draws the same paper from the same seed, a different one from another, with the options shuffled and keyed', () => {
    const a = drawPaper(bank, 3, 'seed-one')
    const b = drawPaper(bank, 3, 'seed-one')
    expect(a).toEqual(b)
    expect(a).toHaveLength(3)
    const seen = new Set<string>()
    for (let i = 0; i < 20; i++) seen.add(drawPaper(bank, 3, `seed-${i}`).map((x) => x.qid).join(','))
    expect(seen.size).toBeGreaterThan(1)
    const all = drawPaper(bank, 10, 'x')
    expect(all).toHaveLength(4)
    for (const pq of all) {
      expect(pq.options.map((o) => o.key)).toEqual(pq.options.map((_, i) => 'abcdefghij'[i]))
      expect(pq.correct.length).toBeGreaterThan(0)
      if (pq.type === 'trueFalse') expect(pq.options.map((o) => o.text)).toEqual(['True', 'False'])
      // The correct keys point at options that were correct in the bank.
      const src = bank.find((x) => x.id === pq.qid)!
      for (const k of pq.correct) expect(src.options.find((o) => o.text === pq.options.find((p) => p.key === k)!.text)!.correct).toBe(true)
    }
  })
  it('grades all-or-nothing, reads only valid keys, and passes at the mark', () => {
    const paper = drawPaper(bank, 10, 'g')
    const perfect: Record<string, string[]> = Object.fromEntries(paper.map((pq) => [pq.qid, pq.correct]))
    expect(gradePaper(paper, perfect, 70)).toMatchObject({ correct: 4, total: 4, score: 100, passed: true })
    const multi = paper.find((pq) => pq.type === 'multiple')!
    const partial = { ...perfect, [multi.qid]: [multi.correct[0]!] }
    expect(gradePaper(paper, partial, 70)).toMatchObject({ correct: 3, score: 75, passed: true })
    expect(gradePaper(paper, partial, 80).passed).toBe(false)
    expect(gradePaper(paper, {}, 70)).toMatchObject({ correct: 0, score: 0, passed: false })
    expect(gradePaper([], {}, 70).passed).toBe(false)
    const single = paper.find((pq) => pq.type === 'single')!
    const read = answersFrom(paper, (name) => (name === `q_${single.qid}` ? ['zz', single.correct[0]!, 'b'] : name === `q_${multi.qid}` ? ['b', 'a'] : []))
    expect(read[single.qid]).toHaveLength(1)
    expect(read[multi.qid]).toEqual(['a', 'b'])
  })
})

describe('the standing (FR-TRN-11, 14)', () => {
  const mods = [mod('1'), mod('2')]
  const rules = courseRules(course(), T)
  it('reads not started, in progress, ready, failed and passed, with the version note', () => {
    const none = courseStanding(course(), mods, [], [], rules, 5)
    expect(none).toMatchObject({ modulesDone: 0, modulesTotal: 2, test: 'locked', attempts: 0 })
    expect(standingLabel(none)).toBe('Not started')
    const half = courseStanding(course(), mods, [prog('1', 0.95), prog('2', 0.3)], [], rules, 5)
    expect(half.modulesDone).toBe(1)
    expect(standingLabel(half)).toBe('1 of 2 modules')
    const ready = courseStanding(course(), mods, [prog('1', 0.95), prog('2', 0.91)], [], rules, 5)
    expect(ready.test).toBe('ready')
    const failed = courseStanding(course(), mods, [prog('1', 1), prog('2', 1)], [attempt({ id: 'a1', score: 40 }), attempt({ id: 'a2', score: 60, startedAt: '2026-10-23T10:00:00.000Z' })], rules, 5)
    expect(failed.test).toBe('failed')
    expect(failed.best?.id).toBe('a2')
    expect(standingLabel(failed)).toBe('Not passed · best 60%')
    const passed = courseStanding(course({ version: 2 }), mods, [prog('1', 1), prog('2', 1)], [attempt({ id: 'p', score: 80, passed: true, courseVersion: 1 }), attempt({ id: 'later', score: 50, startedAt: '2026-10-24T09:50:00.000Z', submittedAt: '2026-10-24T10:00:00.000Z' })], rules, 5)
    expect(passed.test).toBe('passed')
    expect(passed.pass?.id).toBe('p')
    expect(passed.passOutdated).toBe(true)
    expect(passed.attempts).toBe(2)
    expect(passed.lastActivity).toBe('2026-10-24T10:00:00.000Z')
  })
  it('an open attempt is neither best nor a pass; a completed flag counts even when the share is under the rule now', () => {
    expect(bestAttempt([attempt({ status: 'open', score: null })])).toBeNull()
    expect(latestPass([attempt({ status: 'open', passed: true })])).toBeNull()
    const st = courseStanding(course(), mods, [prog('1', 0.5, { completedAt: '2026-10-01T00:00:00.000Z' }), prog('2', 0.95)], [], rules, 5)
    expect(st.modulesDone).toBe(2)
    expect(st.test).toBe('ready')
  })
})

describe('the CSV import (FR-TRN-13)', () => {
  it('parses RFC 4180 fields', () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\r\n\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"']])
    expect(parseCsv('﻿a,b\n1,"two\nlines"')).toEqual([['a', 'b'], ['1', 'two\nlines']])
  })
  it('reads the template, keeps good rows and refuses bad ones by line', () => {
    const t = questionsFromCsv(CSV_TEMPLATE)
    expect(t.errors).toEqual([])
    expect(t.questions.map((x) => x.type)).toEqual(['single', 'multiple', 'trueFalse'])
    expect(t.questions[1]!.options.filter((o) => o.correct).map((o) => o.text)).toEqual(['Register before quoting', 'One extension per deal'])
    const mixed = ['type,question,option1,option2,option3,correct,explanation', 'single,Good?,A,B,,a,', 'tf,Shorter alias?,,,,true,', 'multiple,Letters,A,B,C,"a;c",', 'single,Bad correct,A,B,,4,', 'riddle,Bad type,A,B,,1,', 'single,Two correct,A,B,,"1,2",', 'multiple,All correct,A,B,,"1,2",'].join('\n')
    const r = questionsFromCsv(mixed)
    expect(r.questions.map((x) => x.text)).toEqual(['Good?', 'Shorter alias?', 'Letters'])
    expect(r.questions[1]!.options).toEqual([{ text: 'True', correct: true }, { text: 'False', correct: false }])
    expect(r.questions[2]!.options.map((o) => o.correct)).toEqual([true, false, true])
    expect(r.errors.map((e) => e.line)).toEqual([5, 6, 7, 8])
    expect(questionsFromCsv('nope,header\n1,2').errors[0]!.message).toMatch(/missing type, question, correct/)
    expect(questionsFromCsv('').errors[0]!.message).toMatch(/empty/)
  })
})

describe('the video reference (decision 18)', () => {
  it('reads Vimeo ids and URLs, direct media links, and refuses the rest', () => {
    expect(parseVideoRef('vimeo:123456789')).toEqual({ provider: 'vimeo', id: '123456789', hash: '' })
    expect(parseVideoRef('https://vimeo.com/123456789/abcdef1234')).toEqual({ provider: 'vimeo', id: '123456789', hash: 'abcdef1234' })
    expect(parseVideoRef('https://player.vimeo.com/video/123456789?h=feedbeef')).toEqual({ provider: 'vimeo', id: '123456789', hash: 'feedbeef' })
    expect(parseVideoRef('https://cdn.example.com/a/b.mp4?x=1')).toEqual({ provider: 'url', src: 'https://cdn.example.com/a/b.mp4?x=1' })
    expect(parseVideoRef('https://www.youtube.com/watch?v=abc')).toBeNull()
    expect(parseVideoRef('')).toBeNull()
    expect(parseVideoRef('ftp://x/y.mp4')).toBeNull()
  })
  it('makes the embed with the hash and without tracking, and the portal route for a file', () => {
    const v = videoSource({ provider: 'vimeo', id: '1', hash: 'h1' }, (id) => `/f/${id}`)
    expect(v.provider === 'vimeo' && v.embed).toMatch(/^https:\/\/player\.vimeo\.com\/video\/1\?dnt=1.*h=h1/)
    expect(videoSource({ provider: 'file', fileId: '9', name: 'v.mp4', mime: 'video/mp4' }, (id) => `/f/${id}`)).toEqual({ provider: 'file', src: '/f/9', mime: 'video/mp4' })
    expect(videoSource({ provider: 'url', src: 'https://x/y.webm' }, () => '')).toMatchObject({ mime: 'video/webm' })
  })
  it('a module prefers the uploaded file over the typed reference', () => {
    const m = toModule({ id: 1, course: 1, title: 'M', video: 'vimeo:123456', videoFile: { id: 7, filename: 'clip.mp4', mimeType: 'video/mp4', filesize: 10 }, status: 'published' })
    expect(m.video).toEqual({ provider: 'file', fileId: '7', name: 'clip.mp4', mime: 'video/mp4' })
    expect(toModule({ id: 2, course: 1, title: 'M', video: 'vimeo:123456', status: 'draft' }).video).toMatchObject({ provider: 'vimeo', id: '123456' })
  })
})

describe('the settings', () => {
  it('normalises the training block with its defaults and bounds', () => {
    expect(normalisePartnerSettings({ training: { watchShare: 0.8, passMark: 75, timeLimitMinutes: 30, questionsPerTest: 15, showAnswers: false } }).training).toEqual({ watchShare: 0.8, passMark: 75, timeLimitMinutes: 30, questionsPerTest: 15, showAnswers: false })
    expect(normalisePartnerSettings({ training: { watchShare: 5, passMark: 0, timeLimitMinutes: -1 } }).training).toEqual(T)
  })
})
