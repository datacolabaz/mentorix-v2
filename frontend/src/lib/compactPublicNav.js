/** Compact public chrome: language lives in the menu, FAB stays visible. Matches Tailwind `lg`. */
export const COMPACT_PUBLIC_NAV_MQ = '(max-width: 1023px)'

export function isCompactPublicNav(mediaQuery = COMPACT_PUBLIC_NAV_MQ, win = globalThis) {
  if (!win?.matchMedia) return true
  return Boolean(win.matchMedia(mediaQuery).matches)
}
