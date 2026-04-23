/**
 * Sidebar (SaaS): default gray, active mint.
 * - default: #9ca3af (tailwind text-gray-400)
 * - active: #22e088 (primary) + subtle bg
 */
export function sidebarNavClass(isActive, theme = 'light') {
  const base =
    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors'
  const inactive =
    theme === 'dark'
      ? 'text-gray-400 hover:text-primary hover:bg-white/5'
      : 'text-[#003366] hover:text-primary hover:bg-gray-100'

  if (isActive) {
    return `${base} text-white bg-primary shadow-sm shadow-primary/20`
  }

  return `${base} ${inactive}`
}
