import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

/* The doors on every partner-portal entry point, read from the source (M9): a scheduled route carries the cron guard, a
   file or CSV route under the portal asks who is calling, a server action under the signed-in pages calls a `require…`
   helper before anything else. A route or action added later without its door fails here, before a browser finds it. */

const ROOT = path.resolve(__dirname, '../../src/app')
const walk = (dir: string, name: string, out: string[] = []): string[] => {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f)
    if (statSync(p).isDirectory()) walk(p, name, out)
    else if (f === name) out.push(p)
  }
  return out
}
const rel = (p: string) => path.relative(ROOT, p)

describe('every partner-portal entry point has its door', () => {
  it('the scheduled routes under /api/partners check the cron secret with the shared guard; health is the one public answer', () => {
    const routes = walk(path.join(ROOT, 'api/partners'), 'route.ts')
    expect(routes.length).toBeGreaterThanOrEqual(8)
    for (const r of routes) {
      const src = readFileSync(r, 'utf8')
      if (rel(r) === 'api/partners/health/route.ts') {
        expect(src, rel(r)).not.toMatch(/process\.env/)
        continue
      }
      expect(src, rel(r)).toMatch(/cronAuthorised\(req\)/)
      expect(src, rel(r)).not.toMatch(/authorization'\) !==/)
      expect(src, rel(r)).toMatch(/recordJobRun\(/)
    }
  })
  it('the file and CSV routes under the portal ask who is calling', () => {
    const routes = walk(path.join(ROOT, '(partner)'), 'route.ts')
    expect(routes.length).toBeGreaterThanOrEqual(8)
    for (const r of routes) {
      const src = readFileSync(r, 'utf8')
      const k7 = rel(r).includes('/k7/')
      expect(src, rel(r)).toMatch(k7 ? /\b(tryK7|requireK7|requireK7Role)\(/ : /\b(tryPartner|requirePartner|requirePartnerRole)\(/)
      expect(src, rel(r)).toMatch(/status: 401|requireK7|requirePartner/)
    }
  })
  it('every server action under the signed-in pages requires a session before it acts; the public door and sign-out are the exceptions', () => {
    const actions = walk(path.join(ROOT, '(partner)/partners/portal'), 'actions.ts')
    expect(actions.length).toBeGreaterThanOrEqual(12)
    for (const a of actions) {
      const src = readFileSync(a, 'utf8')
      const r = rel(a)
      if (r.endsWith('portal/sign-in/actions.ts')) continue
      // The shared bell action (notifications/actions.ts) serves both sides and acts only for the session it finds, through the try… pair.
      const door = r.includes('/k7/') ? /await (requireK7|requireK7Role)\(/ : /await (requirePartner|requirePartnerRole|tryPartner)\(/
      // A file may put the door in one local helper (`const load = async (form) => { const me = await requireK7Role(…) … }`)
      // that every action awaits first; such helpers count as the door.
      const locals = [...src.matchAll(/\nconst (\w+) = async [^\n]*\n([\s\S]*?)\n}/g)].map((m) => ({ name: m[1]!, body: m[2]! }))
      const helpers: string[] = []
      for (let grew = true; grew; ) {
        grew = false
        for (const l of locals) {
          if (helpers.includes(l.name) || !(door.test(l.body) || helpers.some((h) => new RegExp(`await ${h}\\(`).test(l.body)))) continue
          helpers.push(l.name)
          grew = true
        }
      }
      const fns = src.split(/\nexport async function /).slice(1)
      expect(fns.length, r).toBeGreaterThan(0)
      for (const fn of fns) {
        const name = fn.split('(')[0] ?? ''
        if (name.startsWith('signOut')) continue // ending a session needs none
        const viaHelper = helpers.some((h) => new RegExp(`await ${h}\\(`).test(fn))
        expect(door.test(fn) || viaHelper, `${r} → ${name} (helpers: ${helpers.join(', ') || 'none'})`).toBe(true)
      }
    }
  })
  it('the proxy gates both sides and leaves only the door public', () => {
    const src = readFileSync(path.resolve(ROOT, '../proxy.ts'), 'utf8')
    expect(src).toMatch(/\/partners\/portal\/k7/)
    expect(src).toMatch(/sign-in\|verify/)
    expect(src).toMatch(/'\/partners\/portal\/:path\*'/)
  })
})
