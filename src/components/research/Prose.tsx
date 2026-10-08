import { type DefaultNodeTypes, type SerializedBlockNode, type SerializedUploadNode } from '@payloadcms/richtext-lexical'
import { type JSXConvertersFunction, RichText } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import type { CodeBlock, BannerBlock as BannerBlockProps, Media } from '@/payload-types'

import { Code } from '@/blocks/Code/Component.client'

type Nodes = DefaultNodeTypes | SerializedBlockNode<CodeBlock | BannerBlockProps>

/** Heading ids and texts for the table of contents. */
export const headingsOf = (content: unknown): { id: string; text: string }[] => {
  const out: { id: string; text: string }[] = []
  const seen = new Set<string>()
  const textOf = (n: { children?: unknown[]; text?: string }): string => (n.text ?? '') + (n.children ?? []).map((c) => textOf(c as never)).join('')
  const root = (content as { root?: { children?: { type?: string; tag?: string; children?: unknown[] }[] } })?.root
  for (const n of root?.children ?? []) {
    if (n.type === 'heading' && n.tag === 'h2') {
      const text = textOf(n as never).trim()
      let id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60)
      if (!id) continue
      while (seen.has(id)) id += '-1'
      seen.add(id)
      out.push({ id, text })
    }
  }
  return out
}

/* Text nodes render by format only; inline colours and fonts pasted into WordPress are dropped so the body reads in ink. */
const IS = { bold: 1, italic: 2, strike: 4, underline: 8, code: 16, sub: 32, sup: 64 }
const textNode = ({ node }: { node: { text: string; format?: number } }) => {
  const f = node.format ?? 0
  let el: React.ReactNode = node.text
  if (f & IS.code) el = <code>{el}</code>
  if (f & IS.bold) el = <strong>{el}</strong>
  if (f & IS.italic) el = <em>{el}</em>
  if (f & IS.underline) el = <u>{el}</u>
  if (f & IS.strike) el = <s>{el}</s>
  if (f & IS.sub) el = <sub>{el}</sub>
  if (f & IS.sup) el = <sup>{el}</sup>
  return <>{el}</>
}

const converters: JSXConvertersFunction<Nodes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  text: textNode as never,
  heading: ({ node, nodesToJSX }) => {
    const Tag = node.tag as 'h2' | 'h3' | 'h4'
    const text = nodesToJSX({ nodes: node.children })
    const plain = node.children.map((c) => ('text' in c ? (c as { text: string }).text : '')).join('')
    const id = Tag === 'h2' ? plain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) : undefined
    return <Tag id={id}>{text}</Tag>
  },
  upload: ({ node }) => {
    const n = node as SerializedUploadNode
    const m = n.value as Media | number
    if (typeof m !== 'object' || !m?.url) return null
    const src = m.sizes?.large?.url ?? m.url
    return (
      <figure className="fig">
        <img src={src} alt={m.alt ?? ''} width={m.width ?? undefined} height={m.height ?? undefined} loading="lazy" />
        {m.alt && <figcaption className="label">{m.alt}</figcaption>}
      </figure>
    )
  },
  table: ({ node, nodesToJSX }) => (
    <div className="tbl">
      <table>
        <tbody>{nodesToJSX({ nodes: node.children })}</tbody>
      </table>
    </div>
  ),
  blocks: {
    code: ({ node }) => <Code code={node.fields.code} language={node.fields.language ?? 'text'} />,
    banner: ({ node }) => (
      <div className="callout">
        <span className="label">{node.fields.style ?? 'Note'}</span>
        <RichText data={node.fields.content} />
      </div>
    ),
  },
})

export const Prose: React.FC<{ data: Parameters<typeof RichText>[0]['data']; className?: string }> = ({ data, className = 'prose' }) => <RichText className={className} converters={converters} data={data} />
