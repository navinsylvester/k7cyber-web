import React from 'react'

/* The supplied logo files, never a redrawn mark: the white variant in dark, the full-colour variant in light.
   Both are in the markup; the theme attribute on <html> decides which one shows (see globals.css). The height comes from
   the bar's CSS (`.brand img`: 36px, 28px under 520px) unless one is passed. */
export const Logo: React.FC<{ height?: number }> = ({ height }) => (
  <>
    <img className="logo-dark" src="/logos/k7-cybersecurity-logo-white.svg" alt="K7 CyberSecurity" style={height ? { height, width: 'auto' } : undefined} />
    <img className="logo-light" src="/logos/k7-cybersecurity-logo.svg" alt="K7 CyberSecurity" style={height ? { height, width: 'auto' } : undefined} />
  </>
)
