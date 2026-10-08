import React from 'react'

/* Icon (design-system/components/Icon): flat lines on a 32px grid, 2px stroke, square caps, mitred joins,
   and exactly one 3px signal pixel. These are the nine drawn for the Product page; add new ones here. */
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
} as const

export type IconName = keyof typeof icons

export const iconOptions = (Object.keys(icons) as IconName[]).map((value) => ({
  label: value.charAt(0).toUpperCase() + value.slice(1),
  value,
}))

export const Icon: React.FC<{ name?: IconName | string | null; className?: string }> = ({ name, className = 'licon' }) => {
  const icon = icons[(name as IconName) in icons ? (name as IconName) : 'grid']
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d={icon.d} />
      <rect x={icon.px[0]} y={icon.px[1]} width="3" height="3" />
    </svg>
  )
}
