/* HTML (WordPress) → Payload Lexical JSON. Block-level walk with jsdom; images become upload nodes through `resolveImage`. */
import { JSDOM } from 'jsdom'
import { randomBytes } from 'node:crypto'

export type LexNode = Record<string, unknown>
export type ImageResolver = (src: string, alt: string) => Promise<number | null>

const hex24 = () => randomBytes(12).toString('hex')
const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'TABLE', 'FIGURE', 'HR', 'IMG', 'SECTION', 'ARTICLE', 'CENTER', 'DL'])

export const stats = { tables: 0, images: 0, code: 0, embeds: 0, imageFailures: [] as string[] }

/* ---------- WordPress preprocessing ---------- */
export const preprocess = (html: string): { html: string; embeds: number } => {
  let embeds = 0
  let s = html.replace(/\r\n/g, '\n')
  // wp:embed → a link paragraph
  s = s.replace(/<!-- wp:embed (\{[\s\S]*?\}) -->[\s\S]*?<!-- \/wp:embed -->/g, (_m, json) => {
    try {
      const url = JSON.parse(json).url as string
      embeds++
      return `<p><a href="${url}">${url}</a></p>`
    } catch {
      return ''
    }
  })
  s = s.replace(/<!-- wp:core-embed\/[a-z]+ (\{[\s\S]*?\}) -->[\s\S]*?<!-- \/wp:core-embed\/[a-z]+ -->/g, (_m, json) => {
    try {
      const url = JSON.parse(json).url as string
      embeds++
      return `<p><a href="${url}">${url}</a></p>`
    } catch {
      return ''
    }
  })
  s = s.replace(/<!-- wp:spacer[\s\S]*?<!-- \/wp:spacer -->/g, '')
  const isBlock = /<!-- wp:/.test(s)
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // [caption]<img>text[/caption] → figure
  s = s.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/g, (_m, inner: string) => {
    const img = inner.match(/<a[^>]*>\s*<img[^>]*>\s*<\/a>|<img[^>]*>/i)?.[0] ?? ''
    const cap = inner.replace(/<a[^>]*>\s*<img[^>]*>\s*<\/a>|<img[^>]*>/i, '').trim()
    return `<figure>${img}<figcaption>${cap}</figcaption></figure>`
  })
  s = s.replace(/\[gallery[^\]]*\]/g, '')
  if (!isBlock && !/<p[\s>]/i.test(s)) s = wpautop(s)
  return { html: s, embeds }
}

/* The part of WordPress's wpautop these bodies depend on: blank lines become paragraphs, block tags are left alone. */
const wpautop = (s: string): string => {
  const chunks = s.split(/\n{2,}/)
  return chunks
    .map((c) => {
      const t = c.trim()
      if (!t) return ''
      if (/^<(figure|table|pre|ul|ol|h[1-6]|blockquote|div|hr|img|center|dl)[\s>]/i.test(t) || /^<\/(div|center)>/i.test(t)) return t
      if (/^<a[^>]*>\s*<img/i.test(t) || /^<img/i.test(t)) return t
      return `<p>${t.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')
}

/* ---------- Lexical node factories ---------- */
const text = (t: string, format = 0): LexNode => ({ type: 'text', text: t, format, style: '', mode: 'normal', detail: 0, version: 1 })
const para = (children: LexNode[]): LexNode => ({ type: 'paragraph', children, direction: 'ltr', format: '', indent: 0, version: 1, textFormat: 0, textStyle: '' })
const heading = (tag: string, children: LexNode[]): LexNode => ({ type: 'heading', tag, children, direction: 'ltr', format: '', indent: 0, version: 1 })
const quote = (children: LexNode[]): LexNode => ({ type: 'quote', children, direction: 'ltr', format: '', indent: 0, version: 1 })
const linebreak = (): LexNode => ({ type: 'linebreak', version: 1 })
const hr = (): LexNode => ({ type: 'horizontalrule', version: 1 })
const validUrl = (u: string) => {
  if (u.startsWith('/') || u.startsWith('#') || u.startsWith('mailto:')) return true
  try {
    const p = new URL(u)
    return /^https?:$/.test(p.protocol) && p.hostname.includes('.')
  } catch {
    return false
  }
}
/* Payload validates link URLs; a malformed href (the source has a few) keeps its text and loses the link. */
const link = (url: string, children: LexNode[]): LexNode =>
  validUrl(url) ? { type: 'link', fields: { linkType: 'custom', url, newTab: true }, children, direction: 'ltr', format: '', indent: 0, version: 3 } : { type: 'text', text: children.map((c) => (c.text as string) || '').join(''), format: 0, style: '', mode: 'normal', detail: 0, version: 1 }
const upload = (id: number): LexNode => ({ type: 'upload', relationTo: 'media', value: id, fields: null, format: '', version: 3, id: hex24() })
const codeBlock = (code: string, language = 'text'): LexNode => ({ type: 'block', format: '', version: 2, fields: { id: hex24(), blockName: '', blockType: 'code', code, language } })
const list = (ordered: boolean, items: LexNode[]): LexNode => ({ type: 'list', listType: ordered ? 'number' : 'bullet', start: 1, tag: ordered ? 'ol' : 'ul', children: items, direction: 'ltr', format: '', indent: 0, version: 1 })
const listItem = (value: number, children: LexNode[]): LexNode => ({ type: 'listitem', value, children, direction: 'ltr', format: '', indent: 0, version: 1 })
const table = (rows: LexNode[]): LexNode => ({ type: 'table', children: rows, direction: null, format: '', indent: 0, version: 1 })
const tableRow = (cells: LexNode[]): LexNode => ({ type: 'tablerow', children: cells, direction: null, format: '', indent: 0, version: 1 })
const tableCell = (header: boolean, children: LexNode[], colSpan = 1, rowSpan = 1): LexNode => ({ type: 'tablecell', children, headerState: header ? 1 : 0, colSpan, rowSpan, backgroundColor: null, direction: null, format: '', indent: 0, version: 1 })

const FORMAT: Record<string, number> = { B: 1, STRONG: 1, I: 2, EM: 2, S: 4, STRIKE: 4, DEL: 4, U: 8, CODE: 16, KBD: 16 }
const norm = (s: string) => s.replace(/ /g, ' ')

const isEmptyInline = (nodes: LexNode[]) => nodes.every((n) => (n.type === 'text' && !(n.text as string).trim()) || n.type === 'linebreak')
const trimInline = (nodes: LexNode[]): LexNode[] => {
  // merge adjacent texts of equal format, strip leading/trailing breaks and whitespace-only texts
  const out: LexNode[] = []
  for (const n of nodes) {
    const last = out[out.length - 1]
    if (n.type === 'text' && last?.type === 'text' && last.format === n.format) last.text = (last.text as string) + (n.text as string)
    else out.push({ ...n })
  }
  while (out.length && (out[0]!.type === 'linebreak' || (out[0]!.type === 'text' && !(out[0]!.text as string).trim()))) out.shift()
  while (out.length && (out[out.length - 1]!.type === 'linebreak' || (out[out.length - 1]!.type === 'text' && !(out[out.length - 1]!.text as string).trim()))) out.pop()
  if (out[0]?.type === 'text') out[0].text = (out[0].text as string).replace(/^\s+/, '')
  const l = out[out.length - 1]
  if (l?.type === 'text') l.text = (l.text as string).replace(/\s+$/, '')
  return out.map((n) => (n.type === 'text' ? { ...n, text: (n.text as string).replace(/\s+/g, ' ') } : n))
}

export const htmlToLexical = async (rawHtml: string, resolveImage: ImageResolver): Promise<{ root: LexNode; embeds: number; counts: { tables: number; images: number; code: number } }> => {
  const { html, embeds } = preprocess(rawHtml)
  const dom = new JSDOM(`<body>${html}</body>`)
  const body = dom.window.document.body
  const counts = { tables: 0, images: 0, code: 0 }
  const blocks: LexNode[] = []

  const imageNode = async (img: Element, captionText?: string): Promise<LexNode> => {
    let src = img.getAttribute('src') || img.getAttribute('data-src') || ''
    src = src.replace(/^http:\/\/172\.104\.56\.202\//, 'https://labs.k7computing.com/')
    const alt = (captionText || img.getAttribute('alt') || img.getAttribute('title') || '').trim()
    const id = src ? await resolveImage(src, alt) : null
    counts.images++
    if (id) return upload(id)
    return para([link(src, [text(alt || src)])])
  }

  /* Inline conversion: returns inline nodes; block-level things found inside (images, tables) are pushed to `extra`. */
  const inlines = async (node: Node, format: number, extra: LexNode[]): Promise<LexNode[]> => {
    const out: LexNode[] = []
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const t = norm(child.textContent || '')
        if (t) out.push(text(t, format))
        continue
      }
      if (child.nodeType !== 1) continue
      const el = child as Element
      const tag = el.tagName
      if (tag === 'BR') {
        out.push(linebreak())
      } else if (tag === 'IMG') {
        extra.push(await imageNode(el))
      } else if (tag === 'A' && el.querySelector('img') && !el.textContent?.trim()) {
        extra.push(await imageNode(el.querySelector('img')!))
      } else if (tag === 'A') {
        const href = (el.getAttribute('href') || '').trim()
        const kids = trimInline(await inlines(el, format, extra))
        if (!kids.length) continue
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) out.push(link(href, kids))
        else out.push(...kids)
      } else if (tag === 'PRE' || tag === 'TABLE' || tag === 'FIGURE' || tag === 'UL' || tag === 'OL' || tag === 'BLOCKQUOTE' || /^H[1-6]$/.test(tag)) {
        extra.push(...(await blockOf(el)))
      } else if (tag === 'P' || tag === 'DIV') {
        // a block inside an inline context: break the paragraph
        const inner = trimInline(await inlines(el, format, extra))
        if (inner.length) {
          if (out.length) out.push(linebreak())
          out.push(...inner)
        }
      } else if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME') {
        continue
      } else {
        const f = format | (FORMAT[tag] ?? 0)
        out.push(...(await inlines(el, f, extra)))
      }
    }
    return out
  }

  const paragraphFrom = async (el: Node): Promise<LexNode[]> => {
    const extra: LexNode[] = []
    const kids = trimInline(await inlines(el, 0, extra))
    const res: LexNode[] = []
    if (kids.length && !isEmptyInline(kids)) res.push(para(kids))
    res.push(...extra)
    return res
  }

  const listOf = async (el: Element): Promise<LexNode> => {
    const items: LexNode[] = []
    let i = 1
    for (const li of Array.from(el.children)) {
      if (li.tagName !== 'LI') continue
      const nested = Array.from(li.children).filter((c) => c.tagName === 'UL' || c.tagName === 'OL')
      const clone = li.cloneNode(true) as Element
      clone.querySelectorAll(':scope > ul, :scope > ol').forEach((n) => n.remove())
      const extra: LexNode[] = []
      const kids = trimInline(await inlines(clone, 0, extra))
      items.push(listItem(i++, kids.length ? kids : [text('')]))
      for (const n of nested) items.push(listItem(i++, [await listOf(n)]))
      if (extra.length) blocks.push(...extra)
    }
    return list(el.tagName === 'OL', items.length ? items : [listItem(1, [text('')])])
  }

  const tableOf = async (el: Element): Promise<LexNode> => {
    const rows: LexNode[] = []
    for (const tr of Array.from(el.querySelectorAll(':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr'))) {
      const cells: LexNode[] = []
      for (const td of Array.from(tr.children)) {
        if (td.tagName !== 'TD' && td.tagName !== 'TH') continue
        const extra: LexNode[] = []
        const kids = trimInline(await inlines(td, 0, extra))
        const children = [para(kids.length ? kids : [text('')]), ...extra]
        cells.push(tableCell(td.tagName === 'TH' || tr.parentElement?.tagName === 'THEAD', children, Number(td.getAttribute('colspan') || 1), Number(td.getAttribute('rowspan') || 1)))
      }
      if (cells.length) rows.push(tableRow(cells))
    }
    counts.tables++
    return table(rows.length ? rows : [tableRow([tableCell(false, [para([text('')])])])])
  }

  const blockOf = async (el: Element): Promise<LexNode[]> => {
    const tag = el.tagName
    if (/^H[1-6]$/.test(tag)) {
      const n = Math.min(Math.max(Number(tag[1]), 2), 4)
      const extra: LexNode[] = []
      const kids = trimInline(await inlines(el, 0, extra))
      return [...(kids.length ? [heading(`h${n}`, kids)] : []), ...extra]
    }
    if (tag === 'UL' || tag === 'OL') return [await listOf(el)]
    if (tag === 'PRE') {
      counts.code++
      return [codeBlock(norm(el.textContent || '').replace(/\s+$/, ''))]
    }
    if (tag === 'TABLE') return [await tableOf(el)]
    if (tag === 'HR') return [hr()]
    if (tag === 'IMG') return [await imageNode(el)]
    if (tag === 'BLOCKQUOTE') {
      const extra: LexNode[] = []
      const kids = trimInline(await inlines(el, 0, extra))
      return [...(kids.length ? [quote(kids)] : []), ...extra]
    }
    if (tag === 'FIGURE') {
      const img = el.querySelector('img')
      const tbl = el.querySelector('table')
      const cap = el.querySelector('figcaption')?.textContent?.trim()
      if (img && !tbl) return [await imageNode(img, cap)]
      if (tbl) return [await tableOf(tbl)]
      return paragraphFrom(el)
    }
    if (tag === 'A' && el.querySelector('img')) return [await imageNode(el.querySelector('img')!, undefined)]
    if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'CENTER' || tag === 'DL') {
      // a container: if it holds block children, recurse; else it is a paragraph
      const hasBlocks = Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName))
      if (hasBlocks) {
        const out: LexNode[] = []
        for (const c of Array.from(el.childNodes)) out.push(...(await topLevel(c)))
        return out
      }
      return paragraphFrom(el)
    }
    return paragraphFrom(el)
  }

  const topLevel = async (node: Node): Promise<LexNode[]> => {
    if (node.nodeType === 3) {
      const t = norm(node.textContent || '').trim()
      return t ? [para([text(t)])] : []
    }
    if (node.nodeType !== 1) return []
    const el = node as Element
    if (el.tagName === 'BR' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return []
    return blockOf(el)
  }

  // Inline runs at the top level (classic bodies) must be grouped into paragraphs.
  let run: Node[] = []
  const flushRun = async () => {
    if (!run.length) return
    const wrapper = dom.window.document.createElement('p')
    run.forEach((n) => wrapper.appendChild(n.cloneNode(true)))
    blocks.push(...(await paragraphFrom(wrapper)))
    run = []
  }
  for (const child of Array.from(body.childNodes)) {
    const isBlockEl = child.nodeType === 1 && BLOCK_TAGS.has((child as Element).tagName)
    const isImgLink = child.nodeType === 1 && (child as Element).tagName === 'A' && (child as Element).querySelector('img')
    if (isBlockEl || isImgLink) {
      await flushRun()
      blocks.push(...(await topLevel(child)))
    } else {
      run.push(child)
    }
  }
  await flushRun()

  const children = blocks.length ? blocks : [para([text('')])]
  return { root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 }, embeds, counts }
}

/** Counts in the source HTML, for the migration report. */
export const sourceCounts = (html: string) => ({
  tables: (html.match(/<table[\s>]/gi) || []).length,
  images: (html.match(/<img[\s>]/gi) || []).length,
  code: (html.match(/<pre[\s>]/gi) || []).length,
})

/** Lexical node counts, for the migration report. */
export const lexicalCounts = (root: LexNode) => {
  const c = { tables: 0, images: 0, code: 0 }
  const walk = (n: LexNode) => {
    if (n.type === 'table') c.tables++
    if (n.type === 'upload') c.images++
    if (n.type === 'block') c.code++
    ;(n.children as LexNode[] | undefined)?.forEach(walk)
  }
  walk(root)
  return c
}

export const stripHtml = (html: string): string =>
  norm(
    new JSDOM(`<body>${html.replace(/\r\n/g, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')}</body>`).window.document.body.textContent || '',
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
