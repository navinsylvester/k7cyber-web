import 'server-only'
import fontkit from '@pdf-lib/fontkit'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import QRCode from 'qrcode'

import { CERT_KIND_LABEL, type Certificate, type CertificateSettings } from './certificates-model'
import { PARTNER_TYPE_LABEL } from './settings-model'

/* The certificate as a PDF (FR-TRN-07, FR-CRT-03; decision 12), drawn in the server with pdf-lib on the design language's own
   terms (design-system/README.md, section 10 P33): A4 landscape on paper, everything said in Archivo and everything counted in
   IBM Plex Mono (the TTFs in design-system/assets/fonts, embedded and subset), the sheet as a hairline frame with its tab on
   the 7's 24.5° carrying the kind, the K7 mark drawn from the logo's own paths, the one signal pixel beside the number, the QR
   as plain squares that lead to the public verification page, the signatory over a rule (the image the environment names,
   else the name alone). No colour but ink, paper, the hairline, the mark's own orange and the signal. The file is the same for
   both themes of the site: a certificate is paper. */

const ROOT = process.cwd()
const FONT_DIR = path.join(ROOT, 'design-system', 'assets', 'fonts')
const LOGO = path.join(ROOT, 'design-system', 'assets', 'Logos', 'k7-cybersecurity-logo.svg')

const PAPER = rgb(239 / 255, 238 / 255, 232 / 255)
const INK = rgb(10 / 255, 10 / 255, 9 / 255)
const LINE = rgb(202 / 255, 202 / 255, 196 / 255) // ink at 16% over paper
const MUTED = rgb(88 / 255, 88 / 255, 86 / 255) // ink at 66% over paper
const SIGNAL = rgb(1, 69 / 255, 33 / 255)
const BRAND = rgb(236 / 255, 106 / 255, 35 / 255) // the 7 of the mark, as the logo file has it

const W = 841.89
const H = 595.28
const M = 44
const TAN7 = Math.tan((24.5 * Math.PI) / 180)

type Fonts = { regular: PDFFont; medium: PDFFont; semibold: PDFFont; mono: PDFFont; embedded: boolean }

const readFont = (name: string): Uint8Array | null => {
  const p = path.join(FONT_DIR, name)
  return existsSync(p) ? new Uint8Array(readFileSync(p)) : null
}

const loadFonts = async (doc: PDFDocument): Promise<Fonts> => {
  const files = { regular: readFont('Archivo-Regular.ttf'), medium: readFont('Archivo-Medium.ttf'), semibold: readFont('Archivo-SemiBold.ttf'), mono: readFont('IBMPlexMono-Regular.ttf') }
  if (files.regular && files.medium && files.semibold && files.mono) {
    doc.registerFontkit(fontkit)
    const [regular, medium, semibold, mono] = await Promise.all([doc.embedFont(files.regular, { subset: true }), doc.embedFont(files.medium, { subset: true }), doc.embedFont(files.semibold, { subset: true }), doc.embedFont(files.mono, { subset: true })])
    return { regular, medium, semibold, mono, embedded: true }
  }
  // Without the TTFs (a stripped deploy) the standard fonts stand in; the layout holds, the face does not.
  const [regular, semibold, mono] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold), doc.embedFont(StandardFonts.Courier)])
  return { regular, medium: regular, semibold, mono, embedded: false }
}

/* ---------- Drawing helpers ---------- */

type Ctx = { page: PDFPage; f: Fonts }

/** Text with pdf-lib's origin at the baseline; `y` here is the baseline measured from the top of the page. */
const text = ({ page }: Ctx, s: string, x: number, yTop: number, font: PDFFont, size: number, color: RGB = INK, o: { tracking?: number; align?: 'left' | 'right' } = {}): number => {
  const clean = s.replace(/\s+/g, ' ')
  const w = font.widthOfTextAtSize(clean, size) + (o.tracking ? o.tracking * clean.length : 0)
  const x0 = o.align === 'right' ? x - w : x
  if (o.tracking) {
    let cx = x0
    for (const ch of clean) {
      page.drawText(ch, { x: cx, y: H - yTop, size, font, color })
      cx += font.widthOfTextAtSize(ch, size) + o.tracking
    }
  } else page.drawText(clean, { x: x0, y: H - yTop, size, font, color })
  return w
}

/** Fits a line to a width by stepping the size down; returns the size used. */
const fitSize = (font: PDFFont, s: string, size: number, max: number, min = 12): number => {
  let sz = size
  while (sz > min && font.widthOfTextAtSize(s, sz) > max) sz -= 1
  return sz
}

/** Wraps words to a width; at most `lines` lines, the last one cut with an ellipsis. */
const wrap = (font: PDFFont, s: string, size: number, max: number, lines = 3): string[] => {
  const words = s.replace(/\s+/g, ' ').trim().split(' ')
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(t, size) <= max || !cur) cur = t
    else {
      out.push(cur)
      cur = w
    }
  }
  if (cur) out.push(cur)
  if (out.length > lines) {
    const kept = out.slice(0, lines)
    let last = kept[lines - 1]!
    while (last && font.widthOfTextAtSize(`${last}…`, size) > max) last = last.slice(0, -1).trimEnd()
    kept[lines - 1] = `${last}…`
    return kept
  }
  return out
}

const rule = ({ page }: Ctx, x1: number, yTop: number, x2: number, color: RGB = LINE, thickness = 1) => page.drawLine({ start: { x: x1, y: H - yTop }, end: { x: x2, y: H - yTop }, thickness, color })

const label = (c: Ctx, s: string, x: number, yTop: number, color: RGB = MUTED, size = 7.5, align: 'left' | 'right' = 'left') => text(c, s.toUpperCase(), x, yTop, c.f.mono, size, color, { tracking: 0.9, align })

/** S2 The Seven: the tab whose right edge runs on the 7's 24.5°, descending left; ink on paper, its words in paper. */
const tab = (c: Ctx, s: string, x: number, yTop: number, h = 22) => {
  const w = c.f.mono.widthOfTextAtSize(s.toUpperCase(), 7.5) + 0.9 * s.length + 28
  const run = h * TAN7
  const top = H - yTop
  c.page.drawSvgPath(`M 0 0 L ${w} 0 L ${w - run} ${h} L 0 ${h} Z`, { x, y: top, color: INK, borderWidth: 0 })
  label(c, s, x + 12, yTop + h / 2 + 2.6, PAPER)
  return w
}

/** The K7 mark from the logo file's own paths: the orange 7 and the ink K and wordmark, scaled to a height. */
const mark = (c: Ctx, x: number, yTop: number, height: number) => {
  if (!existsSync(LOGO)) {
    text(c, 'K7', x, yTop + height * 0.82, c.f.semibold, height, INK)
    return
  }
  const svg = readFileSync(LOGO, 'utf8')
  const vb = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1]?.split(/\s+/).map(Number) ?? [0, 0, 528, 134]
  const scale = height / vb[3]!
  const ox = x - vb[0]! * scale
  const oy = H - yTop + vb[1]! * scale
  for (const m of svg.matchAll(/<path([^>]*?)d="([^"]+)"/g)) {
    c.page.drawSvgPath(m[2]!, { x: ox, y: oy, scale, color: /cls-1/.test(m[1] ?? '') ? BRAND : INK, borderWidth: 0 })
  }
  for (const m of svg.matchAll(/<polygon([^>]*?)points="([^"]+)"/g)) {
    const nums = (m[2]!.match(/-?\d*\.?\d+/g) ?? []).map(Number)
    const pairs: string[] = []
    for (let i = 0; i + 1 < nums.length; i += 2) pairs.push(`${i === 0 ? 'M' : 'L'} ${nums[i]} ${nums[i + 1]}`)
    if (pairs.length < 3) continue
    const d = `${pairs.join(' ')} Z`
    c.page.drawSvgPath(d, { x: ox, y: oy, scale, color: /cls-1/.test(m[1] ?? '') ? BRAND : INK, borderWidth: 0 })
  }
}

/** The QR as squares, nothing else: level M, quiet zone of two modules on paper. */
const qr = (c: Ctx, content: string, x: number, yTop: number, size: number) => {
  const code = QRCode.create(content, { errorCorrectionLevel: 'M' })
  const n = code.modules.size
  const cell = size / n
  const data = code.modules.data
  for (let r = 0; r < n; r++)
    for (let col = 0; col < n; col++)
      if (data[r * n + col]) c.page.drawRectangle({ x: x + col * cell, y: H - yTop - (r + 1) * cell, width: cell + 0.15, height: cell + 0.15, color: INK })
}

const dmy = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`
}

const loadSignature = async (doc: PDFDocument): Promise<{ draw: (page: PDFPage, x: number, yTop: number, maxW: number, maxH: number) => void } | null> => {
  const p = process.env.PARTNER_CERT_SIGNATORY
  if (!p) return null
  const full = path.isAbsolute(p) ? p : path.join(ROOT, p)
  if (!existsSync(full)) return null
  try {
    const bytes = readFileSync(full)
    const img = /\.png$/i.test(full) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
    return {
      draw: (page, x, yTop, maxW, maxH) => {
        const s = Math.min(maxW / img.width, maxH / img.height)
        const w = img.width * s
        const h = img.height * s
        page.drawImage(img, { x, y: H - yTop - h, width: w, height: h })
      },
    }
  } catch {
    return null
  }
}

/* ---------- The sheet ---------- */

export type RenderInput = { certificate: Certificate; verifyUrl: string; settings: CertificateSettings }

export const renderCertificatePdf = async ({ certificate: cert, verifyUrl, settings }: RenderInput): Promise<Uint8Array> => {
  const doc = await PDFDocument.create()
  doc.setTitle(`${cert.number} · ${CERT_KIND_LABEL[cert.kind]} · K7 Partner Programme`)
  doc.setAuthor(settings.issuer)
  doc.setSubject(cert.kind === 'individual' ? `${cert.userName}, ${cert.courseTitle}` : `${cert.orgName}, ${cert.orgPartnerId}`)
  doc.setProducer('K7 partner portal')
  doc.setCreator('K7 partner portal')
  const page = doc.addPage([W, H])
  const f = await loadFonts(doc)
  const c: Ctx = { page, f }
  const signature = cert.kind === 'org' ? await loadSignature(doc) : null

  // The ground and the filed sheet: a hairline frame with the tab rising above its top edge.
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER })
  page.drawRectangle({ x: M, y: M, width: W - 2 * M, height: H - 2 * M, borderColor: LINE, borderWidth: 1 })
  tab(c, `${CERT_KIND_LABEL[cert.kind]} · K7 Partner Programme`, M, M + 1)
  mark(c, W - M - 150, M + 18, 34)

  const left = M + 36
  const right = W - M - 36
  const width = right - left

  if (cert.kind === 'individual') {
    label(c, 'This certifies that', left, 128)
    const nameSize = fitSize(f.semibold, cert.userName, 38, width)
    text(c, cert.userName, left - 1, 128 + nameSize + 10, f.semibold, nameSize)
    const org = `of ${cert.orgTradeName || cert.orgName}${cert.orgPartnerId ? `, partner ${cert.orgPartnerId}` : ''}`
    text(c, org, left, 200, f.regular, 15, MUTED)
    label(c, `has passed the ${cert.trackName || 'training'} course`, left, 246)
    const title = wrap(f.medium, cert.courseTitle, 26, width, 2)
    title.forEach((ln, i) => text(c, ln, left, 246 + 32 + i * 31, f.medium, 26))
    const facts = 246 + 32 + title.length * 31 + 22
    const cols = [
      ['Score', `${cert.score ?? 0}% · ${cert.band || 'Pass'}`],
      ['Passed on', dmy(cert.issuedAt)],
      ['Valid to', dmy(cert.expiresAt)],
      ['Course version', `v${cert.courseVersion || 1}`],
    ]
    cols.forEach(([k, v], i) => {
      const x = left + i * 150
      label(c, k!, x, facts)
      text(c, v!, x, facts + 20, f.mono, 12.5)
    })
    rule(c, left, facts + 34, right)
  } else {
    label(c, 'This certifies that', left, 128)
    const nameSize = fitSize(f.semibold, cert.orgName, 38, width)
    text(c, cert.orgName, left - 1, 128 + nameSize + 10, f.semibold, nameSize)
    const typeLabel = cert.orgType ? PARTNER_TYPE_LABEL[cert.orgType] : 'Partner'
    text(c, `${typeLabel}${cert.orgPartnerId ? ` · Partner ID ${cert.orgPartnerId}` : ''}`, left, 200, f.regular, 15, MUTED)
    label(c, 'is an authorised partner of K7', left, 246)
    const line1 = 'K7 Partner Certificate'
    text(c, line1, left, 246 + 32, f.medium, 26)
    const body = wrap(f.regular, `Having met the programme’s training requirement for its partner type (${cert.ruleLines.length ? cert.ruleLines.map((l) => `${l.have} of ${l.need} certified on ${l.trackName}`).join(', ') : 'as set by K7'}), the organisation is certified to sell, deploy and support K7 CyberSecurity products for the period below.`, 12.5, width - 220, 3)
    body.forEach((ln, i) => text(c, ln, left, 246 + 58 + i * 18, f.regular, 12.5, MUTED))
    const facts = 246 + 58 + body.length * 18 + 18
    const cols = [
      ['Issued on', dmy(cert.issuedAt)],
      ['Valid to', dmy(cert.expiresAt)],
      ['Partner type', typeLabel],
      ['Issued by', settings.issuer],
    ]
    const xs = [0, 150, 300, 500]
    cols.forEach(([k, v], i) => {
      const x = left + xs[i]!
      label(c, k!, x, facts)
      text(c, v!, x, facts + 20, i >= 2 ? f.regular : f.mono, i >= 2 ? 12.5 : 12.5)
    })
    rule(c, left, facts + 34, right)
  }

  // The foot: the number with the pixel and the QR on the left, the signatory on the right.
  const footTop = H - M - 118
  qr(c, verifyUrl, left, footTop, 84)
  label(c, 'Certificate number', left + 100, footTop + 8)
  const numSize = 20
  const nw = text(c, cert.number, left + 100, footTop + 8 + 26, f.mono, numSize)
  page.drawRectangle({ x: left + 100 + nw + 10, y: H - (footTop + 8 + 26) + 2, width: 8, height: 8, color: SIGNAL })
  label(c, 'Verify at', left + 100, footTop + 58)
  const url = verifyUrl.replace(/^https?:\/\//, '')
  text(c, url, left + 100, footTop + 72, f.mono, fitSize(f.mono, url, 9.5, 300, 7), MUTED)

  const sigRight = right
  const sigLeft = right - 220
  if (cert.kind === 'org') {
    if (signature) signature.draw(page, sigLeft, footTop - 2, 220, 48)
    rule(c, sigLeft, footTop + 52, sigRight, INK)
    text(c, settings.signatoryName || settings.issuer, sigLeft, footTop + 68, f.medium, 11.5)
    text(c, settings.signatoryName ? settings.signatoryTitle : 'Authorised signatory', sigLeft, footTop + 82, f.regular, 9.5, MUTED)
  } else {
    rule(c, sigLeft, footTop + 52, sigRight, INK)
    text(c, 'K7 Partner Programme', sigLeft, footTop + 68, f.medium, 11.5)
    text(c, settings.issuer, sigLeft, footTop + 82, f.regular, 9.5, MUTED)
  }

  label(c, `${settings.issuer} · Chennai, India · k7computing.com/partners`, left, H - M - 14)

  return doc.save()
}
