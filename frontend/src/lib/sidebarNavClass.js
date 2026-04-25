/**
 * Sidebar (SaaS): default gray, active mint.
 * - default: #9ca3af (tailwind text-gray-400)
 * - active: #22e088 (primary) + subtle bg
 */
export function sidebarNavClass(isActive, theme = 'light') {
  const base =
    'relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-[background-color,color,transform,box-shadow] duration-200 ease-out'

  const inactive =
    theme === 'dark'
      ? 'text-gray-300/80 hover:text-gray-100 hover:bg-white/[0.06]'
      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'

  if (isActive) {
    if (theme === 'dark') {
      return (
        `${base} text-token-textMain bg-primary/15 ` +
        'before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-primary ' +
        'shadow-[0_10px_30px_rgba(0,0,0,0.18)]'
      )
    }
    return (
      `${base} text-green-700 bg-green-50 ` +
      'before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-[#00E676] ' +
      'shadow-[0_10px_24px_rgba(2,6,23,0.06)]'
    )
  }

  return `${base} ${inactive}`
}
