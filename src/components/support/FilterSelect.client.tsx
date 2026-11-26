'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

import { filterOptions, settle, type FilterOption } from '@/lib/support/filter-options'

/* Type to filter (Field README, `filter-select`): a long reference list, where a select can only jump to the first entry that
   starts with the typed letters, as a text field in the Field's underline with the select's chevron. Typing narrows the list to
   the entries that contain the text (filter-options.ts); the list is the select's open list in the language (bundle.css). The
   chosen id is posted under `name` from a hidden input; the text the reader leaves settles on an exact or single match, or goes
   back to the last choice, so the field never posts a name that is not in the list. Keyboard: ↓ opens and moves, ↑ moves, Enter
   picks, Escape closes and restores. The ARIA pattern is the combobox with a listbox popup. */

export const FilterSelect: React.FC<{
  id: string
  name: string
  options: FilterOption[]
  defaultValue?: string
  onChange?: (id: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
}> = ({ id, name, options, defaultValue = '', onChange, placeholder, disabled, required }) => {
  const nameOf = (v: string) => (v ? (options.find((o) => o.id.toLowerCase() === v.toLowerCase())?.name ?? '') : '')
  const [value, setValue] = useState(defaultValue)
  // What the reader is typing; null shows the chosen entry's name (also once a list that loads late, a state's cities, arrives).
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? nameOf(value)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = `${id}-list`
  const optId = (i: number) => `${id}-opt-${i}`
  const matches = useMemo(() => filterOptions(options, query), [options, query])

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optId(active))}`)?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, query])

  const choose = (o: FilterOption | null) => {
    const v = o?.id ?? ''
    setDraft(null)
    setOpen(false)
    if (v !== value) {
      setValue(v)
      onChange?.(v)
    }
  }

  // Opened on the current choice the whole list shows, with the choice active; opened on typed text, its matches.
  const openList = () => {
    const q = draft ?? ''
    const at = filterOptions(options, q).findIndex((o) => o.id === value)
    setQuery(q)
    setActive(at < 0 ? 0 : at)
    setOpen(true)
  }

  const leave = () => {
    if (draft === null) return setOpen(false)
    if (!draft.trim()) return choose(null)
    const s = settle(options, draft)
    if (s) return choose(s)
    setDraft(null)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) openList()
      else setActive((a) => Math.min(a + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (open) setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && matches[active]) {
        e.preventDefault()
        choose(matches[active])
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      setDraft(null)
    }
  }

  return (
    <span className="control is-select filter-select">
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && matches[active] ? optId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onChange={(e) => {
          setDraft(e.target.value)
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        // The text is selected when the field is entered, so typing replaces the choice rather than adding to it.
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => {
          if (open) return setOpen(false)
          e.currentTarget.select()
          openList()
        }}
        onKeyDown={onKeyDown}
        onBlur={leave}
      />
      <input type="hidden" name={name} value={value} />
      {/* mousedown keeps the focus in the field, so a pick (or dragging the list's scrollbar) is not a blur first. */}
      <ul id={listId} role="listbox" className="filter-list" hidden={!open} ref={listRef} onMouseDown={(e) => e.preventDefault()}>
        {open &&
          matches.map((o, i) => (
            <li id={optId(i)} key={o.id} role="option" aria-selected={i === active} data-chosen={o.id === value ? '' : undefined} onClick={() => choose(o)} onMouseMove={() => i !== active && setActive(i)}>
              {o.name}
            </li>
          ))}
        {open && matches.length === 0 && (
          <li className="filter-none" role="presentation">
            Nothing matches “{text.trim()}”
          </li>
        )}
      </ul>
    </span>
  )
}
