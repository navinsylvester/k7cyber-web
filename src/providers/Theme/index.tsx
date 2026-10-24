'use client'

import React, { createContext, useCallback, use, useSyncExternalStore } from 'react'

import type { Theme, ThemeContextType } from './types'

import { defaultTheme, themeLocalStorageKey } from './shared'
import { themeIsValid } from './types'

const initialContext: ThemeContextType = {
  setTheme: () => null,
  theme: undefined,
}

const ThemeContext = createContext(initialContext)

/* The theme lives on <html data-theme>, which the inline InitTheme script sets from the stored choice before the body
   paints. The provider reads that attribute rather than keeping its own copy: the server snapshot is undefined so
   hydration matches, and React re-renders with the attribute straight after hydrating, so the Dark/Light buttons show
   the right one pressed without waiting for an effect to read localStorage again. */
const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'], attributes: true })
  return () => observer.disconnect()
}
const getSnapshot = (): Theme => {
  const current = document.documentElement.getAttribute('data-theme')
  return themeIsValid(current) ? current : defaultTheme
}
const getServerSnapshot = (): Theme | undefined => undefined

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setTheme = useCallback((themeToSet: Theme | null) => {
    if (themeToSet === null) {
      window.localStorage.removeItem(themeLocalStorageKey)
      document.documentElement.setAttribute('data-theme', defaultTheme)
    } else {
      window.localStorage.setItem(themeLocalStorageKey, themeToSet)
      document.documentElement.setAttribute('data-theme', themeToSet)
    }
  }, [])

  return <ThemeContext value={{ setTheme, theme }}>{children}</ThemeContext>
}

export const useTheme = (): ThemeContextType => use(ThemeContext)
