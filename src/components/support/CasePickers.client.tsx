'use client'

import React, { useMemo, useState } from 'react'

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
          <legend className="label" style={{ color: 'var(--mu)', marginBottom: 10 }}>
            What is it about?{required ? ' *' : ''}
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
            Issue category{required ? ' *' : ''}
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

/** State → city cascade for contact and account forms. Cities load from the server per state. */
export const GeoPicker: React.FC<{
  states: { id: string; name: string; regionId: string }[]
  regions: { id: string; name: string }[]
  initialState?: string
  initialCity?: string
  cities?: { id: string; name: string }[]
}> = ({ states, regions, initialState = '', initialCity = '', cities = [] }) => {
  const [state, setState] = useState(initialState)
  const [list, setList] = useState<{ id: string; name: string }[]>(cities)
  const [loading, setLoading] = useState(false)
  const region = states.find((s) => s.id === state)?.regionId ?? ''
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
      <div className="field">
        <label className="label" htmlFor="f-state">
          State
        </label>
        <span className="control is-select">
          <select id="f-state" name="stateId" value={state} onChange={(e) => onState(e.target.value)}>
            <option value="">Select a state</option>
            {states.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </span>
      </div>
      <div className="field">
        <label className="label" htmlFor="f-city">
          City
        </label>
        <span className="control is-select">
          <select id="f-city" name="cityId" defaultValue={initialCity} disabled={!state || loading}>
            <option value="">{loading ? 'Loading…' : state ? 'Select a city' : 'Choose a state first'}</option>
            {list.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </span>
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
