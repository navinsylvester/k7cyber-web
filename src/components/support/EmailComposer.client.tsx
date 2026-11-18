'use client'

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { EMAIL_COLOURS, EMAIL_FONTS, EMAIL_SIZES } from '@/lib/support/email-html'

/* The case sheet's email composer (SupportParts S31): a formatting bar over an editable area, the browser's own editing commands
   underneath. It posts `html` (what the agent formatted) and `text` (its words, for the checks); the server cleans the HTML
   (src/lib/support/email-html.ts) before Dynamics sees it. Before React hydrates, and without JavaScript, it is a plain textarea
   posting `text` only. Pasting brings words, not another page's styles, so what the agent sees is what the customer gets. */

const subscribe = () => () => {}
const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false)

type Marks = { bold: boolean; italic: boolean; underline: boolean; ul: boolean; ol: boolean; link: boolean }
const NO_MARKS: Marks = { bold: false, italic: false, underline: false, ul: false, ol: false, link: false }

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** What the agent typed as a link target, made into one: an address gets mailto:, a bare host gets https://. Null when it is not one. */
export const linkTarget = (raw: string): string | null => {
  const v = raw.trim()
  if (!v || /\s/.test(v)) return null
  if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(v)) return v
  if (/^[^@\s/]+@[^@\s/]+\.[a-z]{2,}$/i.test(v)) return `mailto:${v}`
  const withScheme = /^https?:\/\//i.test(v) ? v : /^[a-z][a-z0-9+.-]*:/i.test(v) ? null : `https://${v}`
  if (!withScheme) return null
  try {
    const u = new URL(withScheme)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.') ? u.href : null
  } catch {
    return null
  }
}

const closestLink = (node: Node | null, root: HTMLElement): HTMLAnchorElement | null => {
  for (let n: Node | null = node; n && n !== root; n = n.parentNode) if (n instanceof HTMLAnchorElement) return n
  return null
}

const ToolButton: React.FC<{ label: string; keys?: string; on?: boolean; wide?: boolean; onPress: () => void; children: React.ReactNode }> = ({ label, keys, on, wide, onPress, children }) => (
  <button
    type="button"
    className={`rt-btn${wide ? ' is-wide' : ''}`}
    aria-label={label}
    title={keys ? `${label} (${keys})` : label}
    {...(on !== undefined ? { 'aria-pressed': on } : {})}
    // Keep the editor's focus and selection: the command acts on what the agent selected.
    onMouseDown={(e) => e.preventDefault()}
    onClick={onPress}
  >
    {children}
  </button>
)

export const RichText: React.FC<{ id: string; label: string; required?: boolean; hint?: string }> = ({ id, label, required, hint }) => {
  const hydrated = useHydrated()
  const ed = useRef<HTMLDivElement>(null)
  const saved = useRef<Range | null>(null)
  const [html, setHtml] = useState('')
  const [text, setText] = useState('')
  const [marks, setMarks] = useState<Marks>(NO_MARKS)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState('')
  const [error, setError] = useState('')

  // Remember where the caret was in the editor, and which marks it sits in, so the bar can show them and act on that spot.
  useEffect(() => {
    if (!hydrated) return
    const onSelection = () => {
      const el = ed.current
      const sel = document.getSelection()
      if (!el || !sel || sel.rangeCount === 0) return
      const r = sel.getRangeAt(0)
      if (!el.contains(r.commonAncestorContainer)) return
      saved.current = r.cloneRange()
      setMarks({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        link: closestLink(r.startContainer, el) !== null,
      })
    }
    document.addEventListener('selectionchange', onSelection)
    return () => document.removeEventListener('selectionchange', onSelection)
  }, [hydrated])

  // An empty message is stopped here, before the post, so nothing typed elsewhere in the form is lost to a round trip.
  useEffect(() => {
    if (!hydrated || !required) return
    const form = ed.current?.closest('form')
    if (!form) return
    const onSubmit = (e: SubmitEvent) => {
      if ((ed.current?.innerText ?? '').replace(/\s+/g, '').length >= 2) return
      e.preventDefault()
      e.stopImmediatePropagation()
      setError('Write the email first.')
      ed.current?.focus()
    }
    form.addEventListener('submit', onSubmit)
    return () => form.removeEventListener('submit', onSubmit)
  }, [hydrated, required])

  const sync = () => {
    const el = ed.current
    if (!el) return
    setHtml(el.innerHTML)
    setText(el.innerText)
    if (el.innerText.replace(/\s+/g, '').length >= 2) setError('')
  }

  // Back to where the agent was. The selection is set again only when it has left the editor: setting it clears the browser's
  // pending style at the caret, so Size then Font with nothing selected would keep only the font.
  const restore = () => {
    const el = ed.current
    if (!el) return
    const sel = document.getSelection()
    const inside = () => !!sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)
    if (document.activeElement !== el) el.focus({ preventScroll: true })
    const r = saved.current
    if (!inside() && r && sel && el.contains(r.commonAncestorContainer)) {
      sel.removeAllRanges()
      sel.addRange(r)
    }
  }

  const run = (command: string, value?: string) => {
    restore()
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(command, false, value)
    sync()
  }

  const openLink = () => {
    const el = ed.current
    const a = el && saved.current ? closestLink(saved.current.startContainer, el) : null
    setLinkUrl(a ? a.getAttribute('href') ?? '' : '')
    setLinkError('')
    setLinkOpen(true)
  }

  const applyLink = () => {
    const href = linkTarget(linkUrl)
    if (!href) {
      setLinkError('Type a web address (k7computing.com/support) or an email address.')
      return
    }
    restore()
    const sel = document.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      const shown = href.replace(/^mailto:/i, '')
      document.execCommand('insertHTML', false, `<a href="${escapeHtml(href)}">${escapeHtml(shown)}</a>&nbsp;`)
    } else {
      document.execCommand('createLink', false, href)
    }
    sync()
    setLinkOpen(false)
  }

  if (!hydrated) {
    return (
      <div className="field">
        <label className="label" htmlFor={id}>
          {label}
          {required ? (
            <span className="req" aria-hidden="true">
              {' *'}
            </span>
          ) : null}
        </label>
        <span className="control">
          <textarea id={id} name="text" rows={6} required={required} />
        </span>
        {hint && <span className="hint">{hint}</span>}
      </div>
    )
  }

  return (
    <div className={`field composer${error ? ' is-invalid' : ''}`}>
      <span className="label" id={`${id}-label`}>
        {label}
        {required ? (
          <span className="req" aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </span>
      <div className="rt-bar" role="toolbar" aria-label="Formatting" aria-controls={id}>
        <span className="rt-group">
          <ToolButton label="Bold" keys="Ctrl+B" on={marks.bold} onPress={() => run('bold')}>
            <b>B</b>
          </ToolButton>
          <ToolButton label="Italic" keys="Ctrl+I" on={marks.italic} onPress={() => run('italic')}>
            <i>I</i>
          </ToolButton>
          <ToolButton label="Underline" keys="Ctrl+U" on={marks.underline} onPress={() => run('underline')}>
            <u>U</u>
          </ToolButton>
        </span>
        <span className="rt-group">
          <ToolButton label="Bulleted list" wide on={marks.ul} onPress={() => run('insertUnorderedList')}>
            • List
          </ToolButton>
          <ToolButton label="Numbered list" wide on={marks.ol} onPress={() => run('insertOrderedList')}>
            1. List
          </ToolButton>
        </span>
        <span className="rt-group">
          <ToolButton label="Link" keys="Ctrl+K" wide on={marks.link || linkOpen} onPress={openLink}>
            Link
          </ToolButton>
          <ToolButton label="Clear formatting" wide onPress={() => run('removeFormat')}>
            Clear
          </ToolButton>
        </span>
        <span className="rt-group">
          <span className="rt-select">
            <select aria-label="Font" value="" onChange={(e) => e.target.value && run('fontName', e.target.value)}>
              <option value="" disabled>
                Font
              </option>
              {EMAIL_FONTS.map((f) => (
                <option value={f.face} key={f.face}>
                  {f.label}
                </option>
              ))}
            </select>
          </span>
          <span className="rt-select">
            <select aria-label="Size" value="" onChange={(e) => e.target.value && run('fontSize', e.target.value)}>
              <option value="" disabled>
                Size
              </option>
              {EMAIL_SIZES.map((s) => (
                <option value={s.value} key={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </span>
        </span>
        <span className="rt-group rt-colours" role="group" aria-label="Text colour">
          {EMAIL_COLOURS.map((c) => (
            <button
              type="button"
              className="rt-swatch"
              key={c.value}
              style={{ '--sw': c.value } as React.CSSProperties}
              aria-label={`Text colour ${c.label}`}
              title={c.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run('foreColor', c.value)}
            />
          ))}
        </span>
      </div>
      {linkOpen && (
        <div className={`rt-link${linkError ? ' is-invalid' : ''}`}>
          <span className="control">
            <input
              type="text"
              inputMode="url"
              aria-label="Link address"
              placeholder="https://… or name@example.com"
              value={linkUrl}
              autoFocus
              onChange={(e) => {
                setLinkUrl(e.target.value)
                setLinkError('')
              }}
              onKeyDown={(e) => {
                // Enter would submit the whole email from here.
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyLink()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setLinkOpen(false)
                  restore()
                }
              }}
            />
          </span>
          <span className="actions">
            <button type="button" className="btn btn-line btn-sm" onClick={applyLink}>
              {marks.link ? 'Change link' : 'Add link'}
            </button>
            {marks.link && (
              <button
                type="button"
                className="link-u textbtn"
                onClick={() => {
                  run('unlink')
                  setLinkOpen(false)
                }}
              >
                Remove link
              </button>
            )}
            <button
              type="button"
              className="link-u textbtn"
              onClick={() => {
                setLinkOpen(false)
                restore()
              }}
            >
              Cancel
            </button>
          </span>
          {linkError && <span className="field-error">{linkError}</span>}
        </div>
      )}
      <div className="control rt-area g-paper" data-theme="light">
        <div
          id={id}
          ref={ed}
          className="rt-edit"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-help`}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          spellCheck
          onInput={sync}
          onBlur={sync}
          onPaste={(e) => {
            e.preventDefault()
            document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
            sync()
          }}
          onDrop={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
              e.preventDefault()
              openLink()
            }
          }}
        />
      </div>
      {error ? (
        <span className="field-error" id={`${id}-help`}>
          {error}
        </span>
      ) : (
        hint && (
          <span className="hint" id={`${id}-help`}>
            {hint}
          </span>
        )
      )}
      <input type="hidden" name="html" value={html} />
      <input type="hidden" name="text" value={text} />
    </div>
  )
}

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]{1,12})$/)?.[1] ?? ''
const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`)

/** Files for the email: several at once, listed with their sizes, refused in the browser when Dynamics would refuse them. */
export const FilePick: React.FC<{ id: string; name: string; label: string; hint: string; maxFiles: number; maxTotal: number; blocked: string[] }> = ({ id, name, label, hint, maxFiles, maxTotal, blocked }) => {
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<{ name: string; size: number }[]>([])
  const [error, setError] = useState('')
  const check = () => {
    const list = Array.from(input.current?.files ?? [])
    setFiles(list.map((f) => ({ name: f.name, size: f.size })))
    const total = list.reduce((n, f) => n + f.size, 0)
    const bad = list.find((f) => blocked.includes(ext(f.name)))
    const msg =
      list.length > maxFiles
        ? `${list.length} files chosen; ${maxFiles} at most on one email.`
        : bad
          ? `Dynamics does not accept .${ext(bad.name)} files as attachments (${bad.name}).`
          : total > maxTotal
            ? `${size(total)} chosen; ${size(maxTotal)} in all at most on one email.`
            : ''
    input.current?.setCustomValidity(msg)
    setError(msg)
  }
  return (
    <div className={`field${error ? ' is-invalid' : ''}`}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <span className="control">
        <input ref={input} id={id} name={name} type="file" multiple onChange={check} />
      </span>
      {files.length > 1 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <span className="n">{f.name}</span>
              <span className="s">{size(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
      {error ? <span className="field-error">{error}</span> : <span className="hint">{hint}</span>}
    </div>
  )
}
