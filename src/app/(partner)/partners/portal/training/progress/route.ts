import { tryPartner } from '@/lib/partner/session'
import { recordProgress } from '@/lib/partner/training'

/* The player's progress post (FR-TRN-02, 03): the watched ranges since the last post, the duration and the position, for a
   module the signed-in user may take. The server merges and decides completion; the answer is the share and whether the
   module is complete. Same-origin only: a cross-site page cannot credit a module (the session cookie is SameSite and the
   Origin is checked). */
export async function POST(req: Request) {
  const me = await tryPartner()
  if (!me) return new Response('Sign in first', { status: 401 })
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (origin && host && new URL(origin).host !== host) return new Response('Forbidden', { status: 403 })
  let body: { moduleId?: unknown; courseId?: unknown; ranges?: unknown; duration?: unknown; position?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'Bad JSON' }, { status: 400 })
  }
  const moduleId = String(body.moduleId ?? '')
  const courseId = String(body.courseId ?? '')
  if (!/^\d+$/.test(moduleId) || !/^\d+$/.test(courseId)) return Response.json({ error: 'No module' }, { status: 400 })
  const r = await recordProgress(me, courseId, moduleId, { ranges: body.ranges, duration: body.duration, position: body.position })
  if (!r.ok) return Response.json({ error: r.error }, { status: 404 })
  return Response.json({ share: r.share, complete: r.complete, watched: r.watched, duration: r.duration }, { headers: { 'Cache-Control': 'no-store' } })
}
