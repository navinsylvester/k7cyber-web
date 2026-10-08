import React from 'react'

/* The supplied logo files, never a redrawn mark: the white variant in dark, the full-colour variant in light.
   Both are in the markup; the theme attribute on <html> decides which one shows (see globals.css). */
export const Logo: React.FC<{ height?: number }> = ({ height = 26 }) => (
  <>
    <img className="logo-dark" src="/logos/k7-cybersecurity-logo-white.svg" alt="K7 CyberSecurity" style={{ height, width: 'auto' }} />
    <img className="logo-light" src="/logos/k7-cybersecurity-logo.svg" alt="K7 CyberSecurity" style={{ height, width: 'auto' }} />
  </>
)
