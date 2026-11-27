/* The body of an email an agent sends from the case sheet (Email the customer). Testers asked for font, size and colour and for
   links that read as links (2026-10-29); the composer (EmailComposer.client.tsx) writes simple HTML with the browser's editing
   commands, and this module is the one gate it passes before Dynamics stores and sends it: an allowlist of tags and of style
   values, links only to http(s) and mailto, every bare web or email address turned into a link, and the house font around it.
   Pure, so the client can share the choices and the tests can run without a tenant. */

/** Font faces the composer offers, with the stack each one is sent as. */
export const EMAIL_FONTS: { face: string; label: string; stack: string }[] = [
  { face: 'Arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { face: 'Calibri', label: 'Calibri', stack: 'Calibri, Arial, sans-serif' },
  { face: 'Verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { face: 'Georgia', label: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
  { face: 'Courier New', label: 'Courier New', stack: "'Courier New', Courier, monospace" },
]

/** The browser's font sizes 1–7 (execCommand fontSize) as pixels; the composer offers 2–5. */
export const EMAIL_SIZE_PX: Record<string, number> = { '1': 11, '2': 12, '3': 14, '4': 18, '5': 22, '6': 28, '7': 34 }
export const EMAIL_SIZES: { value: string; label: string }[] = [
  { value: '2', label: 'Small' },
  { value: '3', label: 'Normal' },
  { value: '4', label: 'Large' },
  { value: '5', label: 'Larger' },
]

/** Text colours the composer offers. Mail is read on white, so the set is chosen for that, not for the portal's themes. */
export const EMAIL_COLOURS: { value: string; label: string }[] = [
  { value: '#1a1a1a', label: 'Black' },
  { value: '#c00000', label: 'Red' },
  { value: '#c55a11', label: 'Orange' },
  { value: '#2e7d32', label: 'Green' },
  { value: '#0563c1', label: 'Blue' },
  { value: '#6b6b6b', label: 'Grey' },
]

/** Outlook's own hyperlink blue: links read as links in every mail client, whatever colour the text around them has. */
export const LINK_STYLE = 'color:#0563c1;text-decoration:underline'
export const BODY_STYLE = 'font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a'

/** The longest body accepted, in characters of HTML. */
export const EMAIL_HTML_MAX = 200_000

const BLOCK = new Set(['p', 'div', 'blockquote', 'ul', 'ol', 'li'])
const INLINE = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span', 'font', 'a'])
const VOID = new Set(['br'])
/** Elements whose content is code or chrome, never text: dropped with everything inside. */
const DROP_WITH_CONTENT = new Set(['script', 'style', 'template', 'iframe', 'object', 'embed', 'noscript', 'textarea', 'title', 'head', 'svg', 'math', 'select', 'option', 'xml'])

const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]+);/gi, (m, e: string) => {
    const k = e.toLowerCase()
    if (k.startsWith('#x')) return safeCodePoint(parseInt(k.slice(2), 16), m)
    if (k.startsWith('#')) return safeCodePoint(parseInt(k.slice(1), 10), m)
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } as Record<string, string>)[k] ?? m
  })
const safeCodePoint = (n: number, fallback: string): string => {
  try {
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : fallback
  } catch {
    return fallback
  }
}
const escAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Text as it arrives from innerHTML is already escaped; this keeps valid entities and escapes anything stray. */
const escText = (s: string): string => s.replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#[0-9]{1,7}|#x[0-9a-fA-F]{1,6});)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A link target the email may carry: http(s) or mailto, nothing else. Returns the cleaned URL or null. */
export const safeHref = (raw: string): string | null => {
  // Browsers ignore tabs, newlines and other controls inside a URL, so "java\nscript:" must be judged without them.
  const v = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]+/g, '')
  if (/^mailto:/i.test(v)) return /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(v) ? v : null
  if (!/^https?:\/\//i.test(v)) return null
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

const hexColour = (v: string): string | null => {
  const s = v.trim().toLowerCase()
  const h = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (h) return h[1]!.length === 3 ? `#${[...h[1]!].map((c) => c + c).join('')}` : s
  const r = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(?:1|1\.0+|0?\.\d+|0)\s*)?\)$/)
  if (r) {
    const n = [r[1], r[2], r[3]].map((x) => Number(x))
    if (n.some((x) => x > 255)) return null
    return `#${n.map((x) => x.toString(16).padStart(2, '0')).join('')}`
  }
  return null
}

const KEYWORD_PX: Record<string, number> = { 'x-small': 11, small: 12, medium: 14, large: 18, 'x-large': 22, 'xx-large': 28, 'xxx-large': 34 }

const fontStack = (family: string): string | null => {
  const first = family.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
  return EMAIL_FONTS.find((f) => f.face.toLowerCase() === first)?.stack ?? null
}

/** Keeps the style declarations the composer can make, each re-written from a checked value; drops everything else. */
export const safeStyle = (style: string): string => {
  const out: string[] = []
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const prop = decl.slice(0, i).trim().toLowerCase()
    const value = decodeEntities(decl.slice(i + 1)).trim().replace(/\s*!important$/i, '')
    if (/[\\<>]|url\(|expression|\/\*/i.test(value)) continue
    if (prop === 'color') {
      const c = hexColour(value)
      if (c) out.push(`color:${c}`)
    } else if (prop === 'font-size') {
      const px = value.match(/^(\d{1,2}(?:\.\d+)?)px$/)
      const n = px ? Math.round(Number(px[1])) : KEYWORD_PX[value.toLowerCase()]
      if (n && n >= 9 && n <= 40) out.push(`font-size:${n}px`)
    } else if (prop === 'font-family') {
      const s = fontStack(value)
      if (s) out.push(`font-family:${s}`)
    } else if (prop === 'font-weight') {
      if (/^(bold|bolder|[6-9]00)$/i.test(value)) out.push('font-weight:bold')
    } else if (prop === 'font-style') {
      if (/^italic$/i.test(value)) out.push('font-style:italic')
    } else if (prop === 'text-decoration' || prop === 'text-decoration-line') {
      const parts = value.toLowerCase().split(/\s+/).filter((p) => p === 'underline' || p === 'line-through')
      if (parts.length) out.push(`text-decoration:${[...new Set(parts)].join(' ')}`)
    }
  }
  return out.join(';')
}

const ATTR_RE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
const parseAttrs = (s: string): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const m of s.matchAll(ATTR_RE)) out[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
  return out
}

/** The opening tag the email carries for an allowed element, or '' when the element adds nothing (its text is kept). */
const openTag = (tag: string, attrs: Record<string, string>): string => {
  if (tag === 'a') {
    const href = safeHref(attrs.href ?? '')
    return href ? `<a href="${escAttr(href)}" style="${LINK_STYLE}">` : ''
  }
  if (tag === 'font') {
    const styles: string[] = []
    const c = attrs.color ? hexColour(attrs.color) : null
    if (c) styles.push(`color:${c}`)
    const px = attrs.size ? EMAIL_SIZE_PX[attrs.size.trim()] : undefined
    if (px) styles.push(`font-size:${px}px`)
    const f = attrs.face ? fontStack(attrs.face) : null
    if (f) styles.push(`font-family:${f}`)
    const fromStyle = attrs.style ? safeStyle(attrs.style) : ''
    const all = [...styles, ...(fromStyle ? [fromStyle] : [])].join(';')
    return all ? `<span style="${escAttr(all)}">` : ''
  }
  if (tag === 'strike') return '<s>'
  if (tag === 'span' || tag === 'p' || tag === 'div' || tag === 'li') {
    const st = attrs.style ? safeStyle(attrs.style) : ''
    if (tag === 'span') return st ? `<span style="${escAttr(st)}">` : ''
    return st ? `<${tag} style="${escAttr(st)}">` : `<${tag}>`
  }
  return `<${tag}>`
}
const closeTag = (open: string): string => {
  const t = open.match(/^<([a-z]+)/)?.[1]
  return t ? `</${t}>` : ''
}

const URL_RE = /\b(?:https?:\/\/|www\.)(?:(?!&nbsp;|&#160;|&lt;|&gt;|&quot;)[^\s<>"])+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

/** Bare web and email addresses in a run of escaped text become links. Trailing punctuation stays outside the link. */
export const linkify = (escaped: string): string =>
  escaped.replace(URL_RE, (m) => {
    let url = m
    let tail = ''
    while (/[.,;:!?'\])}]$/.test(url) || /&amp;$/.test(url)) {
      if (url.endsWith(')') && (url.match(/\(/g)?.length ?? 0) >= (url.match(/\)/g)?.length ?? 0)) break
      const cut = url.endsWith('&amp;') ? 5 : 1
      tail = url.slice(-cut) + tail
      url = url.slice(0, -cut)
    }
    if (!url) return m
    const raw = decodeEntities(url)
    const href = /@/.test(raw) && !/^(https?:\/\/|www\.)/i.test(raw) ? safeHref(`mailto:${raw}`) : safeHref(/^www\./i.test(raw) ? `https://${raw}` : raw)
    return href ? `<a href="${escAttr(href)}" style="${LINK_STYLE}">${url}</a>${tail}` : m
  })

/**
 * The composer's HTML made safe to send: allowed tags only, every tag balanced, styles re-written from checked values, links only
 * to http(s) and mailto, bare addresses linked. Text outside any allowed tag is kept; comments, scripts and their content are not.
 */
export const cleanEmailHtml = (input: string): string => {
  const html = input.slice(0, EMAIL_HTML_MAX)
  let out = ''
  const stack: { tag: string; out: string }[] = []
  const inLink = () => stack.some((s) => s.tag === 'a' && s.out)
  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    const textEnd = lt < 0 ? html.length : lt
    if (textEnd > i) {
      const t = escText(html.slice(i, textEnd))
      out += inLink() ? t : linkify(t)
      i = textEnd
      continue
    }
    // At a '<'.
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4)
      i = end < 0 ? html.length : end + 3
      continue
    }
    const m = html.slice(i).match(/^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/)
    if (!m) {
      // A '<' that opens no tag (a declaration, a stray sign): kept as text.
      if (/^<[!?]/.test(html.slice(i))) {
        const end = html.indexOf('>', i)
        i = end < 0 ? html.length : end + 1
      } else {
        out += '&lt;'
        i += 1
      }
      continue
    }
    i += m[0].length
    const closing = m[1] === '/'
    const tag = m[2]!.toLowerCase()
    if (DROP_WITH_CONTENT.has(tag)) {
      if (!closing && !/\/>$/.test(m[0])) {
        const end = html.toLowerCase().indexOf(`</${tag}`, i)
        if (end < 0) i = html.length
        else {
          const gt = html.indexOf('>', end)
          i = gt < 0 ? html.length : gt + 1
        }
      }
      continue
    }
    if (VOID.has(tag)) {
      if (!closing) out += '<br>'
      continue
    }
    if (!BLOCK.has(tag) && !INLINE.has(tag)) continue
    if (closing) {
      const at = stack.map((s) => s.tag).lastIndexOf(tag)
      if (at < 0) continue
      while (stack.length > at) out += closeTag(stack.pop()!.out)
      continue
    }
    // A link inside a link is not a link: its text stays, its tag does not.
    const open = tag === 'a' && inLink() ? '' : openTag(tag, parseAttrs(m[3] ?? ''))
    stack.push({ tag, out: open })
    out += open
    if (stack.length > 64) {
      // Absurd nesting is not something the composer makes; flatten it.
      while (stack.length) out += closeTag(stack.pop()!.out)
    }
  }
  while (stack.length) out += closeTag(stack.pop()!.out)
  return out
}

/** Plain text (the composer without JavaScript) as paragraphs, with addresses linked. */
export const textToEmailHtml = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${linkify(escText(p)).replace(/\n/g, '<br>')}</p>`)
    .join('')

/** The house font and size around the body, so an unformatted email reads the same in every client. */
export const wrapEmail = (inner: string): string => `<div style="${BODY_STYLE}">${inner}</div>`

/** True when the body has words in it, not only tags, breaks and spaces. */
export const hasText = (html: string): boolean =>
  decodeEntities(html.replace(/<[^>]*>/g, ''))
    .replace(/[\s ]+/g, '')
    .length > 1

/** True for a colour too light to read on the white an email is read on: white text whose coloured cell the composer drops. */
export const isLightColour = (v: string): boolean => {
  const c = v.trim().toLowerCase()
  if (c === 'white') return true
  let r: number, g: number, b: number
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  const rgb = c.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/)
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.replace(/./g, (x) => x + x) : hex[1]!
    r = parseInt(h.slice(0, 2), 16)
    g = parseInt(h.slice(2, 4), 16)
    b = parseInt(h.slice(4, 6), 16)
  } else if (rgb) {
    r = Number(rgb[1])
    g = Number(rgb[2])
    b = Number(rgb[3])
  } else return false
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.85
}

/** Text colours a template set for a coloured background the composer will not keep: dropped, so the words stay readable. */
const withoutLightText = (html: string): string =>
  html
    .replace(/(style\s*=\s*")([^"]*)(")/gi, (_m, a: string, css: string, z: string) => a + css.replace(/(^|;)\s*color\s*:\s*([^;]+)/gi, (d, sep: string, v: string) => (isLightColour(v) ? sep : d)) + z)
    .replace(/(<font\b[^>]*?)\scolor\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (m, tag: string, v: string) => (isLightColour(v.replace(/^["']|["']$/g, '')) ? tag : m))

/**
 * A Dynamics email template's body, filled for a case (InstantiateTemplate), as the composer can hold it (TR-25): the head and
 * its styles go, a table becomes its rows as lines (cells side by side), images go, and what is left passes the same allowlist as
 * the agent's own formatting. `left` names what could not come along, for the line under the template picker.
 */
export const templateToComposer = (input: string): { html: string; left: string[] } => {
  const raw = input.slice(0, EMAIL_HTML_MAX)
  const left: string[] = []
  if (/<table\b/i.test(raw)) left.push('tables')
  if (/<img\b/i.test(raw)) left.push('images')
  const prepared = withoutLightText(raw)
    .replace(/<head\b[\s\S]*?<\/head>/gi, '')
    .replace(/<\/t[dh]>\s*(?=<t[dh]\b)/gi, ' ')
    .replace(/<\/tr>/gi, '<br>')
    .replace(/<\/?(?:table|tbody|thead|tfoot|tr|td|th|html|body)\b[^>]*>/gi, '')
  const html = cleanEmailHtml(prepared)
    // Trailing and doubled breaks a table leaves behind.
    .replace(/(?:<br>\s*){3,}/g, '<br><br>')
    .replace(/^(?:\s*<br>)+|(?:<br>\s*)+$/g, '')
    .trim()
  return { html, left }
}
