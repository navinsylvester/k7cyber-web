import React from 'react'

import { themeLocalStorageKey } from '../shared'

/* The server renders the default theme on <html> (dark), so the page paints without JavaScript. This is a plain inline
   script in <head>, so the parser runs it before the body is parsed and a light-theme reader never sees dark first.
   Not next/script: in the App Router its beforeInteractive inline scripts are queued for the client runtime and run
   only once that has loaded, seconds after the first paint (13-tester-round-1.md, TR-01). */
export const InitTheme: React.FC = () => {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function () {
  try {
    var choice = window.localStorage.getItem('${themeLocalStorageKey}')
    if ((choice === 'light' || choice === 'dark') && choice !== document.documentElement.getAttribute('data-theme')) {
      document.documentElement.setAttribute('data-theme', choice)
    }
  } catch (e) {}
})();`,
      }}
      id="theme-script"
    />
  )
}
