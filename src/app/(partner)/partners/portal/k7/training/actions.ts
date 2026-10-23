'use server'

import { redirect } from 'next/navigation'

import { requireK7Role } from '@/lib/partner/session'
import { importQuestions, K7_TRAINING, loadCourse } from '@/lib/partner/training'

/* The Training Admin's one move on the desk (FR-TRN-13): a CSV of questions appended to a course's bank. The role is
   re-checked on the server; the library parses, refuses bad rows by line and writes the trail. */

const back = (path: string, q: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(q).toString()}`)

export async function importQuestionsAction(form: FormData): Promise<void> {
  const courseId = String(form.get('courseId') ?? '').trim()
  const path = `${K7_TRAINING}/${encodeURIComponent(courseId)}`
  const me = await requireK7Role(['trainingAdmin'], path)
  const course = await loadCourse(courseId)
  if (!course) redirect(K7_TRAINING)
  const file = form.get('csv')
  if (!(file instanceof File) || !file.size) return back(path, { error: 'Choose a CSV file.' })
  if (file.size > 2_000_000) return back(path, { error: 'The file is larger than 2 MB.' })
  const r = await importQuestions(course, await file.text(), me)
  const lines = r.errors
    .slice(0, 20)
    .map((e) => `Line ${e.line}: ${e.message}`)
    .join('|')
  if (!r.ok) return back(path, { error: r.error, ...(lines ? { lines } : {}) })
  back(path, { ok: `${r.imported} question${r.imported === 1 ? '' : 's'} imported${r.errors.length ? `; ${r.errors.length} row${r.errors.length === 1 ? '' : 's'} refused` : ''}.`, ...(lines ? { lines } : {}) })
}
