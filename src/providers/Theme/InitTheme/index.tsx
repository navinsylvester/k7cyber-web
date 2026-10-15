import Script from 'next/script'
import React from 'react'

import { themeLocalStorageKey } from '../shared'

/* The server renders the default theme on <html> (dark), so the page paints without JavaScript. This script runs before
   the body is parsed and only switches to the choice stored under k7-theme, so a light-theme reader never sees dark first. */
export const InitTheme: React.FC = () => {
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      dangerouslySetInnerHTML={{
        __html: `
  (function () {
    try {
      var choice = window.localStorage.getItem('${themeLocalStorageKey}')
      if ((choice === 'light' || choice === 'dark') && choice !== document.documentElement.getAttribute('data-theme')) {
        document.documentElement.setAttribute('data-theme', choice)
      }
    } catch (e) {}
  })();
  `,
      }}
      id="theme-script"
      strategy="beforeInteractive"
    />
  )
}
