/**
 * Shared sticky/fixed top bar surface — content scrolls underneath with readable backdrop.
 * Use sticky for document-scroll shells (auth, partner, marketing).
 * Use fixed + FIXED_MOBILE_TOP_BAR for app layouts that pin the mobile chrome.
 */
export const STICKY_TOP_BAR =
  'sticky top-0 z-50 border-b border-[color:var(--border-subtle)] bg-token-surfaceMain/95 backdrop-blur-sm supports-[backdrop-filter]:bg-token-surfaceMain/90'

export const FIXED_MOBILE_TOP_BAR =
  'bg-token-surfaceMain/95 backdrop-blur-sm supports-[backdrop-filter]:bg-token-surfaceMain/90 border-b border-[color:var(--border-subtle)] text-token-textMain shadow-sm'
