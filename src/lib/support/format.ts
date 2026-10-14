export { agoLabel, byline, bytes, daysAgo, dmy, initials, iso } from '@/lib/research/format'

const pad = (n: number) => String(n).padStart(2, '0')

/** DD-MM-YYYY HH:MM in India time (the support desk's clock). */
export const dmyHm = (d?: string | Date | null): string => {
  if (!d) return ''
  const x = new Date(d)
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(x)
  const g = (t: string) => p.find((q) => q.type === t)?.value ?? ''
  return `${g('day')}-${g('month')}-${g('year')} ${g('hour')}:${g('minute')}`
}

/** "2 h ago", "3 d ago", else DD-MM-YYYY. */
export const relative = (d?: string | Date | null): string => {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.round(ms / 6e4)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const days = Math.round(h / 24)
  if (days < 14) return `${days} d ago`
  const x = new Date(d)
  return `${pad(x.getDate())}-${pad(x.getMonth() + 1)}-${x.getFullYear()}`
}

/** Case numbers read CS-431548-V1T5: the prefix is dim, the unique part reads first (L1). */
export const splitTicket = (ticket: string): { pre: string; id: string } => {
  const m = ticket.match(/^([A-Z]+-)(.*)$/)
  return m ? { pre: m[1]!, id: m[2]! } : { pre: '', id: ticket }
}

/** Dataverse rich text (CKEditor HTML) to plain text for previews. */
export const htmlToText = (html?: string | null): string =>
  (html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d)>/gi, '\n\n')
    .replace(/<\/(li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

/** Minimal HTML sanitiser for note and email bodies: keeps text formatting, drops scripts, styles, event handlers and remote images. */
export const sanitizeHtml = (html?: string | null): string => {
  if (!html) return ''
  let out = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|meta|link|head|title)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|meta|link)[^>]*\/?>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\s(style|class|id)="[^"]*"/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<img[^>]*>/gi, '')
  // Allow a known set of tags only.
  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (m, tag: string, attrs: string) => {
    const t = tag.toLowerCase()
    const allowed = ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'hr']
    if (!allowed.includes(t)) return ''
    if (t === 'a') {
      const href = attrs.match(/href="([^"]*)"/i)?.[1] ?? ''
      return m.startsWith('</') ? '</a>' : `<a href="${/^https?:\/\//i.test(href) ? href.replace(/"/g, '') : '#'}" rel="noopener nofollow" target="_blank">`
    }
    return m.startsWith('</') ? `</${t}>` : `<${t}>`
  })
  return out
}
