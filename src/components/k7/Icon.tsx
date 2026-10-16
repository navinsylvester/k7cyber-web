import React from 'react'

/* Icon (design-system/components/Icon): flat lines on a 32px grid, 2px stroke, square caps, mitred joins,
   and exactly one 3px signal pixel. The first nine were drawn for the Product page, the puzzle for the home page,
   the seven industries for the home index; add new ones here. */
export const icons = {
  surface: { d: 'M5 5h15v15H5z M20 20l7 7', px: [11, 11] },
  shield: { d: 'M6 5h20v12l-10 10-10-10z M17 9l-3 6h5l-3 6', px: [8.5, 8] },
  grid: { d: 'M4 4h24v24H4z M12 4v24 M20 4v24 M4 12h24 M4 20h24', px: [14.5, 14.5] },
  beacon: { d: 'M16 15v13 M11 28h10 M11 11l5-4 5 4 M6 13l10-9 10 9', px: [14.5, 12] },
  bars: { d: 'M4 27h24 M7 27V9 M13 27V14 M19 27V19 M25 27V23', px: [5.5, 4] },
  hex: { d: 'M10 4h12l6 6v12l-6 6H10l-6-6V10z M16 10v12 M10 16h12', px: [14.5, 14.5] },
  certificate: { d: 'M4 4h18l6 6v18H4z M9 16l5 5 9-9', px: [7, 7] },
  pulse: { d: 'M4 16h8l3-8 5 16 3-8h5', px: [14.5, 14.5] },
  document: { d: 'M7 4h13l5 5v19H7z M20 4v5h5 M11 15h10 M11 20h10', px: [11, 8.5] },
  screen: { d: 'M4 6h24v16H4z M12 26h8 M16 22v4', px: [7, 9] },
  lock: { d: 'M7 14h18v14H7z M11 14V7h10v7', px: [14.5, 19] },
  ledger: { d: 'M7 4h18v24H7z M11 11h10 M11 16h10 M11 21h6', px: [20, 19.5] },
  devices: { d: 'M4 8h18v12H4z M10 24h6 M13 20v4 M24 12h4v12h-4z', px: [7, 11] },
  archive: { d: 'M10 4h13l5 5v18H10z M23 4v5h5 M6 8v23h17', px: [14, 13] },
  key: { d: 'M18 4h10v10H18z M18 14L4 28 M8 24l4 4 M12 20l3 3', px: [21.5, 7.5] },
  network: { d: 'M4 24h8v4H4z M20 24h8v4h-8z M12 4h8v4h-8z M16 8v8 M8 24v-8h16v8', px: [14.5, 14.5] },
  puzzle: { d: 'M4 4h11v11H4z M4 17h11v11H4z M17 17h11v11H17z', px: [21, 8] }, // three pieces; the pixel marks the missing one
  /* The seven industries (the home index, before each row's arrow). The pixel is the seal in the pediment, the tassel,
     the flag on the tower, the centre of the cross, the smoke over the stack, the cursor, and the label on the bag. */
  bank: { d: 'M4 12L16 4l12 8 M4 12h24 M7 12v14 M13 12v14 M19 12v14 M25 12v14 M4 26h24', px: [14.5, 7] },
  mortarboard: { d: 'M4 11l12-6 12 6-12 6z M9 14v6l7 4 7-4v-6 M28 11v6', px: [26.5, 18] },
  capitol: { d: 'M4 28h24 M6 28V17h20v11 M12 17V9h8v8 M16 9V5 M14 28v-5h4v5', px: [17, 3] },
  cross: { d: 'M12 4h8v8h8v8h-8v8h-8v-8H4v-8h8z', px: [14.5, 14.5] },
  factory: { d: 'M4 28V12l8 6v-6l8 6v-6l8 6v10z M8 15V7h4v11', px: [8.5, 2] },
  terminal: { d: 'M4 6h24v20H4z M9 11l5 5-5 5 M16 21h5', px: [23, 19.5] },
  bag: { d: 'M8 11h16l2 17H6z M12 11V7h8v4', px: [14.5, 18] },
} as const

export type IconName = keyof typeof icons

/* The five social glyphs for SiteFooter, on the same rules. The pixel is the dot of the i, the tip of a stroke,
   the record light, the flash, and the end of the f's arm. Not offered in the content icon picker. */
export const social = {
  linkedin: { d: 'M9 14v12 M15 26V14h9v12', px: [7.5, 8] },
  x: { d: 'M8 8l13 13 M24 8L8 24', px: [22.5, 22.5] },
  youtube: { d: 'M4 8h24v16H4z M13 12l8 4-8 4z', px: [7, 11] },
  instagram: { d: 'M5 5h22v22H5z M11 11h10v10H11z', px: [22.5, 7.5] },
  facebook: { d: 'M17 27V8h5 M12 16h10', px: [23.5, 6.5] },
} as const

export type SocialName = keyof typeof social

/* The chrome glyphs, on the same rules, for the site's own controls. `theme`: a square cut by the seven, the cut-off part
   hatched at the same angle, the pixel on the tab; the theme's inversion makes it read as the positive or the negative print.
   Not offered in the content icon picker. */
export const chrome = {
  theme: { d: 'M4 4h24v24H4z M24 4L13 28 M28 10l-8.2 18 M28 18l-4.6 10', px: [8, 8] },
} as const

export type ChromeName = keyof typeof chrome

/** The social glyph for a network name as the Footer global stores it ("LinkedIn", "X", "YouTube"), or null. */
export const socialGlyph = (name: string): SocialName | null => {
  const key = name.toLowerCase().replace(/[^a-z]/g, '')
  return key in social ? (key as SocialName) : null
}

export const iconOptions = (Object.keys(icons) as IconName[]).map((value) => ({
  label: value.charAt(0).toUpperCase() + value.slice(1),
  value,
}))

const all = { ...icons, ...social, ...chrome }

export const Icon: React.FC<{ name?: IconName | SocialName | ChromeName | string | null; className?: string }> = ({ name, className = 'licon' }) => {
  const icon = all[(name as keyof typeof all) in all ? (name as keyof typeof all) : 'grid']
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d={icon.d} />
      <rect x={icon.px[0]} y={icon.px[1]} width="3" height="3" />
    </svg>
  )
}
