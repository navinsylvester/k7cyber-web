'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

import { uniqueByName } from '@/lib/support/filter-options'

import { FilterSelect } from './FilterSelect.client'

type Cat = { id: string; name: string; label?: string }
type Sub = { id: string; name: string; categoryId: string }

/* Issue category → sub-category: the cascade runs in the browser from the cached lists (536 sub-categories).
   Tiles for customers (one tap on a phone), selects for agents (dense forms). */

export const CategoryPicker: React.FC<{
  categories: Cat[]
  subcategories: Sub[]
  categoryName?: string
  subcategoryName?: string
  initialCategory?: string
  initialSubcategory?: string
  mode: 'tiles' | 'select'
  required?: boolean
  subLabel?: string
}> = ({ categories, subcategories, categoryName = 'categoryId', subcategoryName = 'subcategoryId', initialCategory = '', initialSubcategory = '', mode, required, subLabel = 'More specifically' }) => {
  const [cat, setCat] = useState(initialCategory)
  const [sub, setSub] = useState(initialSubcategory)
  const subs = useMemo(() => subcategories.filter((s) => s.categoryId === cat), [subcategories, cat])
  const onCat = (v: string) => {
    setCat(v)
    setSub('')
  }
  return (
    <>
      {mode === 'tiles' ? (
        <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 10 }}>
            What is it about?{required ? <span className="req" aria-hidden="true">{' *'}</span> : null}
          </legend>
          <div className="choice">
            {categories.map((c) => (
              <label key={c.id}>
                <input type="radio" name={categoryName} value={c.id} checked={cat === c.id} onChange={() => onCat(c.id)} required={required} />
                <span className="t">{c.label ?? c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="field">
          <label className="label" htmlFor={`f-${categoryName}`}>
            Issue category{required ? <span className="req" aria-hidden="true">{' *'}</span> : null}
          </label>
          <span className="control is-select">
            <select id={`f-${categoryName}`} name={categoryName} value={cat} onChange={(e) => onCat(e.target.value)} required={required}>
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </span>
        </div>
      )}
      <div className={`field${mode === 'tiles' ? ' span-2' : ''}`}>
        <label className="label" htmlFor={`f-${subcategoryName}`}>
          {subLabel}
        </label>
        <span className="control is-select">
          <select id={`f-${subcategoryName}`} name={subcategoryName} value={sub} onChange={(e) => setSub(e.target.value)} disabled={!cat || subs.length === 0}>
            <option value="">{!cat ? 'Choose a category first' : subs.length === 0 ? 'No further detail needed' : 'Optional: pick the closest match'}</option>
            {subs.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </span>
      </div>
    </>
  )
}

/** State → city cascade for contact and account forms. Cities load from the server per state. Both are type-to-filter fields
    (FilterSelect): a state can have 453 cities, which a select only lets the reader jump through by first letters. */
export const GeoPicker: React.FC<{
  states: { id: string; name: string; regionId: string }[]
  regions: { id: string; name: string }[]
  initialState?: string
  initialCity?: string
  cities?: { id: string; name: string }[]
  /** Fields a refused submit marked (`stateId`, `cityId`). */
  bad?: string[]
}> = ({ states, regions, initialState = '', initialCity = '', cities = [], bad = [] }) => {
  const [state, setState] = useState(initialState)
  const [list, setList] = useState<{ id: string; name: string }[]>(cities)
  const [loading, setLoading] = useState(false)
  const region = states.find((s) => s.id === state)?.regionId ?? ''
  // A name listed twice (UAT's two city sets) shows once, the record's own choice kept; the server still accepts either record.
  const stateOptions = useMemo(() => uniqueByName(states, initialState), [states, initialState])
  const cityOptions = useMemo(() => uniqueByName(list, initialCity), [list, initialCity])
  const onState = async (v: string) => {
    setState(v)
    setList([])
    if (!v) return
    setLoading(true)
    try {
      const r = await fetch(`/support/workspace/geo/cities?state=${encodeURIComponent(v)}`)
      setList(r.ok ? ((await r.json()) as { id: string; name: string }[]) : [])
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      <div className={`field${bad.includes('stateId') ? ' is-invalid' : ''}`}>
        <label className="label" htmlFor="f-state">
          State
        </label>
        <FilterSelect id="f-state" name="stateId" options={stateOptions} defaultValue={initialState} onChange={onState} placeholder="Type or pick a state" />
      </div>
      <div className={`field${bad.includes('cityId') ? ' is-invalid' : ''}`}>
        <label className="label" htmlFor="f-city">
          City
        </label>
        {/* A new state is a new list: the city starts empty (TR-05). */}
        <FilterSelect
          key={state}
          id="f-city"
          name="cityId"
          options={cityOptions}
          defaultValue={state === initialState ? initialCity : ''}
          disabled={!state || loading}
          placeholder={loading ? 'Loading…' : state ? 'Type or pick a city' : 'Choose a state first'}
        />
      </div>
      <input type="hidden" name="regionId" value={region} />
      <div className="field">
        <span className="label" style={{ color: 'var(--mu)' }}>
          Region
        </span>
        <span className="control">
          <input value={regions.find((r) => r.id === region)?.name ?? ''} readOnly placeholder="Follows the state" />
        </span>
      </div>
    </>
  )
}

/** On the agent's new case form, picking a customer fills *Customer email* and *Vertical* from data attributes on the radio
    (`data-email`, `data-vertical`), unless the agent has typed or chosen something there by hand. Renders nothing; without
    JavaScript the server's prefill for a chosen contact still applies (13-tester-round-1.md, TR-06). */
export const CustomerAutofill: React.FC<{ email?: string; vertical?: string }> = ({ email = 'customerEmail', vertical = 'vertical' }) => {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const form = ref.current?.closest('form')
    if (!form) return
    const touched = new Set<string>()
    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement | HTMLSelectElement
      // A change the agent makes is theirs to keep; the fills below set values directly and fire no events.
      if (e.isTrusted && (t.name === email || t.name === vertical)) touched.add(t.name)
    }
    const onChange = (e: Event) => {
      onInput(e)
      const r = e.target as HTMLInputElement
      if (r.type !== 'radio' || r.name !== 'customer' || !r.checked) return
      const fill = (name: string, value: string | undefined) => {
        const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null
        if (!el || touched.has(name) || value === undefined) return
        if (name === vertical && value === '' && el.value !== '') return
        el.value = value
      }
      fill(email, r.dataset.email)
      fill(vertical, r.dataset.vertical)
    }
    form.addEventListener('input', onInput)
    form.addEventListener('change', onChange)
    return () => {
      form.removeEventListener('input', onInput)
      form.removeEventListener('change', onChange)
    }
  }, [email, vertical])
  return <span ref={ref} hidden />
}
