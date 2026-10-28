/* The settings page's sub tabs. Each tab is its own form and the action rewrites only the section posted, so a switch on a tab
   that is not shown is never read as off. */
export const SETTINGS_TABS = [
  { key: 'staff', label: 'Staff and roles' },
  { key: 'programme', label: 'Programme' },
  { key: 'deals', label: 'Deals and SLA' },
  { key: 'crm', label: 'CRM mirror' },
  { key: 'training', label: 'Training and certificates' },
  { key: 'notifications', label: 'Notifications' },
] as const

export type SettingsTab = (typeof SETTINGS_TABS)[number]['key']

export const SETTINGS_PATH = '/partners/portal/k7/settings'

export const settingsTab = (v: unknown): SettingsTab => SETTINGS_TABS.find((t) => t.key === v)?.key ?? 'staff'

export const settingsHref = (tab: SettingsTab, q = ''): string => {
  const p = new URLSearchParams(q)
  if (tab !== 'staff') p.set('tab', tab)
  const qs = p.toString()
  return qs ? `${SETTINGS_PATH}?${qs}` : SETTINGS_PATH
}
